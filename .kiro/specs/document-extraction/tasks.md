# Implementation Plan: Document Extraction (refactor of the existing branch)

## Overview

The `integrate` branch already has a first version of extraction. This plan refactors or replaces that code so it satisfies `requirements.md` and `design.md`. Every settled decision in the design stays as written. Nothing is rebuilt from scratch where existing code can be reshaped.

Existing code and what happens to it:

| Existing | Gap against the spec | Outcome |
|---|---|---|
| `src/extract/extract.py` `EXTRACTION_FIELDS` (5 names) | Wrong field set (`inspection_limitations`, `who_pays_electricity`), no units, no request texts | Replaced by `registry.py` (task 1.3) |
| `src/extract/extract.py` `read_pdf_pages` | No `%PDF-` check, pypdf errors leak, returns a list, no all-empty signal | Replaced by `pdf_reader.read_pdf` (task 3) |
| `src/extract/extract.py` `_build_prompt`, `_schema` | Asks the LLM for `unit`; no `text_value`; no end markers; schema not strict, `page` required | Replaced by `prompt.py` (task 5.2) |
| `src/extract/extract.py` `_to_input_field` | Unit taken from the LLM, `page` falls back to 0, strings coerced with `str()` | Replaced by `candidates.py` (task 5.1) |
| `src/extract/extract.py` `extract_fields` | Accepts any `pages`, no allowlist, no replay, no `ExtractionResult` | Replaced by `pipeline.run_extract` (task 10); file deleted in task 13.1 |
| `src/extract/validate.py` `normalize`, `quote_on_page` | Strips ends and lowercases both sides (case-insensitive match), against Req 3.13 | Rewritten as `collapse`, `quote_matches` (task 4.1) |
| `src/extract/validate.py` `validate_field`, `validate_fields(fields, pages)`, `revalidate` | No `document_id`, no slot, grounding or roof-age rules, does not fill omitted fields, requests built from the field name | Rewritten as `check`, `validate(fields, pages, document_id)` (task 4.3); legacy names deleted in task 13.1 |
| `src/llm.py` | One `LLMUnavailable` error, key checked inside the adapter, `response_format` `json_object` ignores the schema | Refactored in place (task 7.1); `call_llm(prompt, schema) -> dict` signature kept |
| `api/index.py` `POST /api/extract` | Multipart `UploadFile`, `document_id` from the upload filename, returns `page_count`, error text includes the exception | Replaced by the JSON route (task 13.1) |
| `requirements.txt` `python-multipart` | Only needed by the multipart route | Removed in task 13.1 |
| `data/fixtures/llm_extract.json`, `data/fixtures/roof_report_pages.json` | Describe a different document (`demo_roof_report.pdf`), not named `*.handmade.json` | Deleted in task 11.5 after their only user is gone |
| `tests/test_extract_properties.py` (5 tests), `tests/test_api.py::test_extract_rejects_pdf_with_no_text` | Conflict with the spec (see "Tests changed to match the spec") | Changed to match the spec (tasks 1.1 and 13.2) |
| `app/lib/api.ts` `extract(file: File)` | Sends `FormData`, expects `page_count` | Rewritten for the JSON request and new response (task 14) |

Ordering. The old `extract.py` and the legacy names in `validate.py` stay importable until task 13.1, because the current `/api/extract` route imports them. That keeps `python -m pytest -q` green at each checkpoint. Task 13.1 switches the route, then deletes the legacy code in the same step. The frontend change is last (task 14), and it runs the three final checks.

Every test sub-task is required. Each property test follows the code it tests and names its design property and requirement criteria. Tests never call the real LLM or the network. `src/contract.py` and `data/demo_documents/expected_fields.json` are never modified.

## Tests changed to match the spec

Each existing test below conflicts with the spec. The test is changed; the spec is not.

| Existing test | Conflict | Change | Task |
|---|---|---|---|
| `tests/test_extract_properties.py::test_extracted_fields_have_valid_citation_or_missing` | Lowercases and strips both quote and page before comparing (case-insensitive matching), against Req 3.13; uses the old 5-field set and the `demo_roof_report.pdf` fixtures | Removed; replaced by Property 1 (task 4.4) and the golden test (task 11.3), which compare with `collapse` only | 1.1 |
| `tests/test_extract_properties.py::test_fabricated_quote_becomes_missing` | Calls `validate_fields(fields, pages)` with no `document_id`; unit `"USD"` is not the registry unit `"USD (2024 real)"`; uses the old page fixture | Removed; replaced by Property 1 (task 4.4) and the `bad_quote` and `ungrounded_number` negative cases (task 11.4) | 1.1 |
| `tests/test_extract_properties.py::test_never_infers_roof_age_from_construction_year` | Checks `roof_remaining_life_years`, which is not a Roof_Age_Field, and asserts the field is absent; the spec requires both Roof_Age_Fields present as `missing` with the roofing-records request (Req 2.5, 4.1 to 4.3) | Removed; replaced by Property 2 (task 4.5) and the `roof_age_from_construction` and `roof_year_from_cost_line` cases (task 11.4) | 1.1 |
| `tests/test_extract_properties.py::test_validation_is_idempotent` | Uses `revalidate` on the old fixture output; the spec's idempotence is `validate(validate(x)) == validate(x)` for any input (Req 5) | Removed; replaced by Property 3 (task 4.6) | 1.1 |
| `tests/test_extract_properties.py::test_human_supplied_is_trusted` | Reads `[0]` of the output, but `validate` now returns all 10 fields in registry order; unit `"USD"` | Removed; the intent (Req 3.17) is covered by Property 4 (task 8.3) | 1.1 |
| `tests/test_api.py::test_extract_rejects_pdf_with_no_text` | Posts a multipart file upload, which is out of scope; accepts 400, which is not in the error table | Removed from `tests/test_api.py`; the no-text case moves to the pipeline example test (task 10.8), and endpoint behaviour moves to `tests/test_api_extract.py` (task 13.2) | 13.2 |

