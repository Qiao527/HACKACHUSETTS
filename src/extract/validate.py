"""Citation validator: no citation, no value (ai-rules.md, Extraction rule 1).

Validation is the trust boundary. The LLM proposes; code decides. A field is
only accepted when:

1. it carries a page number inside the document and a quote that appears on
   that page as an exact, case-sensitive substring after whitespace runs are
   collapsed (the only normalization allowed);
2. every reported number (`value` and both `value_range` bounds) appears as a
   number in that quote, including comma-formatted currency such as
   "$360,000"; USD fields need a currency marker and year fields a 4-digit year;
3. a roof-age field (`roof_installation_year`, `roof_age_years`) quotes roofing
   wording, so a building construction year is never accepted as roof age.

Otherwise its status becomes `missing`, its values and evidence are cleared,
and `request` names what would resolve it.
"""
from __future__ import annotations

import re
from typing import NamedTuple

from src.contract import InputField

_WS = re.compile(r"\s+")

# A number in quoted text: optional currency prefix, then either a correctly
# comma-grouped number ("360,000", "1,250,000.50") or a plain one ("85000",
# "0.18", "2"). The lookarounds stop "30,0000" or "1.2.3" from yielding a
# number that is not actually written in the quote.
_NUMBER = re.compile(
    r"(?<![\d.,])"
    r"(?P<cur>\$\s?|USD\s?)?"
    r"(?P<num>\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)"
    r"(?![\d]|,\d|\.\d)"
    r"(?P<suffix>\s?(?:USD|dollars)\b)?"
)
_YEAR = re.compile(r"\d{4}")

ROOF_AGE_FIELDS: tuple[str, ...] = ("roof_installation_year", "roof_age_years")
ROOF_RECORDS_REQUEST = (
    "Provide roofing records (installation or replacement date, permit, or "
    "warranty). Do not infer roof age from the building construction year."
)
# Keyword checks on the meaning of a roof-age quote. These are not citation
# matching (that stays exact and case-sensitive above); they only decide
# whether an already-verified quote talks about the roof at all.
_ROOF_WORDS = re.compile(r"roof|membrane", re.IGNORECASE)
_ROOF_DATE_WORDS = {
    "roof_installation_year": re.compile(r"install|replac|re-?roof", re.IGNORECASE),
    "roof_age_years": re.compile(r"\bage\b|\bold\b|\bago\b|install|replac", re.IGNORECASE),
}


class _QuotedNumber(NamedTuple):
    value: float
    raw: str          # digits as written, e.g. "360,000"
    currency: bool    # "$" / "USD" prefix or "USD" / "dollars" suffix


def normalize(text: str) -> str:
    """Collapse all runs of whitespace to single spaces and strip ends. Case is kept."""
    return _WS.sub(" ", text or "").strip()


def quote_on_page(quote: str, page_text: str) -> bool:
    """True when the quote appears on the page, case-sensitively, after whitespace normalization."""
    q = normalize(quote)
    if not q:
        return False
    return q in normalize(page_text)


def numbers_in_quote(quote: str) -> list[_QuotedNumber]:
    """Every number written in the quote, with its currency marker if any."""
    out: list[_QuotedNumber] = []
    for m in _NUMBER.finditer(quote or ""):
        raw = m.group("num")
        out.append(
            _QuotedNumber(
                value=float(raw.replace(",", "")),
                raw=raw,
                currency=bool(m.group("cur") or m.group("suffix")),
            )
        )
    return out


def _is_usd(unit: str) -> bool:
    return unit.strip().upper().startswith("USD")


def _matches(number: float, quoted: list[_QuotedNumber], unit: str) -> list[_QuotedNumber]:
    """Quoted numbers equal to `number` that are written in a form valid for `unit`."""
    hits = [q for q in quoted if q.value == number]
    if unit.strip().lower() == "year":
        hits = [q for q in hits if _YEAR.fullmatch(q.raw)]
    return hits


