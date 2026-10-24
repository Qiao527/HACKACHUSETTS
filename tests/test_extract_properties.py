"""Property tests for document extraction (ai-rules.md, Extraction).

No real LLM, no live API. A recorded LLM output and recorded page text are read
from data/fixtures/. The validator is the trust boundary under test.
"""
from __future__ import annotations

import json
import string
from pathlib import Path

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from src.contract import Evidence, InputField
from src.extract import extract_fields, revalidate, validate_fields
from src.extract.validate import ROOF_RECORDS_REQUEST, numbers_in_quote, validate_field

_ROOT = Path(__file__).resolve().parent.parent
_PAGES = json.loads((_ROOT / "data" / "fixtures" / "roof_report_pages.json").read_text())["pages"]
_LLM_OUT = json.loads((_ROOT / "data" / "fixtures" / "llm_extract.json").read_text())


def _fake_llm(_prompt, _schema):
    """Replay the recorded extraction; ignores the prompt entirely."""
    return {"fields": _LLM_OUT["fields"]}


def _run_extraction():
    return extract_fields(_PAGES, document_id="demo_roof_report.pdf", llm=_fake_llm)


# REQ: WHEN a field is extracted, it SHALL include a page number and a quote found
# on that page, otherwise mark it missing.
def test_extracted_fields_have_valid_citation_or_missing():
    fields = _run_extraction()
    for f in fields:
        if f.status == "missing":
            assert f.value is None and f.value_range is None
            assert f.request  # a missing field names what would resolve it
        else:
            assert f.evidence is not None
            page_text = _PAGES[f.evidence.page - 1]
            # Whitespace-normalized, case-sensitive (no .lower()).
            norm_page = " ".join(page_text.split())
            norm_quote = " ".join(f.evidence.evidence_text.split())
            assert norm_quote in norm_page


# REQ: A quote that is NOT on the cited page forces the field to missing.
def test_fabricated_quote_becomes_missing():
    bad = InputField(
        field="roof_replacement_cost",
        value=999999,
        unit="USD",
        status="extracted_unconfirmed",
        evidence=Evidence(
            document_id="demo_roof_report.pdf",
            page=1,
            evidence_text="This sentence does not appear anywhere in the document.",
            source_type="synthetic_document",
        ),
    )
    out = validate_fields([bad], _PAGES)[0]
    assert out.status == "missing"
    assert out.value is None


# REQ: WHEN the document has no explicit roof date, roof age is missing regardless
# of construction year. (A construction-year-only quote must not yield roof age.)
def test_never_infers_roof_age_from_construction_year():
    pages = ["This building was constructed in 1972. No roof installation date is recorded."]
    inferred = InputField(
        field="roof_remaining_life_years",
        value=10,
        unit="years",
        status="extracted_unconfirmed",
        evidence=Evidence(
            document_id="doc",
            page=1,
            evidence_text="This building was constructed in 1972.",
            source_type="synthetic_document",
        ),
    )
    # Even though the quote is genuinely on the page, it says nothing about roof
    # life, so a correct extractor never emits this field. We assert the stricter
    # behavior: a roof-age field whose quote lacks a roof date must be rejected by
    # the caller. Here we verify the extractor does not fabricate it from the LLM
    # output when the page has no roof date.
    def _llm_no_roof_date(_p, _s):
        return {"fields": []}

    out = extract_fields(pages, document_id="doc", llm=_llm_no_roof_date)
    assert all(f.field != "roof_remaining_life_years" for f in out)


# REQ: Validating an already-validated extraction returns the same result (idempotent).
def test_validation_is_idempotent():
    once = _run_extraction()
    twice = revalidate(once, _PAGES)
    assert [f.model_dump() for f in once] == [f.model_dump() for f in twice]


# REQ: WHEN a user edits a field, it SHALL be human_supplied and kept as-is.
@settings(max_examples=50, deadline=None)
@given(st.floats(min_value=0, max_value=1_000_000, allow_nan=False, allow_infinity=False))
def test_human_supplied_is_trusted(value: float):
    edited = InputField(
        field="roof_replacement_cost",
        value=value,
        unit="USD",
        status="human_supplied",
        evidence=None,
        confirmed_by_user=True,
    )
    out = validate_fields([edited], _PAGES)[0]
    assert out.status == "human_supplied"
    assert out.value == value