All other tests in `tests/test_api.py`, `tests/test_engine_*.py`, `tests/test_coordinator_properties.py`, and `app/lib/format.test.ts` are left unchanged.

## Tasks

- [ ] 1. Retire conflicting tests, then add shared types and the test harness
  - [ ] 1.1 Remove the five conflicting tests from `tests/test_extract_properties.py`
    - Delete the five tests listed in "Tests changed to match the spec", the module-level loads of `roof_report_pages.json` and `llm_extract.json`, and the import of `extract_fields`, `revalidate`, `validate_fields`
    - Keep the file with a docstring and a comment pointing to the properties added in tasks 3.2 onward
    - Leave `tests/test_api.py` unchanged until task 13.2, because the multipart route still exists until task 13.1
    - _Requirements: 3.13, 4.1, 4.3, 5.1, 9.1_

  - [ ] 1.2 Create `src/extract/errors.py`
    - `ExtractError(Exception)` with a `code: str`, and the subclasses `DocumentNotAllowedError` (`document_not_allowed`), `DocumentUnavailableError` (`document_unavailable`), `UnreadablePdfError` (`unreadable_pdf`), `NoExtractableTextError` (`no_extractable_text`), `FixtureMissingError` (`replay_fixture_missing`), `LlmSchemaError` (`llm_schema_invalid`), `LlmNotConfiguredExtractError` (`llm_not_configured`), `LlmUnavailableError` (`llm_unavailable`), `DocumentMismatchError` (`document_mismatch`), `InvalidPreviousError` (`invalid_previous`), and `InvalidActionError(index, field, reason)` (`invalid_action`)
    - Messages never include `LLM_API_KEY`, request headers, or the full prompt
    - _Requirements: 1.5, 1.6, 2.6, 6.12, 6.15, 7.6, 10.3, 10.7_

  - [ ] 1.3 Create `src/extract/registry.py` (replaces `EXTRACTION_FIELDS` in `extract.py`)
    - Frozen `FieldSpec(name, unit, kind, request, require_any, forbid, integral, roof_age)` and `SlotKind = Literal["number", "date", "text", "boolean"]`
    - Ordered `REGISTRY` in the order of `expected_fields.json`, plus `REGISTRY_BY_NAME`, with the units and kinds from the design's registry table
    - The old names map as follows: `inspection_limitations` becomes `structural_capacity_assessed` (`boolean`), `who_pays_electricity` becomes `tenant_electricity_arrangement` (`text`); the other three keep their names and gain spec units
    - Every spec has a non-empty `request`; `roof_replacement_cost` gets `require_any=(("roof",), ("replac",))` and `forbid=("reinstall", "panel")`; `building_construction_year` and `roof_installation_year` get `integral=True`
    - Both Roof_Age_Fields: `roof_age=True`, the design's `forbid` tuple, and `request == "Obtain roofing records; never infer from building construction."`; `roof_age_years` also gets `require_any=(("years old", "year-old", "roof age", "age of the roof"),)`
    - Leave `EXTRACTION_FIELDS` in `extract.py` untouched until task 13.1
    - _Requirements: 2.8, 2.9, 3.5, 4.3_

  - [ ] 1.4 Create `src/extract/models.py`
    - `StrictFiniteFloat`, `Quote` (strict string, max 2000 characters)
    - `ExtractionResult` (`extra="forbid"`; exactly `document_id`, `mode: Literal["live", "replay"]`, `fields`, `originals`, `sources` with `max_length=0`)
    - `EditEvidence`, `EditAction`, `ConfirmAction`, and the discriminated `Action` on `action`
    - `ExtractRequest` (`extra="forbid"`, `document_id` max length 200, `replay: bool = False`, optional `previous`, optional `actions` with max 20 items, and an after-validator that rejects `actions` without `previous`)
    - `LlmFieldClaim` (page has no lower bound) and `LlmExtraction`
    - Import `InputField` and `Evidence` from `src/contract.py` without changing it
    - _Requirements: 2.2, 7.2, 8.3, 10.1, 10.9_

  - [ ] 1.5 Create `tests/conftest.py` with the no-network guard and the fixture-replay LLM factory
    - Session-scoped autouse fixture using `pytest.MonkeyPatch()` that makes `socket.socket.connect` and `connect_ex` raise for `AF_INET` and `AF_INET6`, and deletes `LLM_PROVIDER` and `LLM_API_KEY` from the environment
    - Check that the existing `tests/test_api.py` (FastAPI `TestClient`, in-process) and `tests/test_coordinator_properties.py` (injected fake LLM) still pass under the guard
    - `FIXTURES_DIR` built from `Path(__file__)`; `fixture_llm(filename) -> LlmCallable` counts calls in `.calls`, raises `FixtureMissingError` when the file is absent, otherwise returns the file's `response` object; no live fallback
    - _Requirements: 9.1, 9.2, 9.3_

  - [ ] 1.6 Write example tests for the registry, models, and harness in `tests/test_extract_examples.py`
    - Registry has exactly the 10 Target_Fields in ground-truth order with the units of `expected_fields.json`; every `request` is non-empty; both Roof_Age_Fields carry the roofing-records request
    - `ExtractRequest(document_id="demo_pca.pdf").replay is False`
    - `ExtractRequest` with `actions` and no `previous` raises a pydantic `ValidationError`; unknown keys and an unknown `action` are rejected; a JSON boolean `value` in an Edit_Action is rejected
    - `ExtractionResult` with a non-empty `sources` is rejected
    - `fixture_llm("does_not_exist.handmade.json")` raises `FixtureMissingError` when called
    - An `AF_INET` socket connect inside a test raises
    - _Requirements: 8.3, 9.2, 9.3, 10.1, 10.9_