def _numbers_grounded(field: InputField, quote: str) -> bool:
    """True when every reported number is written in the quote (and in a valid form)."""
    targets: list[float] = []
    if field.value is not None:
        targets.append(field.value)
    if field.value_range is not None:
        low, high = field.value_range
        if low > high:
            return False
        targets.extend([low, high])
    if not targets:
        return True  # nothing numeric to ground (text fields)

    quoted = numbers_in_quote(quote)
    hits_per_target = [_matches(t, quoted, field.unit) for t in targets]
    if any(not hits for hits in hits_per_target):
        return False
    if _is_usd(field.unit):
        # Money must be written as money: at least one grounding number in the
        # quote carries "$" or "USD", so "30,000 square feet" never grounds a cost.
        return any(q.currency for hits in hits_per_target for q in hits)
    return True


def _text_grounded(field: InputField, quote: str) -> bool:
    """Text candidates must be copied from the cited quote, not normalized or invented."""
    if field.text_value is None:
        return True
    value = normalize(field.text_value)
    return bool(value) and value in normalize(quote)


def _roof_age_quote_ok(field: InputField, quote: str) -> bool:
    """A roof-age value needs a quote about the roof's own installation or age."""
    return bool(_ROOF_WORDS.search(quote) and _ROOF_DATE_WORDS[field.field].search(quote))


def _mark_missing(field: InputField, request: str) -> InputField:
    return field.model_copy(
        update={
            "value": None,
            "text_value": None,
            "value_range": None,
            "status": "missing",
            "evidence": None,
            "request": request,
        }
    )


def _request(field: InputField, default: str) -> str:
    if field.field in ROOF_AGE_FIELDS:
        return ROOF_RECORDS_REQUEST
    return field.request or default


def validate_field(field: InputField, pages: list[str]) -> InputField:
    """Return a validated copy of a single field.

    - human_supplied fields are trusted as-is (humans can override, rule 4).
    - A field with valid evidence (page in range, exact quote found, every
      number grounded in the quote) is accepted.
    - Anything else becomes `missing` with a request.
    """
    if field.status == "human_supplied":
        return field

    ev = field.evidence
    if ev is None:
        return _mark_missing(field, _request(field, f"Provide a document stating {field.field}."))

    # Page numbers are 1-based; pages list is 0-based.
    if ev.page < 1 or ev.page > len(pages):
        return _mark_missing(field, _request(field, f"Provide a page citation for {field.field}."))

    page_text = pages[ev.page - 1]
    if not quote_on_page(ev.evidence_text, page_text):
        return _mark_missing(
            field,
            _request(field, f"The quoted passage for {field.field} was not found on page {ev.page}."),
        )

    if not _numbers_grounded(field, ev.evidence_text):
        return _mark_missing(
            field,
            _request(
                field,
                f"The number reported for {field.field} does not appear in the quoted passage "
                f"on page {ev.page}. Provide a document stating it.",
            ),
        )

    if not _text_grounded(field, ev.evidence_text):
        return _mark_missing(
            field,
            _request(
                field,
                f"The text reported for {field.field} is not copied from the quoted passage "
                f"on page {ev.page}.",
            ),
        )

    if field.field in ROOF_AGE_FIELDS and not _roof_age_quote_ok(field, ev.evidence_text):
        return _mark_missing(field, ROOF_RECORDS_REQUEST)

    # Valid citation. If it was a fresh extraction, mark it unconfirmed for the user.
    status = field.status if field.status in ("confirmed", "extracted_unconfirmed") else "extracted_unconfirmed"
    return field.model_copy(update={"status": status})


def validate_fields(fields: list[InputField], pages: list[str]) -> list[InputField]:
    """Validate a list of extracted fields against the PDF pages."""
    return [validate_field(f, pages) for f in fields]


def revalidate(fields: list[InputField], pages: list[str]) -> list[InputField]:
    """Validating an already-validated result returns the same result (ai-rules rule).

    Idempotent: validate(validate(x)) == validate(x).
    """
    return validate_fields(fields, pages)
