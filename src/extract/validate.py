"""Citation validator: no citation, no value (ai-rules.md, Extraction rule 1).

Validation is the trust boundary. The LLM proposes; code decides. A field is
only accepted when it carries a page number and an exact quote that appears on
that page after whitespace normalization. Otherwise its status becomes
`missing` with a `request` naming the document that would resolve it.
"""
from __future__ import annotations

import re

from src.contract import InputField

_WS = re.compile(r"\s+")


def normalize(text: str) -> str:
    """Collapse all runs of whitespace to single spaces and strip ends."""
    return _WS.sub(" ", text or "").strip()


def quote_on_page(quote: str, page_text: str) -> bool:
    """True when the quote appears on the page after whitespace normalization."""
    q = normalize(quote)
    if not q:
        return False
    return q.lower() in normalize(page_text).lower()


def _mark_missing(field: InputField, request: str) -> InputField:
    return field.model_copy(
        update={
            "value": None,
            "value_range": None,
            "status": "missing",
            "evidence": None,
            "request": request,
        }
    )


def validate_field(field: InputField, pages: list[str]) -> InputField:
    """Return a validated copy of a single field.

    - human_supplied fields are trusted as-is (humans can override, rule 4).
    - A field with valid evidence (page in range + quote found) is accepted.
    - Anything else becomes `missing` with a request.
    """
    if field.status == "human_supplied":
        return field

    ev = field.evidence
    if ev is None:
        return _mark_missing(field, field.request or f"Provide a document stating {field.field}.")

    # Page numbers are 1-based; pages list is 0-based.
    if ev.page < 1 or ev.page > len(pages):
        return _mark_missing(field, field.request or f"Provide a page citation for {field.field}.")

    page_text = pages[ev.page - 1]
    if not quote_on_page(ev.evidence_text, page_text):
        return _mark_missing(
            field,
            field.request or f"The quoted passage for {field.field} was not found on page {ev.page}.",
        )

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