- [ ] 2. Add the document allowlist and replay loader (replaces `document_id = file.filename` in the current route)
  - [ ] 2.1 Create `src/extract/documents.py`
    - `DOCUMENT_ALLOWLIST = MappingProxyType({"demo_pca.pdf": "llm_extract_demo_pca.handmade.json"})` and `DOCUMENTS_DIR` built from `Path(__file__)`
    - `resolve_document(document_id, documents_dir=DOCUMENTS_DIR) -> Path`: the first statement is the dict membership test that raises `DocumentNotAllowedError`; no `Path` is built and no file touched before it
    - After the check, the resolved candidate's parent must equal the resolved `documents_dir` and the candidate must be a file; otherwise raise `DocumentUnavailableError`
    - _Requirements: 10.2, 10.3_

  - [ ] 2.2 Create `src/extract/replay.py`
    - `FIXTURES_DIR` built from `Path(__file__)`
    - `load_replay_fixture(document_id, fixtures_dir=FIXTURES_DIR) -> object` looks up the fixture name in `DOCUMENT_ALLOWLIST`, raises `FixtureMissingError(path)` if absent, raises `LlmSchemaError` for non-JSON content or a missing `response` key, and otherwise returns `response` unchanged
    - Never calls `call_llm` and never falls back to a live call
    - _Requirements: 10.4, 10.7, 10.8_

  - [ ] 2.3 Write example tests for the allowlist and replay loader in `tests/test_extract_examples.py`
    - `resolve_document("demo_pca.pdf")` returns the demo PDF path; `"../requirements.txt"`, an absolute path, `"DEMO_PCA.pdf"`, `" demo_pca.pdf"`, and `"upload.pdf"` (the old route's default) raise `DocumentNotAllowedError`
    - An allowlisted id with an empty temporary `documents_dir` raises `DocumentUnavailableError`
    - `load_replay_fixture` with an empty temporary `fixtures_dir` raises `FixtureMissingError`; invalid JSON or a missing `response` raises `LlmSchemaError`
    - Every value in `DOCUMENT_ALLOWLIST` ends with `.handmade.json` or `.recorded.json`
    - _Requirements: 10.2, 10.3, 10.7, 10.8_

- [ ] 3. Replace `read_pdf_pages` with the spec PDF reader
  - [ ] 3.1 Create `src/extract/pdf_reader.py`, porting the pypdf loop from `extract.read_pdf_pages`
    - Frozen `PdfText(page_texts: tuple[str, ...], page_count: int)` with a `has_text` property
    - `read_pdf(data: bytes) -> PdfText`: raise `UnreadablePdfError("not a PDF")` when `b"%PDF-"` is not in `data[:1024]`; wrap every pypdf or parsing exception, and `reader.is_encrypted`, in `UnreadablePdfError`
    - Keep the existing `page.extract_text() or ""` per page, stored exactly as returned with no strip, normalization, reordering, or re-encoding; keep an empty slot for a blank page
    - Return `PdfText(page_texts=(), page_count=n)` when every page is empty
    - Leave `read_pdf_pages` in `extract.py` until task 13.1
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [ ] 3.2 Write property test for non-PDF bytes in `tests/test_extract_properties.py`
    - **Property 23: Non-PDF bytes are rejected**
    - `st.binary()` filtered to inputs without `%PDF-` in the first 1024 bytes, plus truncations of the demo PDF that pypdf cannot parse (skip parseable cuts with `assume`); `read_pdf` raises `UnreadablePdfError`
    - Tag comment `# Feature: document-extraction, Property 23: Non-PDF bytes are rejected`; `@settings(max_examples=100, deadline=None)`
    - **Validates: Requirements 1.6**

  - [ ] 3.3 Write example tests for the PDF reader in `tests/test_extract_examples.py`
    - The demo PDF yields 3 pages, and page `n` contains `"n / 3"`
    - Output equals raw `PdfReader(...).pages[i].extract_text()` output character for character
    - A PDF built in memory with `pypdf.PdfWriter` that interleaves a blank page with demo pages yields an `""` entry and unchanged numbering for the other pages
    - An all-blank PDF yields `has_text is False` and `page_texts == ()`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ] 4. Rewrite the evidence validator in `src/extract/validate.py`
  - [ ] 4.1 Replace `normalize` and `quote_on_page` with the spec quote matching and add numeric grounding
    - `collapse(s) = re.sub(r"\s+", " ", s)` (no `.strip()`, no `.lower()`), `is_blank(quote)`, and `quote_matches(quote, page_text)`; case-insensitive matching is removed
    - `numbers_in(quote)`: collapse, remove every `$` and `,`, read `\d+(?:\.\d+)?` as floats
    - `RANGE_EXPR`, and `grounded(spec, f, quote)` with both range bounds required, the range-collapse guard for a single `value`, and date-year grounding
    - `terms_ok(spec, quote)` using casefold only for `require_any` and `forbid`
    - Keep the old `normalize` and `quote_on_page` bodies only under a `# legacy: removed in task 13.1` comment, because `extract.py` still imports `validate_fields`; no new code calls them
    - _Requirements: 2.3, 2.4, 3.13, 3.14, 3.15, 3.16_

  - [ ] 4.2 Add slot rules and the roof-age guard
    - `slots_ok(spec, f)`: exactly one Value_Slot populated; finite `value` or ordered finite `value_range` for `number`, whole numbers when `integral`; ISO `YYYY-MM-DD` accepted by `date.fromisoformat` for `date`; non-blank text for `text`; exactly `"true"` or `"false"` for `boolean`
    - `ROOF_EVENT`, `YEAR`, and `roof_date_stated(quote)` requiring `"roof"`, a roof event term, and a four-digit year
    - _Requirements: 2.3, 2.10, 2.11, 2.12, 3.8, 3.9, 3.10, 3.11, 4.7, 4.8_

  - [ ] 4.3 Replace `validate_field` / `validate_fields` / `revalidate` with `validate`, `check`, and `missing`
    - `validate(fields, pages, document_id)` keeps the first occurrence per registry name, ignores unknown names, and returns one field per registry entry in registry order (the old function returned only the fields it was given)
    - `check` follows the design algorithm: absent → missing with the spec request; `human_supplied` → unchanged; `missing` → canonical missing (roof-age fields always get the roofing-records request); otherwise reject unless slots, evidence presence, non-blank quote, `document_id`, `source_type == "synthetic_document"`, page range, `quote_matches`, `grounded`, `terms_ok`, and (for roof-age fields) `roof_date_stated` all pass
    - Requests come from the registry, never from `f"Provide a document stating {field.field}."` as before
    - An accepted field gets `unit=spec.unit` and `request=None`; `missing()` clears all slots and evidence and sets `confirmed_by_user=False`
    - Pure function: no I/O and no import of `src.llm`
    - Keep `validate_fields` and `revalidate` as legacy wrappers over the old `validate_field` until task 13.1, so the current route keeps working; no new code calls them
    - _Requirements: 2.5, 2.15, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.12, 3.17, 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 8.1_

  - [ ] 4.4 Write property test for evidence on accepted values in `tests/test_extract_properties.py`
    - **Property 1: Every accepted value has a page and a quote found on that page**
    - Generators `page_texts()`, `quote_for(pages)` (present, whitespace-varied, mutated including case flips, random, empty, whitespace-only, absent), and `claimed_page(n)` from -1 to n + 2 or `None`
    - Replaces `test_extracted_fields_have_valid_citation_or_missing` and `test_fabricated_quote_becomes_missing`; the assertion uses `collapse` only, never `.lower()`
    - **Validates: Requirements 2.15, 3.1, 3.2, 3.3, 3.4, 3.5, 8.1, 9.7**

  - [ ] 4.5 Write property test for roof age in `tests/test_extract_properties.py`
    - **Property 2: Roof age stays missing without an explicit roof date, regardless of construction year**
    - Generator `no_roof_date_document()` built from construction-year sentences with any year, "no roofing records" and "roof age unknown" sentences, roof cost lines with any amount and dollar year, remaining-life ranges, and digit-free filler; claims for both Roof_Age_Fields quote any line with any value, including the construction year and numbers derived from it
    - Asserts both Roof_Age_Fields are present in the output, `missing`, with slots and evidence unset and the roofing-records request (replaces `test_never_infers_roof_age_from_construction_year`)
    - Separately, any Roof_Age_Field candidate whose quote fails `roof_date_stated` comes back missing with that request
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.7, 9.5**

  - [ ] 4.6 Write property test for idempotence in `tests/test_extract_properties.py`
    - **Property 3: Validating an already validated extraction returns the same result**
    - Assert `validate(validate(x)) == validate(x)` on all nine InputField attributes, and that two calls of `validate(x)` return equal results (replaces `test_validation_is_idempotent`)
    - **Validates: Requirements 3.6, 5.1, 5.2, 5.3, 5.4, 9.6**

  - [ ] 4.7 Write property test for the output shape in `tests/test_extract_properties.py`
    - **Property 5: Output shape invariant**
    - **Validates: Requirements 2.12, 3.5, 3.12**

  - [ ] 4.8 Write property test for slot kinds in `tests/test_extract_properties.py`
    - **Property 6: The populated slot must match the field's kind**
    - Generator `slot_assignment(kind)` with zero to three slots populated and matching or mismatching values
    - **Validates: Requirements 2.8, 2.9, 3.10, 3.11**

  - [ ] 4.9 Write property test for date and boolean formats in `tests/test_extract_properties.py`
    - **Property 7: Date and boolean formats are enforced**
    - Include `"2026-13-01"`, `"Oct 24 2026"`, `"True"`, `"no"`, `" false"` via `@example`
    - **Validates: Requirements 2.10, 2.11, 3.8, 3.9**

  - [ ] 4.10 Write property test for ranges in `tests/test_extract_properties.py`
    - **Property 8: Ranges stay ordered ranges and are never collapsed**
    - **Validates: Requirements 2.3**

  - [ ] 4.11 Write property test for numeric grounding in `tests/test_extract_properties.py`
    - **Property 9: Numeric grounding (Req 3.16)**
    - **Validates: Requirements 2.4, 3.16**

  - [ ] 4.12 Write property test for quote matching in `tests/test_extract_properties.py`
    - **Property 10: Quote matching collapses whitespace and nothing else**
    - Includes a case-flipped quote that must come back `missing`, the behaviour the old validator got wrong
    - **Validates: Requirements 3.13, 3.14, 3.15**

  - [ ] 4.13 Write example tests for the validator on the demo PDF in `tests/test_extract_examples.py`
    - All 8 ground-truth quotes from `expected_fields.json` match their cited pages under `quote_matches`
    - `quote_matches("No roofing installation records were supplied.", page_1)` is true although page 1 has `"\n"` after "installation"
    - `quote_matches("roof type: low-slope modified-bitumen membrane.", page_2)` is false (no case folding)
    - `numbers_in("Estimated roof replacement cost: $300,000 (2024 dollars).") == {300000.0, 2024.0}`; `roof_date_stated` is false for each roof-age trap sentence listed in the design
    - _Requirements: 3.13, 3.14, 3.16, 4.1, 4.7_