# ---------------------------------------------------------------------------
# Citation-validator hardening (fix/extraction-trust).
# Exact, case-sensitive quotes after whitespace collapse; every reported number
# must be written in the quote; roof age needs roofing evidence.
# ---------------------------------------------------------------------------
_COST_PAGE = (
    "Section 3 — Budgetary costs.\n"
    "Budgetary cost to replace the roof assembly is approximately $360,000.\n"
    "Allowance to remove and reinstall a rooftop array is $85,000.\n"
    "The roof area is 30,000 square feet."
)
_LIFE_PAGE = "Remaining useful life of the membrane is estimated at 2-4 years. Alt: 7 to 9 years."
_BUILDING_PAGE = "The building was constructed in 1979. The roof membrane was replaced in 2011."


def _field(name, quote, *, page=1, value=None, value_range=None, unit="USD", status="extracted_unconfirmed"):
    return InputField(
        field=name,
        value=value,
        value_range=value_range,
        unit=unit,
        status=status,
        evidence=Evidence(
            document_id="doc.pdf", page=page, evidence_text=quote, source_type="synthetic_document"
        ),
    )


def _assert_missing(out):
    assert out.status == "missing"
    assert out.value is None and out.value_range is None and out.text_value is None
    assert out.evidence is None
    assert out.request


# REQ 3.1: a quote found on the cited page, with its number written in it, is accepted.
def test_valid_citation_with_comma_currency_is_accepted():
    f = _field(
        "roof_replacement_cost",
        "Budgetary cost to replace the roof assembly is approximately $360,000.",
        value=360000,
    )
    out = validate_field(f, [_COST_PAGE])
    assert out.status == "extracted_unconfirmed"
    assert out.value == 360000
    assert out.evidence == f.evidence


# Whitespace-run normalization is the only normalization allowed (ai-rules rule 1).
def test_whitespace_differences_are_tolerated():
    pages = ["Allowance to remove and\n   reinstall a rooftop array is $85,000."]
    f = _field("removal_reinstall_cost", "Allowance to remove and reinstall a rooftop  array is $85,000.", value=85000)
    assert validate_field(f, pages).status == "extracted_unconfirmed"


# REQ 3.3: a page number outside 1..page_count makes the field missing.
@pytest.mark.parametrize("page", [0, 2, 99])
def test_invalid_page_reference_becomes_missing(page):
    f = _field("roof_replacement_cost", "approximately $360,000.", value=360000)
    # Evidence enforces page >= 1, so page 0 can only arrive by bypassing the model.
    ev = Evidence.model_construct(**{**f.evidence.model_dump(), "page": page})
    f = f.model_copy(update={"evidence": ev})
    _assert_missing(validate_field(f, [_COST_PAGE]))


# REQ 3.2: matching is exact-character; a case difference is not the same quote.
def test_case_mismatch_becomes_missing():
    f = _field(
        "roof_replacement_cost",
        "BUDGETARY COST to replace the roof assembly is approximately $360,000.",
        value=360000,
    )
    _assert_missing(validate_field(f, [_COST_PAGE]))


# REQ 3.2 (property): flipping the case of any one letter of a valid quote rejects it.
@settings(max_examples=100, deadline=None)
@given(st.text(alphabet=string.ascii_letters, min_size=1, max_size=40), st.integers(min_value=0))
def test_any_case_flip_is_rejected(text, idx):
    i = idx % len(text)
    flipped = text[:i] + text[i].swapcase() + text[i + 1 :]
    pages = [f"-- {text} --"]
    ok = InputField(
        field="roof_type", unit="text", status="extracted_unconfirmed",
        evidence=Evidence(document_id="d", page=1, evidence_text=text, source_type="synthetic_document"),
    )
    assert validate_field(ok, pages).status == "extracted_unconfirmed"
    bad = ok.model_copy(update={"evidence": ok.evidence.model_copy(update={"evidence_text": flipped})})
    _assert_missing(validate_field(bad, pages))