- [ ] 5. Replace the candidate mapping and prompt from `extract.py`
  - [ ] 5.1 Create `src/extract/candidates.py` (replaces `_to_input_field`)
    - `parse_llm_output(raw) -> LlmExtraction`: a non-dict `raw` or a pydantic `ValidationError` raises `LlmSchemaError` with the validation messages and no partial result (the old code accepted a JSON string and any dict)
    - `to_candidates(claims, document_id) -> list[InputField]`: drop unknown field names, keep the first occurrence, set `unit=spec.unit` (never the LLM's `unit`), `status="extracted_unconfirmed"`, copy slots unchanged (no `float()` or `str()` coercion), and set `Evidence(document_id, page, quote, "synthetic_document")` only when `page` is an int >= 1 and `quote` is a string (no `page=0` fallback)
    - _Requirements: 2.4, 2.5, 2.6, 2.7, 3.3, 3.4, 3.15_

  - [ ] 5.2 Create `src/extract/prompt.py` (replaces `_build_prompt` and `_schema`)
    - `build_prompt(pdf: PdfText) -> str` with the data-not-instructions statement, one `=== PAGE {n} ===` / `=== END PAGE {n} ===` block per page, the registry fields with unit and target slot, and the design's extraction rules (verbatim quotes, no computed numbers, ranges as `[low, high]`, booleans as `"true"`/`"false"`, roof age only from an explicit roof date, unstated fields returned with nulls, each field once)
    - `LLM_EXTRACTION_SCHEMA` in the strict-mode subset: required `fields` array; each item requires `field`, `value`, `value_range`, `text_value`, `page` (`minimum: 1` or null), and `quote`, with `additionalProperties: false`; no `unit` key
    - _Requirements: 2.2, 2.3, 2.13, 2.14_

  - [ ] 5.3 Write property test for omitted fields in `tests/test_extract_properties.py`
    - **Property 11: Omitted fields become missing and the rest are unchanged**
    - Generator `llm_raw_valid()`; run `parse_llm_output`, `to_candidates`, and `validate`
    - **Validates: Requirements 2.5**

  - [ ] 5.4 Write property test for unknown field names in `tests/test_extract_properties.py`
    - **Property 12: Unknown field names are discarded**
    - **Validates: Requirements 2.7**

  - [ ] 5.5 Write example tests for the schema and prompt in `tests/test_extract_examples.py`
    - `LLM_EXTRACTION_SCHEMA` requires the six item keys, sets `additionalProperties: false`, and gives `page` a `minimum` of 1
    - `build_prompt(read_pdf(demo_bytes))` contains the data-not-instructions statement and every page's text between its markers
    - _Requirements: 2.2, 2.13, 2.14_

- [ ] 6. Checkpoint - core extraction
  - Ensure all tests pass with `python -m pytest -q`; the legacy route and `tests/test_api.py` still pass. Ask the user if questions arise.

- [ ] 7. Refactor `src/llm.py` in place
  - [ ] 7.1 Bring `src/llm.py` in line with the design, keeping `call_llm(prompt: str, schema: dict) -> dict`
    - Replace `LLMUnavailable` with `LlmNotConfiguredError`, `LlmCallError`, `LlmOutputError` (nothing else in the repo imports `LLMUnavailable`); drop the unused `LLMCallable` protocol
    - `call_llm` reads `LLM_PROVIDER` and `LLM_API_KEY` at call time and raises `LlmNotConfiguredError` when either is unset or the provider is unknown (the key check moves out of the adapter)
    - The `"openai"` adapter keeps httpx, `temperature=0`, the 60 s timeout, and the `LLM_MODEL` default; adds optional `LLM_BASE_URL`; switches `response_format` from `json_object` to `{"type": "json_schema", "json_schema": {"name": "extraction", "schema": schema, "strict": True}}`; raises `LlmOutputError` when the content is not a JSON object and `LlmCallError` on transport errors, timeouts, or non-2xx
    - The key is never logged or included in exception messages
    - `src/coordinator/coordinate.py` keeps calling `call_llm(prompt, schema)` unchanged; see the open question on its `{"type": "object"}` schema
    - _Requirements: 2.1, 2.2, 2.6_

  - [ ] 7.2 Write example tests for `src/llm.py` in `tests/test_extract_examples.py`
    - With the environment cleared by the conftest guard, `call_llm` raises `LlmNotConfiguredError`; an unknown provider raises the same error
    - With the httpx call patched to a fake (no network), the adapter sends a strict `json_schema` response format and `temperature=0`, returns the parsed object, raises `LlmOutputError` for non-object content, and raises `LlmCallError` for a non-2xx response; no exception message contains the test key
    - Importing `src.extract` needs no key
    - _Requirements: 2.1, 2.6, 9.2_

- [ ] 8. Add human actions in `src/extract/actions.py` (new; the old route had no edit or confirm path)
  - [ ] 8.1 Implement the Edit_Action branch of `apply_action`
    - Reject unknown fields; route a number to `value` and a `[low, high]` pair to `value_range` for a `number` field and a string to `text_value` for `date`, `text`, and `boolean` fields; reject any other combination
    - The new field must pass `slots_ok`
    - Edit evidence: optional `document_id` must equal the request `document_id`, `page` must be within the page count, and `quote_matches` must hold; store `Evidence(document_id=<request document_id>, page, evidence_text=quote, source_type="synthetic_document")`
    - A Roof_Age_Field edit without evidence is invalid
    - The edited field is `human_supplied` with `confirmed_by_user=True`, `request=None`, and the other two slots cleared; `originals` gains the pre-edit field only when the field has no entry yet
    - Raise `InvalidActionError(index, field, reason)` without changing the input
    - _Requirements: 4.6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.13, 6.14, 6.16, 6.17_

  - [ ] 8.2 Implement the Confirm_Action branch, `apply_actions`, and `check_previous`
    - Confirm: reject unknown fields and `missing` fields; `extracted_unconfirmed`, `conflicting`, and `confirmed` become `confirmed` with `confirmed_by_user=True`; `human_supplied` stays `human_supplied` with `confirmed_by_user=True`; slots, evidence, and `originals` unchanged
    - `apply_actions(result, actions, pdf)` folds `apply_action` and returns only when every action succeeds; any error propagates and no partial result is returned
    - `check_previous(previous)` raises `InvalidPreviousError` for a `human_supplied` field that fails `slots_ok`, has a unit different from the registry, or is a Roof_Age_Field without evidence
    - _Requirements: 4.6, 6.4, 6.7, 6.8, 6.9, 6.10, 6.12, 6.18, 6.19_

  - [ ] 8.3 Write property test for human edits in `tests/test_extract_properties.py`
    - **Property 4: A human edit marks the field human_supplied and keeps the original extraction**
    - Generators `validated_result()` and `valid_action(result, pdf)`; re-running `validate` returns the edited field unchanged (covers the intent of the removed `test_human_supplied_is_trusted`)
    - **Validates: Requirements 3.17, 6.1, 6.2, 6.3, 6.13, 8.2, 9.8**

  - [ ] 8.4 Write property test for action isolation in `tests/test_extract_properties.py`
    - **Property 15: An action changes only its own field**
    - **Validates: Requirements 6.4**

  - [ ] 8.5 Write property test for repeated edits in `tests/test_extract_properties.py`
    - **Property 16: Editing an edited field keeps the first original**
    - **Validates: Requirements 6.6**

  - [ ] 8.6 Write property test for confirm in `tests/test_extract_properties.py`
    - **Property 17: Confirm changes status only**
    - **Validates: Requirements 6.7, 6.9, 6.10, 6.19**

  - [ ] 8.7 Write property test for invalid actions in `tests/test_extract_properties.py`
    - **Property 18: Invalid actions are rejected whole**
    - Generator `invalid_action(result, pdf)` covering unknown field, wrong kind, non-ISO date, bad boolean, `lo > hi`, non-integral year, confirm on `missing`, roof-age edit without evidence, and edit evidence not on the cited page; assert the error's index and field and that the input result is unchanged
    - **Validates: Requirements 6.5, 6.8, 6.12, 6.14, 6.16**

- [ ] 9. Add the sources guard
  - [ ] 9.1 Create `src/extract/sources.py`
    - `ensure_sourced(fields)` replaces any `extracted_unconfirmed`, `confirmed`, or `conflicting` field without evidence with `missing(spec, spec.request)` and returns every other field unchanged; it never raises and does not import `src.llm`
    - _Requirements: 4.6, 8.2, 8.4, 8.5_

- [ ] 10. Replace `extract_fields` with the pipeline and rewire the package
  - [ ] 10.1 Create `src/extract/pipeline.py` and update `src/extract/__init__.py`
    - `LlmCallable`, `obtain_raw(pdf, document_id, *, replay, llm, fixtures_dir)` (replay loads the fixture and never calls `llm`; live calls `llm(build_prompt(pdf), LLM_EXTRACTION_SCHEMA)` exactly once)
    - `extract_from_raw(raw, pdf, document_id)` = `validate(to_candidates(parse_llm_output(raw).fields, document_id), pdf.page_texts, document_id)`
    - `run_extract(req, *, llm=call_llm, documents_dir=DOCUMENTS_DIR, fixtures_dir=FIXTURES_DIR)` following the design's seven steps: `resolve_document` first; for `previous`, `DocumentMismatchError` then `check_previous`; `read_pdf` and `NoExtractableTextError`; live or replay extraction with `originals = {}`; or round trip with `validate(previous.fields)` and `apply_actions` and no LLM call or fixture load; `ensure_sourced`; `mode` from `req.replay`; `sources=[]`
    - `call_llm` is the default argument, replacing the lazy `from src.llm import call_llm as llm` inside `extract_fields`
    - Wrap `LlmOutputError` as `LlmSchemaError`, `LlmNotConfiguredError` as `LlmNotConfiguredExtractError`, and `LlmCallError` as `LlmUnavailableError`
    - `__init__.py` re-exports `run_extract`, `validate`, `apply_action`, `apply_actions`, the models, and `ExtractError`; it keeps the legacy exports (`read_pdf_pages`, `extract_fields`, `EXTRACTION_FIELDS`, `validate_field`, `validate_fields`, `revalidate`) only until task 13.1
    - _Requirements: 1.5, 2.1, 2.6, 6.11, 6.15, 6.20, 6.21, 7.1, 7.4, 8.3, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [ ] 10.2 Write property test for LLM call counts in `tests/test_extract_properties.py`
    - **Property 13: LLM call count per request kind**
    - Counting fake returning valid, partially empty, or schema-invalid responses; live calls exactly once whether it returns or raises; replay and round trip call zero times
    - **Validates: Requirements 2.1, 6.11, 6.20, 6.21, 7.1, 10.4**

  - [ ] 10.3 Write property test for schema rejection in `tests/test_extract_properties.py`
    - **Property 14: Non-conforming LLM output is rejected whole**
    - Generator `llm_raw_invalid()`; both `parse_llm_output` and `run_extract` raise `LlmSchemaError` with no fields returned
    - **Validates: Requirements 2.6**

  - [ ] 10.4 Write property test for replay and live parity in `tests/test_extract_properties.py`
    - **Property 19: Replay equals live for the same response**
    - Write the generated response to `<tmpdir>/llm_extract_demo_pca.handmade.json` inside `tempfile.TemporaryDirectory()` and pass `fixtures_dir=<tmpdir>`; both runs use the real demo PDF
    - **Validates: Requirements 9.4, 10.4, 10.5, 10.6**

  - [ ] 10.5 Write property test for the allowlist in `tests/test_extract_properties.py`
    - **Property 20: Non-allowlisted documents are rejected before any file access**
    - Patch `pathlib.Path.read_bytes`, `read_text`, `open`, `resolve`, `is_file`, and `builtins.open` with recording functions that raise, using `unittest.mock.patch` context managers; assert none was called and the LLM fake was called zero times
    - **Validates: Requirements 10.2, 10.3**

  - [ ] 10.6 Write property test for empty sources in `tests/test_extract_properties.py`
    - **Property 21: Sources are always empty**
    - **Validates: Requirements 8.3, 8.4**

  - [ ] 10.7 Write property test for the sourced guard in `tests/test_extract_properties.py`
    - **Property 22: Unsourced extracted fields become missing**
    - Covers `ensure_sourced` directly and every Roof_Age_Field in `run_extract` results
    - **Validates: Requirements 4.6, 8.5**

  - [ ] 10.8 Write pipeline, round-trip, and import-scan example tests in `tests/test_extract_examples.py`
    - An all-blank in-memory PDF passed through `run_extract` (via a temporary `documents_dir`) raises `NoExtractableTextError` with the LLM fake called 0 times (takes over from `tests/test_api.py::test_extract_rejects_pdf_with_no_text`)
    - A `previous` whose `roof_type` quote was tampered with comes back with `roof_type` missing, and a confirm on it raises `InvalidActionError`
    - A `previous` with a different `document_id` raises `DocumentMismatchError`; a `previous` with a `human_supplied` roof-age field without evidence raises `InvalidPreviousError`
    - A round trip with `replay=False` returns `mode == "live"` and one with `replay=True` returns `mode == "replay"`, both with 0 fake calls
    - AST scan: no module under `src/` imports `api` or `app`; `validate.py`, `actions.py`, and `sources.py` do not import `src.llm`
    - _Requirements: 1.5, 3.7, 6.11, 6.15, 6.18, 6.20, 6.21, 7.4_

- [ ] 11. Replace the old fixtures and add golden tests
  - [ ] 11.1 Create `data/fixtures/llm_extract_demo_pca.handmade.json`
    - Shape `{"document_id": "demo_pca.pdf", "response": {"fields": [...]}}` with all 10 fields, hand-authored from `expected_fields.json` using the exact ground-truth quotes and pages
    - Numbers in `value` or `value_range`; dates, text, and booleans (`"false"`) in `text_value`; both Roof_Age_Fields with all values, `page`, and `quote` null; no `unit` and no `_meta` keys
    - Name it `*.handmade.json`, never `*.recorded.json`; do not modify `expected_fields.json`
    - _Requirements: 9.1, 9.4, 10.4, 10.8_

  - [ ] 11.2 Create `data/fixtures/llm_extract_negative.handmade.json`
    - An object of named cases, each a full `response`: `bad_quote`, `case_changed_quote`, `whitespace_quote`, `wrapped_quote`, `wrong_page`, `page_out_of_range`, `wrong_slot`, `two_slots`, `extra_field`, `collapsed_range`, `ungrounded_number`, `removal_cost_trap`, `roof_age_from_construction`, `roof_year_from_cost_line`, `not_json_schema`, with the content in the design's negative fixture table
    - _Requirements: 2.3, 2.4, 2.6, 2.7, 3.1, 3.2, 3.3, 3.4, 3.10, 3.11, 3.13, 3.14, 3.16, 4.2, 4.7, 10.8_

  - [ ] 11.3 Write the golden test in `tests/test_extract_examples.py`
    - Run `run_extract(ExtractRequest(document_id="demo_pca.pdf", replay=True), llm=counting_fake)`
    - Normalize each `expected_fields.json` entry: numeric units keep `value`; `date` and `text` move `value` to `text_value` unchanged; `boolean` moves `value` to `text_value` as `"true"` or `"false"`; `value_range` compared as stored
    - Assert exact equality per field on `field`, `status`, `value`, `text_value`, `value_range` (numeric bounds), `unit`, `evidence`, and `request`; assert `mode == "replay"`, `sources == []`, `originals == {}`, exactly the five response keys, and `counting_fake.calls == 0`
    - Check the ground-truth file's SHA-256 before and after; never write it
    - _Requirements: 4.1, 4.3, 4.4, 4.5, 8.1, 8.3, 9.4, 9.5, 9.9, 9.10, 10.4, 10.5_

  - [ ] 11.4 Write negative-fixture and fixture-naming tests in `tests/test_extract_examples.py`
    - One parametrized test over the cases in `llm_extract_negative.handmade.json`, running each case's `response` through `run_extract` in replay mode from a temporary `fixtures_dir`, and asserting the outcome in the design table; `wrapped_quote` keeps `evidence_text` exactly as supplied; `case_changed_quote` comes back `missing`; in every non-error case the other fields equal the golden result; `not_json_schema` raises `LlmSchemaError`
    - Every LLM fixture under `data/fixtures/` whose name starts with `llm_` ends with `.handmade.json` or `.recorded.json`, and no hand-made fixture ends with `.recorded.json`
    - _Requirements: 2.3, 2.4, 2.6, 2.7, 3.1, 3.2, 3.3, 3.4, 3.10, 3.11, 3.13, 3.14, 3.15, 3.16, 4.2, 4.7, 9.1, 10.8_

  - [ ] 11.5 Delete `data/fixtures/llm_extract.json` and `data/fixtures/roof_report_pages.json`
    - First confirm with a repo-wide search that no code or test still reads them (task 1.1 removed their only user)
    - They describe `demo_roof_report.pdf`, not the Demo_Document, and `llm_extract.json` breaks the fixture naming rule
    - _Requirements: 9.1, 10.8_

- [ ] 12. Checkpoint - before the API route
  - Ensure all tests pass with `python -m pytest -q`; ask the user if questions arise.

- [ ] 13. Replace the multipart `POST /api/extract` with the JSON route and remove legacy code
  - [ ] 13.1 Replace the route in `api/index.py`, then delete the legacy extraction code
    - Confirm `api/index.py` defines the FastAPI `app` (it does on this branch); do not recreate it
    - Delete `post_extract(file: UploadFile)` and the `UploadFile` import; replace `from src.extract import extract_fields` with the design's imports
    - Add `get_llm() -> LlmCallable` returning `call_llm`, the `EXTRACT_ERROR_STATUS` table from the design's Error Handling section, and a plain `def` route `@app.post("/api/extract", response_model=ExtractionResult)` taking `ExtractRequest` as the JSON body, calling `run_extract(req, llm=llm)` once, mapping `ExtractError` subtypes to `{"detail": {"error": code, "message": ...}}`, and mapping any other exception to 500 `extraction_failed` with a generic message and a server-side log (the old route echoed the exception text)
    - The route performs no extraction, validation, or calculation; leave `/api/constants`, `/api/engine`, `/api/engine/sweep`, `/api/coordinate`, `/api/health`, and `src/contract.py` unchanged; update the module docstring line for `/api/extract`
    - Delete `src/extract/extract.py`; delete the legacy `normalize`, `quote_on_page`, `validate_field`, `validate_fields`, and `revalidate` from `validate.py`; remove the legacy re-exports from `src/extract/__init__.py`
    - Remove `python-multipart` from `requirements.txt` after a search confirms nothing else uses `UploadFile`, `Form`, or `File`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 10.3_

  - [ ] 13.2 Write endpoint tests in `tests/test_api_extract.py` and change `tests/test_api.py`
    - Remove `test_extract_rejects_pdf_with_no_text` from `tests/test_api.py` and drop the extract wording from its module docstring; its no-text case is covered by task 10.8
    - Override `get_llm` with a counting fake via `app.dependency_overrides`; wrap `run_extract` with a spy where needed
    - `{"document_id": "demo_pca.pdf", "replay": true}` returns 200 with exactly the five keys, `run_extract` called once, and `fields` equal to `run_extract(...).model_dump(mode="json")["fields"]`; a live request with a fake returning the replay fixture's response calls the fake once
    - Round trip: send the 200 response back as `previous` with one valid edit and one valid confirm; 0 fake calls, edited field `human_supplied`, confirmed field `confirmed`, `originals` holds the pre-edit field; a list with one invalid action returns 422 `invalid_action` and applies nothing
    - Invalid JSON, `{}`, an unknown key, `actions` without `previous`, and a multipart body with a `file` part each return 422 with `run_extract` not called; `{"document_id": "../requirements.txt"}` returns 403 `document_not_allowed`
    - Fakes raising each `ExtractError` subtype, or a plain `RuntimeError`, return the mapped status with `{"detail": {"error": ...}}` and no `fields` key
    - Run the whole suite with `python -m pytest -q` and ensure it passes
    - _Requirements: 6.11, 6.12, 7.1, 7.2, 7.3, 7.5, 7.6, 10.3, 10.9_

- [ ] 14. Update the frontend to the new response shape and run the final checks (last)
  - [ ] 14.1 Rewrite `extract` in `app/lib/api.ts` and update every caller
    - Add TypeScript types next to the client (not in `contract.ts`, which mirrors only `src/contract.py`): `ExtractionResult { document_id: string; mode: 'live' | 'replay'; fields: InputField[]; originals: Record<string, InputField>; sources: string[] }`, `EditEvidence`, `EditAction`, `ConfirmAction`, `ExtractAction`, and `ExtractRequest { document_id; replay?; previous?; actions? }`, matching `src/extract/models.py`
    - Replace `extract(file: File)` with `extract(req: ExtractRequest): Promise<ExtractionResult>` that POSTs JSON with `Content-Type: application/json`; remove `FormData` and `page_count`
    - Update `jsonOrThrow` so an object `detail` (`{error, message}`) or FastAPI's 422 list renders as readable text instead of `[object Object]`
    - Search `app/` for every import or use of `extract`, `page_count`, and `FormData`, and update each caller to the new request and response. On this branch the search finds no component that imports `extract` (the Evidence page reads fields from `/api/constants`), so only `api.ts` changes unless a caller appears before this task runs
    - Do not add a calculation to the UI and do not change `app/lib/contract.ts`
    - _Requirements: 7.2_

  - [ ] 14.2 Run the three final checks; all must pass
    - `python -m pytest -q`
    - `npm test`
    - `npx next build`
    - Fix any failure at its source and re-run all three; report the result of each
    - _Requirements: 7.2, 9.2_

## Notes

- No task is optional. Every property test and example test is a required sub-task.
- Properties 1 to 4 are the user-supplied Hypothesis properties (tasks 4.4, 4.5, 4.6, 8.3).
- Hypothesis tests use `@settings(max_examples=100, deadline=None)` or more, carry the tag comment `# Feature: document-extraction, Property {n}: {title}`, and avoid function-scoped pytest fixtures.
- Tests never call the real LLM or the network; the conftest guard from task 1.5 enforces this.
- `src/contract.py` and `data/demo_documents/expected_fields.json` are never modified. Hand-made fixtures are never named `*.recorded.json`.
- `call_llm(prompt, schema) -> dict` in `src/llm.py` keeps its signature. The coordinator's call site is not changed.
- Task 13 does not create `api/index.py` or the FastAPI `app`; it replaces one route in the existing file.
- File upload is out of scope. After task 13.1 `/api/extract` accepts only the JSON Extraction_Request.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4"] },
    { "id": 1, "tasks": ["1.5", "2.1", "3.1", "4.1"] },
    { "id": 2, "tasks": ["1.6", "2.2", "4.2", "5.2"] },
    { "id": 3, "tasks": ["2.3", "3.2", "4.3", "5.1"] },
    { "id": 4, "tasks": ["3.3", "4.4", "4.5", "4.6", "4.7"] },
    { "id": 5, "tasks": ["4.8", "4.9", "4.10", "4.11", "4.12", "4.13"] },
    { "id": 6, "tasks": ["5.3", "5.4", "5.5"] },
    { "id": 7, "tasks": ["6"] },
    { "id": 8, "tasks": ["7.1", "8.1", "9.1"] },
    { "id": 9, "tasks": ["7.2", "8.2"] },
    { "id": 10, "tasks": ["8.3", "8.4", "8.5", "8.6", "8.7"] },
    { "id": 11, "tasks": ["10.1", "11.1", "11.2"] },
    { "id": 12, "tasks": ["10.2", "10.3", "10.4", "10.5", "10.6", "10.7", "10.8"] },
    { "id": 13, "tasks": ["11.3", "11.4", "11.5"] },
    { "id": 14, "tasks": ["12"] },
    { "id": 15, "tasks": ["13.1"] },
    { "id": 16, "tasks": ["13.2"] },
    { "id": 17, "tasks": ["14.1"] },
    { "id": 18, "tasks": ["14.2"] }
  ]
}
```