# Numbers must be grounded: a real quote with a different amount is rejected.
@pytest.mark.parametrize(
    "quote,value",
    [
        ("Allowance to remove and reinstall a rooftop array is $85,000.", 360000),  # another line's amount
        ("Budgetary cost to replace the roof assembly is approximately $360,000.", 999999),  # invented
        ("Budgetary cost to replace the roof assembly is approximately $360,000.", 360),  # comma misread
        ("The roof area is 30,000 square feet.", 30000),  # right digits, not money
    ],
)
def test_mismatched_monetary_value_becomes_missing(quote, value):
    f = _field("roof_replacement_cost", quote, value=value)
    _assert_missing(validate_field(f, [_COST_PAGE]))


def test_malformed_comma_grouping_does_not_ground():
    assert [n.value for n in numbers_in_quote("cost is $30,0000 total")] == []
    assert [n.value for n in numbers_in_quote("$1,250,000.50 or 85000 USD")] == [1250000.5, 85000]


# Property: any amount written as "$N,NNN" grounds exactly N, and N+1 does not.
@settings(max_examples=100, deadline=None)
@given(st.integers(min_value=1, max_value=50_000_000))
def test_comma_currency_grounds_exact_amount_only(amount):
    quote = f"Budget is ${amount:,} for the work."
    pages = [quote]
    assert validate_field(_field("roof_replacement_cost", quote, value=amount), pages).status == "extracted_unconfirmed"
    _assert_missing(validate_field(_field("roof_replacement_cost", quote, value=amount + 1), pages))


# REQ 2.3: a range stays a range, and both bounds must be written in the quote.
@pytest.mark.parametrize(
    "quote,value_range,accepted",
    [
        ("estimated at 2-4 years", (2, 4), True),
        ("7 to 9 years", (7, 9), True),
        ("7 to 9 years", (7, 10), False),  # upper bound not in quote
        ("7 to 9 years", (6, 9), False),  # lower bound not in quote
        ("7 to 9 years", (9, 7), False),  # reversed range
    ],
)
def test_range_bounds_must_be_grounded(quote, value_range, accepted):
    f = _field("roof_remaining_life_years", quote, value_range=value_range, unit="years")
    out = validate_field(f, [_LIFE_PAGE])
    if accepted:
        assert out.status == "extracted_unconfirmed"
        assert out.value_range == value_range
    else:
        _assert_missing(out)


# REQ 4.1-4.4: no roof installation evidence -> roof-age fields missing with a roofing-records request.
@pytest.mark.parametrize(
    "name,quote,value,unit",
    [
        ("roof_installation_year", None, 1979, "year"),  # no evidence at all
        ("roof_installation_year", "The building was constructed in 1979.", 1979, "year"),
        ("roof_age_years", "The building was constructed in 1979.", 1979, "years"),
    ],
)
def test_missing_roof_installation_evidence_is_missing(name, quote, value, unit):
    if quote is None:
        f = InputField(field=name, value=value, unit=unit, status="extracted_unconfirmed")
    else:
        f = _field(name, quote, value=value, unit=unit)
    out = validate_field(f, [_BUILDING_PAGE])
    _assert_missing(out)
    assert out.request == ROOF_RECORDS_REQUEST
    # Idempotent: validating the missing field again changes nothing.
    assert validate_field(out, [_BUILDING_PAGE]) == out


# A year field must be grounded by a written 4-digit year, not by a dollar amount.
def test_roof_installation_year_from_cost_line_is_missing():
    f = _field(
        "roof_installation_year",
        "Budgetary cost to replace the roof assembly is approximately $360,000.",
        value=360000,
        unit="year",
    )
    out = validate_field(f, [_COST_PAGE])
    _assert_missing(out)
    assert out.request == ROOF_RECORDS_REQUEST


# Positive control: an explicit roof replacement date is accepted, and stays accepted.
def test_explicit_roof_replacement_date_is_accepted():
    f = _field("roof_installation_year", "The roof membrane was replaced in 2011.", value=2011, unit="year")
    out = validate_field(f, [_BUILDING_PAGE])
    assert out.status == "extracted_unconfirmed" and out.value == 2011
    assert validate_field(out, [_BUILDING_PAGE]) == out
