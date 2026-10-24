# Design Document: Document Extraction

## Overview

Document extraction turns the synthetic diligence PDF `data/demo_documents/demo_pca.pdf` into a list of evidence-backed `InputField` objects (frozen contract `src/contract.py`, not changed by this feature). The pipeline has five steps:

1. Check the `document_id` against a fixed in-code allowlist, then read the PDF page by page with pypdf.
2. Obtain the raw LLM output: in a Live_Extraction, build one prompt and call `call_llm(prompt, schema)` in `src/llm.py` exactly once; in a Replay_Extraction, load the `response` object of the hand-made Replay_Fixture instead and never call `call_llm`.
3. Parse the raw output against a strict parse model and turn it into candidate `InputField`s. Units come from an in-code field registry, never from the LLM.
4. Validate every candidate in deterministic Python. A field keeps a value only if its quote matches the claimed page after whitespace collapse, its numbers appear in the quote, and it passes the field's grounding rules. Otherwise it becomes `missing` with a `request`.
5. Return an `ExtractionResult` with exactly the keys `document_id`, `mode`, `fields`, `originals`, and `sources` (always `[]`).

The same endpoint, `POST /api/extract`, also takes a previous `ExtractionResult` plus a list of human Actions (edit or confirm). That round trip re-validates the previous fields against the page text, applies the Actions all-or-nothing, and makes no LLM call.

`POST /api/extract` is added to the existing `api/index.py`. The route parses the request, calls one function in `src/extract/`, and maps errors to HTTP codes.

The validator is a pure function `validate(fields, pages, document_id)` with `validate(validate(x)) == validate(x)`. It leaves `human_supplied` fields unchanged (Req 3.17). Human actions go through a pure `apply_action`, which is the only place slot, format, and evidence rules are enforced for edits.

### Research findings that shape the design

- **Demo PDF text (pypdf 6.19.0 `extract_text()`, run locally).** There are 3 pages, and lines are separated by `"\n"`. All 8 ground-truth quotes sit on a single line, but other useful sentences wrap. For example, page 1 has `"No roofing installation\nrecords were supplied."`, and page 2 has `"The $300,000 synthetic replacement allowance represents one roof replacement and includes an\nassumed general removal and replacement scope."`. Whitespace-collapse matching (Req 3.13, 3.14) lets such quotes match. The document contains traps that the grounding rules below handle:
  - Page 2: "Year 3 is the selected planning scenario within the 2-to-4-year range." This must not collapse `roof_remaining_life_years` to 3.
  - Page 2: "$75,000 for panel removal and\nreinstallation". This is not the roof replacement cost.
  - Page 2: "Estimated roof replacement cost: $300,000 (2024 dollars)." The number 2024 must not become a roof installation year.
  - Page 1: "The building was constructed in 1979." Page 1: "Historic reroofing dates, warranty records and membrane age remain unknown." Page 3: "Roof age remains unknown." Roof age must stay missing.
  - The page header "2026-10-24" appears on every page.
- **pypdf text extraction** ([pypdf docs](https://pypdf.readthedocs.io/en/latest/user/extract-text.html)). `PageObject.extract_text()` returns the page's text in plain mode by default. Output can vary between pypdf versions (`requirements.txt` pins only `pypdf>=4`), so the golden test checks fixture quotes against the text produced by the installed version and fails loudly if a quote stops matching.
- **Structured output** ([OpenAI structured outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs)). `response_format` with `type: json_schema` and `strict: true` constrains the model to the supplied schema, as long as the schema stays inside the supported subset. The parse step still validates in Python, because providers differ and constraints such as `maxLength` may not be enforced upstream.
- **Vercel Python runtime** ([Vercel Python runtime docs](https://vercel.com/docs/functions/runtimes/python)). Python functions bundle every file reachable at build time, and relative `open()` paths resolve from the project root. `data/demo_documents/` and `data/fixtures/` are therefore available at runtime. Paths are still built from `Path(__file__)` so they do not depend on the working directory.

## Architecture

```mermaid
flowchart LR
    UI[Frontend app/] -->|POST /api/extract JSON| API[api/index.py<br/>route added to existing app]
    API -->|run_extract once| PIPE[src/extract/pipeline.py]
    PIPE --> DOC[documents.py<br/>DOCUMENT_ALLOWLIST + resolve_document]
    PIPE --> PDF[pdf_reader.py<br/>read_pdf]
    PIPE --> REP[replay.py<br/>load_replay_fixture]
    PIPE --> PR[prompt.py<br/>build_prompt + schema]
    PIPE -->|llm callable, injected| LLM[src/llm.py<br/>call_llm]
    PIPE --> CAND[candidates.py<br/>parse_llm_output + to_candidates]
    PIPE --> VAL[validate.py<br/>validate + quote_matches + grounded]
    PIPE --> ACT[actions.py<br/>apply_action + apply_actions]
    PIPE --> SRC[sources.py<br/>ensure_sourced]
    VAL --> REG[registry.py<br/>10 Target_Fields]
    CAND --> REG
    ACT --> REG
    ACT --> VAL
    PR --> REG
```

```mermaid
sequenceDiagram
    participant API as api/index.py
    participant P as run_extract
    participant R as load_replay_fixture
    participant L as llm(prompt, schema)
    API->>P: ExtractRequest
    P->>P: resolve_document (allowlist, before any file access)
    P->>P: read_pdf
    alt previous is None and replay is false
        P->>L: exactly one call
        L-->>P: raw dict
        P->>P: parse_llm_output, to_candidates, validate
    else previous is None and replay is true
        P->>R: load response object (no LLM call)
        R-->>P: raw dict
        P->>P: parse_llm_output, to_candidates, validate
    else previous given (Action_Round_Trip)
        P->>P: check document_id match, check_previous
        P->>P: validate(previous.fields) (no LLM call)
        P->>P: apply_actions (all-or-nothing)
    end
    P->>P: ensure_sourced, sources = []
    P-->>API: ExtractionResult {document_id, mode, fields, originals, sources}
```

### File layout (owner B)

```
src/llm.py                    # call_llm(prompt, schema) -> dict (the only LLM call site)
src/extract/__init__.py       # re-exports run_extract, validate, apply_action, apply_actions, models
src/extract/errors.py         # exception hierarchy (see Error Handling)
src/extract/registry.py       # FieldSpec table of the 10 Target_Fields
src/extract/models.py         # ExtractionResult, EditAction, ConfirmAction, Action, ExtractRequest, LlmFieldClaim, LlmExtraction
src/extract/documents.py      # DOCUMENT_ALLOWLIST, resolve_document(document_id) -> Path
src/extract/replay.py         # load_replay_fixture(document_id) -> object
src/extract/pdf_reader.py     # read_pdf(bytes) -> PdfText
src/extract/prompt.py         # build_prompt(pdf) -> str, LLM_EXTRACTION_SCHEMA
src/extract/candidates.py     # parse_llm_output(raw) -> LlmExtraction, to_candidates(...) -> list[InputField]
src/extract/validate.py       # validate(...), collapse, quote_matches, numbers_in, grounded, slots_ok
src/extract/actions.py        # apply_action, apply_actions, check_previous
src/extract/sources.py        # ensure_sourced(fields)
src/extract/pipeline.py       # obtain_raw(...), extract_from_raw(...), run_extract(...)
api/index.py                  # EXISTING file: this feature adds get_llm() and the POST /api/extract route only
tests/conftest.py             # no-network guard, fixture-replay LLM factory
tests/test_extract_properties.py   # Hypothesis properties (this design's Correctness Properties)
tests/test_extract_examples.py     # golden test, negative fixtures, PDF reader and replay edge cases
tests/test_api_extract.py          # endpoint tests with FastAPI TestClient (last step)
data/fixtures/llm_extract_demo_pca.handmade.json   # Replay_Fixture, hand-authored from expected_fields.json
data/fixtures/llm_extract_negative.handmade.json   # named hand-made negative LLM outputs
```

The validator module is `src/extract/validate.py`, the name used by `.kiro/steering/ai-rules.md`.

`src/extract/` imports only from `src/contract.py`, `src/llm.py`, pypdf, and pydantic. It never imports from `api/` or `app/` (Req 7.4). This rule is checked by a test that scans the import statements.

**Build order for the tasks phase.** All `src/llm.py` and `src/extract/` work and their tests (`tests/conftest.py`, `tests/test_extract_properties.py`, `tests/test_extract_examples.py`) come first. Adding the `/api/extract` route to `api/index.py`, together with `tests/test_api_extract.py`, is the last step, because a separate setup task creates `api/index.py` and its `app` object. This design does not create the FastAPI app.

## Components and Interfaces

### Field registry (`registry.py`)

A fixed, ordered, in-code tuple of `FieldSpec`, one per Target_Field. The validator, the prompt, the candidate builder, and the action checker all read it.

```python
SlotKind = Literal["number", "date", "text", "boolean"]

@dataclass(frozen=True)
class FieldSpec:
    name: str
    unit: str
    kind: SlotKind
    request: str                                   # request text when missing (non-empty)
    require_any: tuple[tuple[str, ...], ...] = ()  # each group: quote must contain >= 1 term (casefolded)
    forbid: tuple[str, ...] = ()                   # quote must contain none of these (casefolded)
    integral: bool = False                         # value and range bounds must be whole numbers
    roof_age: bool = False                         # Roof_Age_Field
```

A `number` field is a Numeric_Field. It holds a single number in `value` or a stated range in `value_range` (Req 2.3, 2.8, 6.1). `date`, `text`, and `boolean` fields are Text_Fields and hold their value in `text_value` (Req 2.9).

| name | unit | kind | extra rules |
|---|---|---|---|
| `report_date` | `date` | date | date-year grounding |
| `building_construction_year` | `year` | number | integral |
| `building_type` | `text` | text | none |
| `roof_type` | `text` | text | none |
| `roof_remaining_life_years` | `years` | number | none beyond the generic number rules |
| `roof_replacement_cost` | `USD (2024 real)` | number | require `("roof",)`, `("replac",)`; forbid `"reinstall"`, `"panel"` |
| `structural_capacity_assessed` | `boolean` | boolean | none |
| `tenant_electricity_arrangement` | `text` | text | none |
| `roof_installation_year` | `year` | number | roof-age guard, integral |
| `roof_age_years` | `years` | number | roof-age guard |

Every spec has a non-empty `request` that names the document or record that would resolve the field, for example `"Obtain the report date from the cover page of the condition assessment."`. Both Roof_Age_Fields use exactly `"Obtain roofing records; never infer from building construction."`, which matches the ground truth (Req 4.3).

Trade-off: a fixed table is less flexible than letting the LLM propose units, but it keeps units deterministic, makes the slot rules testable, and is enough for one document type. Adding a field means adding one row.

### Document allowlist (`documents.py`)

```python
DOCUMENT_ALLOWLIST: Mapping[str, str] = MappingProxyType({
    "demo_pca.pdf": "llm_extract_demo_pca.handmade.json",   # document_id -> replay fixture name
})
DOCUMENTS_DIR = Path(__file__).resolve().parents[2] / "data" / "demo_documents"

def resolve_document(document_id: str, documents_dir: Path = DOCUMENTS_DIR) -> Path
```

- The first statement is a dict membership test: `if document_id not in DOCUMENT_ALLOWLIST: raise DocumentNotAllowedError(document_id)`. No `Path` is built and no file is touched before this check (Req 10.2, 10.3). Path traversal, absolute paths, and encoded names are rejected because they are not keys.
- Defence in depth after the check: `candidate = (documents_dir / document_id).resolve()` must satisfy `candidate.parent == documents_dir.resolve()` and `candidate.is_file()`. A failure here means the deployment is missing an allowlisted file and raises `DocumentUnavailableError`.
- `run_extract` calls `resolve_document` before anything else, including the `previous` checks.

### Replay fixture loader (`replay.py`)

```python
FIXTURES_DIR = Path(__file__).resolve().parents[2] / "data" / "fixtures"

def load_replay_fixture(document_id: str, fixtures_dir: Path = FIXTURES_DIR) -> object
```

- Looks up the fixture name in `DOCUMENT_ALLOWLIST[document_id]`, reads `fixtures_dir / name`, and returns its `response` object unchanged. Parsing and validation happen later on the same path as a live response (Req 10.4).
- An absent file raises `FixtureMissingError(path)`. There is no live fallback (Req 10.7).
- A file that is not JSON, or has no `response` key, raises `LlmSchemaError`, the same error a malformed live response gets.

**Fixture naming (Req 9.1, 10.8).** A hand-made fixture is named `*.handmade.json`. Only a response captured from a real LLM call may be named `*.recorded.json`. The filename carries the provenance, so fixtures have no provenance field.

**Replay fixture shape** (`data/fixtures/llm_extract_demo_pca.handmade.json`):

```json
{
  "document_id": "demo_pca.pdf",
  "response": {
    "fields": [
      {"field": "roof_remaining_life_years", "value": null, "value_range": [2, 4], "text_value": null,
       "page": 2, "quote": "Remaining useful life is estimated at 2 to 4 years."},
      {"field": "structural_capacity_assessed", "value": null, "value_range": null, "text_value": "false",
       "page": 3, "quote": "Structural capacity for rooftop equipment was not assessed."},
      {"field": "roof_age_years", "value": null, "value_range": null, "text_value": null, "page": null, "quote": null}
    ]
  }
}
```

The real fixture lists all 10 fields, uses the exact ground-truth quotes, and is hand-authored from `expected_fields.json`.

**Negative fixtures** (`data/fixtures/llm_extract_negative.handmade.json`) are an object of named cases. Each case is a full `response`:

| case | content | expected |
|---|---|---|
| `bad_quote` | `roof_type` quote altered by one character | `roof_type` missing |
| `case_changed_quote` | `roof_type` quote `"roof type: low-slope modified-bitumen membrane."` | missing (no case folding) |
| `whitespace_quote` | `roof_type` quote `"   "` | missing |
| `wrapped_quote` | `roof_replacement_cost` `value: 300000`, page 2, quote `"The $300,000 synthetic replacement allowance represents one roof replacement and includes an assumed general removal and replacement scope."` (the page has `"\n"` after "an") | accepted; `evidence_text` stored exactly as supplied |
| `wrong_page` | `roof_replacement_cost` with the right quote but `page: 1` | missing |
| `page_out_of_range` | `page: 4` | missing |
| `wrong_slot` | `report_date` in `value` (`20261024`) | missing |
| `two_slots` | `roof_replacement_cost` with both `value` and `text_value` | missing |
| `extra_field` | adds `"field": "solar_capex"` | discarded; other fields equal golden |
| `collapsed_range` | `roof_remaining_life_years` `value: 3`, quote "Year 3 is the selected planning scenario within the 2-to-4-year range." | missing |
| `ungrounded_number` | `roof_replacement_cost` `value: 310000` with the golden quote | missing |
| `removal_cost_trap` | `roof_replacement_cost` `value: 75000`, quote from the $75,000 sentence | missing |
| `roof_age_from_construction` | `roof_installation_year` `value: 1979`, quote "The building was constructed in 1979." | missing |
| `roof_year_from_cost_line` | `roof_installation_year` `value: 2024`, quote "Estimated roof replacement cost: $300,000 (2024 dollars)." | missing |
| `not_json_schema` | `{"fields": "oops"}` | `LlmSchemaError` |

### LLM dependency injection (`pipeline.py`, `tests/conftest.py`)

```python
LlmCallable = Callable[[str, dict], dict]

def obtain_raw(pdf: PdfText, document_id: str, *, replay: bool, llm: LlmCallable,
               fixtures_dir: Path) -> object:
    if replay:
        return load_replay_fixture(document_id, fixtures_dir)    # never calls llm
    return llm(build_prompt(pdf), LLM_EXTRACTION_SCHEMA)         # exactly one call

def extract_from_raw(raw: object, pdf: PdfText, document_id: str) -> list[InputField]:
    return validate(to_candidates(parse_llm_output(raw).fields, document_id),
                    pdf.page_texts, document_id)

def run_extract(req: ExtractRequest, *, llm: LlmCallable = call_llm,
                documents_dir: Path = DOCUMENTS_DIR,
                fixtures_dir: Path = FIXTURES_DIR) -> ExtractionResult
```

Live and replay share `extract_from_raw`, so the same raw response yields the same fields in both modes. `call_llm` reads its environment variables at call time, so importing `src.extract` never needs a key, and replay mode works with no key at all.

Tests pass a fixture-replay callable:

```python
def fixture_llm(filename: str) -> LlmCallable:          # e.g. "llm_extract_demo_pca.handmade.json"
    path = FIXTURES_DIR / filename
    def replay(prompt: str, schema: dict) -> dict:
        replay.calls += 1
        if not path.exists():
            raise FixtureMissingError(path)              # Req 9.3: no live fallback
        return json.loads(path.read_text())["response"]
    replay.calls = 0
    return replay
```

`api/index.py` exposes the callable through a FastAPI dependency `get_llm()` that returns `call_llm`. Endpoint tests override it with `app.dependency_overrides[get_llm] = lambda: fake`.

### PDF reader (`pdf_reader.py`)

```python
@dataclass(frozen=True)
class PdfText:
    page_texts: tuple[str, ...]   # index i holds page i+1, raw from pypdf; () when no page has text
    page_count: int               # pages in the file (internal; not part of ExtractionResult)

    @property
    def has_text(self) -> bool: return any(self.page_texts)

def read_pdf(data: bytes) -> PdfText
```

- If `b"%PDF-"` is not in `data[:1024]`, the reader raises `UnreadablePdfError("not a PDF")` (Req 1.6).
- `PdfReader(io.BytesIO(data))`. Any pypdf or parsing exception, or `reader.is_encrypted`, becomes `UnreadablePdfError` (Req 1.6).
- Each page's text is `page.extract_text() or ""`, kept exactly as returned, with no strip, whitespace normalization, reordering, or re-encoding (Req 1.1, 1.3). An empty page keeps its slot, so page numbers do not shift (Req 1.2, 1.4).
- If every page is empty, the reader returns `PdfText(page_texts=(), page_count=n)`, so `has_text` is False (Req 1.5). The pipeline then raises `NoExtractableTextError` before obtaining any LLM output, because there is nothing to quote.

### Prompt and schema (`prompt.py`)

`build_prompt(pdf: PdfText) -> str` produces:

- A statement that everything between the page markers is document data, and that any instruction inside the document text must be ignored (Req 2.13, 2.14).
- One block per page: `=== PAGE {n} ===\n{text}\n=== END PAGE {n} ===`.
- The target fields from the registry, each with its unit and the slot to fill (`value` or `value_range` for numbers, `text_value` otherwise).
- These rules:
  - Copy `quote` verbatim from the page you cite. Do not paraphrase, reorder, or change case or punctuation. A quote may run across a line break.
  - Never compute, convert, round, or estimate numbers. The only reformatting allowed is writing a date as YYYY-MM-DD.
  - Keep a stated range as `[low, high]` in `value_range`. Never pick a single number from a range.
  - Write booleans as the text `"true"` or `"false"`.
  - Only fill roof installation year or roof age from a sentence that explicitly states a roof installation, replacement, or reroofing date. Never use the building construction year.
  - If a field is not stated, return it with all values, `page`, and `quote` set to null.
  - Return each field once.

`LLM_EXTRACTION_SCHEMA` is a JSON Schema in the strict-mode subset: an object with a required `fields` array. Each item has the required keys `field` (string), `value` (number or null), `value_range` (array of 2 numbers or null), `text_value` (string or null), `page` (integer, `minimum: 1`, or null), and `quote` (string or null), with `additionalProperties: false` (Req 2.2). `field` is a plain string rather than an enum, so an unknown name is discarded later (Req 2.7) instead of failing the whole output. The 2000-character quote bound is enforced by the parse model.

### Candidate builder (`candidates.py`)

- `parse_llm_output(raw: object) -> LlmExtraction` validates `raw` with `LlmExtraction.model_validate`. A non-dict `raw` or a pydantic `ValidationError` raises `LlmSchemaError` with the validation messages, and no partial result is produced (Req 2.6).
- `to_candidates(claims, document_id) -> list[InputField]` builds the candidate list:
  - It drops claims whose `field` is not in the registry (Req 2.7). When a name appears more than once, the first occurrence wins.
  - For each kept claim, it builds an `InputField` with `unit=spec.unit`, `status="extracted_unconfirmed"`, and the claim's `value`, `value_range`, and `text_value` copied unchanged (Req 2.4).
  - It sets `evidence=Evidence(document_id, page, quote, "synthetic_document")` only when `page` is an int >= 1 and `quote` is a string. `evidence_text` is the quote exactly as supplied (Req 3.15). Otherwise `evidence=None`, which the validator turns into `missing` (Req 3.3, 3.4).
  - Registry fields that the LLM omitted are absent here. The validator fills them in as `missing` (Req 2.5).

### Validator (`validate.py`)

```python
def validate(fields: Sequence[InputField], pages: Sequence[str], document_id: str) -> list[InputField]
def collapse(s: str) -> str
def quote_matches(quote: str, page_text: str) -> bool
def numbers_in(quote: str) -> set[float]
def grounded(spec: FieldSpec, f: InputField, quote: str) -> bool
def slots_ok(spec: FieldSpec, f: InputField) -> bool      # shared with actions.py
```

Algorithm (pure, no I/O, no LLM; Req 3.6, 3.7):

```python
def validate(fields, pages, document_id):
    first = {}
    for f in fields:                       # first occurrence wins; unknown names ignored
        if f.field in REGISTRY_BY_NAME and f.field not in first:
            first[f.field] = f
    return [check(spec, first.get(spec.name), pages, document_id) for spec in REGISTRY]

def check(spec, f, pages, doc):
    if f is None:
        return missing(spec, spec.request)
    if f.status == "human_supplied":
        return f                                           # Req 3.17: unchanged
    if f.status == "missing":
        keep = spec.request if spec.roof_age else (f.request or spec.request)
        return missing(spec, keep)
    # extracted_unconfirmed | confirmed | conflicting: evidence must check out
    ev = f.evidence
    if (not slots_ok(spec, f)
            or ev is None or is_blank(ev.evidence_text)
            or ev.document_id != doc or ev.source_type != "synthetic_document"
            or not (1 <= ev.page <= len(pages))
            or not quote_matches(ev.evidence_text, pages[ev.page - 1])
            or not grounded(spec, f, ev.evidence_text)
            or not terms_ok(spec, ev.evidence_text)
            or (spec.roof_age and not roof_date_stated(ev.evidence_text))):
        return missing(spec, spec.request)
    return f.model_copy(update={"unit": spec.unit, "request": None})

def missing(spec, request):
    return InputField(field=spec.name, unit=spec.unit, status="missing",
                      request=request)          # all slots and evidence None, confirmed_by_user False
```

`pages` is `pdf.page_texts`. When `has_text` is False the pipeline stops earlier, so `len(pages)` equals the PDF's page count. The page count stays internal and is not part of the response.

**`slots_ok(spec, f)`** (Req 2.3, 2.12, 3.8 to 3.11). Here "populated" means `is not None`.

- Exactly one of `value`, `text_value`, `value_range` is populated.
- `number`: either `value` is finite, or `value_range = (lo, hi)` with both bounds finite and `lo <= hi`. If `spec.integral`, the value or both bounds satisfy `is_integer()`.
- `date`: `text_value` matches `^\d{4}-\d{2}-\d{2}$` and `date.fromisoformat` accepts it.
- `text`: `text_value` contains a non-whitespace character.
- `boolean`: `text_value in {"true", "false"}`.

#### Quote matching (Req 3.13 to 3.15)

```python
def collapse(s: str) -> str:
    return re.sub(r"\s+", " ", s)                      # Whitespace_Collapse, nothing else

def is_blank(quote: str) -> bool:
    return re.fullmatch(r"\s*", quote) is not None      # "" or whitespace only

def quote_matches(quote: str, page_text: str) -> bool:
    return not is_blank(quote) and collapse(quote) in collapse(page_text)
```

- There is no case folding, Unicode normalization, punctuation change, or strip. A quote with a leading or trailing space matches only if the page has whitespace at that position.
- A quote that wraps across a line break matches, because `"\n"` and a space both collapse to `" "` (Req 3.14).
- An empty or whitespace-only quote is treated as missing evidence. Without this check, `"   "` would collapse to `" "` and match almost any page.
- Page text is stored raw by the PDF reader. `Evidence.evidence_text` is stored exactly as supplied (Req 3.15). Collapse is applied only inside `quote_matches` and `numbers_in`.

#### Numeric grounding (Req 3.16)

This rule checks that every number the validator accepts is copied from the quote, not computed or invented (Req 2.4, 3.16).

```python
def numbers_in(quote: str) -> set[float]:
    cleaned = collapse(quote).replace("$", "").replace(",", "")
    return {float(m) for m in re.findall(r"\d+(?:\.\d+)?", cleaned)}

RANGE_EXPR = re.compile(r"\d+(?:\.\d+)?\s*(?:-to-|to|–|-)\s*\d+(?:\.\d+)?")

def grounded(spec, f, quote) -> bool:
    nums = numbers_in(quote)
    if spec.kind == "number":
        if f.value_range is not None:
            lo, hi = f.value_range
            return lo in nums and hi in nums
        return f.value in nums and not RANGE_EXPR.search(collapse(quote))   # range-collapse guard
    if spec.kind == "date":
        return float(int(f.text_value[:4])) in nums                         # date-year grounding
    return True                                                             # text, boolean
```

- Every `$` and `,` is removed from the whitespace-collapsed quote, then every run of digits, with an optional decimal part, is read as a number. "Estimated roof replacement cost: $300,000 (2024 dollars)." gives {300000, 2024}. "Remaining useful life is estimated at 2 to 4 years." gives {2, 4}.
- A single `value` must be in that set. Both bounds of a `value_range` must be in that set. Otherwise the field becomes `missing` with its `request` (Req 3.16).
- Range-collapse guard: a single `value` is rejected when the quote contains a range expression such as "2 to 4" or "2-to-4". This rejects the "Year 3 ... 2-to-4-year range" trap (Req 2.3).
- Date-year grounding: the four-digit year of a `date` field must appear in the quote. "Report date: October 24, 2026." gives {24, 2026}, so `"2026-10-24"` passes.
- Known effect of removing every comma: "2,4" reads as 24. It fails safe, because a mismatched number makes the field missing.

**`terms_ok(spec, quote)`**: with `q = quote.casefold()`, every group in `spec.require_any` has at least one term in `q`, and no term in `spec.forbid` is in `q`. Casefolding applies only to these term checks, never to quote matching.

### Roof-age guard (Req 4.1 to 4.7)

Both Roof_Age_Fields use these rules in addition to the generic checks. The strict guard is a settled decision.

```python
ROOF_EVENT = ("install", "replac", "reroof", "re-roof")
YEAR = re.compile(r"\b(?:18|19|20)\d{2}\b")

def roof_date_stated(quote: str) -> bool:           # Req 4.7
    q = quote.casefold()
    return "roof" in q and any(t in q for t in ROOF_EVENT) and YEAR.search(quote) is not None
```

- `roof_date_stated` must hold for both fields. A quote that does not explicitly state a roof installation, replacement, or reroofing date makes the field `missing` with the roofing-records request (Req 4.7, 4.3).
- `forbid = ("construct", "built", "unknown", "no roofing", "not supplied", "were not", "remaining", "life", "cost", "$", "allowance", "assum")` for both fields.
- `roof_installation_year`: `integral=True`, and numeric grounding requires the year to appear in the quote.
- `roof_age_years`: also `require_any = (("years old", "year-old", "roof age", "age of the roof"),)`. The age must be stated as an age in a sentence that also states the roof date, for example "The roof was replaced in 2014 and is 12 years old." A stated installation year is never turned into an age, because that would be computing a number.

Effect on the demo PDF:

- "The building was constructed in 1979." has no `"roof"` and contains `"construct"`.
- "No roofing installation records were supplied." contains `"no roofing"` and has no year.
- "Historic reroofing dates, warranty records and membrane age remain unknown." has no year and contains `"unknown"`.
- "Roof age remains unknown. The building construction date does not resolve it." has no roof event or year and contains `"unknown"` and `"construct"`.
- "Estimated roof replacement cost: $300,000 (2024 dollars)." states roof, "replac", and 2024, but contains `"cost"` and `"$"`.

Both Roof_Age_Fields therefore stay `missing` with the roofing-records request, and their slots and evidence stay unset (Req 4.1 to 4.5).

The guard is conservative. "The roof was replaced in 2015 when the building was constructed" is rejected because it contains `"construct"`. That fails safe: the field is missing and a human can supply it with evidence. The guard is a pure predicate over the quote, so it does not affect idempotence.

A `human_supplied` roof-age value must carry evidence (Req 4.6, 6.14). `apply_action` enforces this for edits, and `check_previous` enforces it for a `previous` result. The validator leaves `human_supplied` fields unchanged (Req 3.17), so `roof_date_stated` is not applied to a human's evidence. Judging that evidence is the human's responsibility.

### Why `validate` is idempotent (Req 3.6, 5.1 to 5.4)

`check` returns one of three shapes:

- **(a) Canonical missing** `M = missing(spec, r)` with a non-empty `r`. Calling `check(spec, M)` takes the `status == "missing"` branch. For a Roof_Age_Field `r` is already `spec.request`; otherwise `M.request` is kept. Both return `M`.
- **(b) Accepted** `f' = f` with `unit = spec.unit` and `request = None`. Every predicate (`slots_ok`, the evidence checks, `quote_matches`, `grounded`, `terms_ok`, `roof_date_stated`) reads only the slots and `evidence`, which the update leaves unchanged. So `check(spec, f')` accepts again and returns `f'`.
- **(c) Human-supplied** `f` is returned unchanged, and returns unchanged again.

At list level, `validate` returns exactly one field per registry entry, in registry order, so a second pass looks up the same field for each spec. Therefore `validate(validate(x)) == validate(x)` for all inputs.

### Actions (`actions.py`)

```python
def check_previous(previous: ExtractionResult) -> None                   # raises InvalidPreviousError
def apply_action(result: ExtractionResult, action: Action, pdf: PdfText, index: int) -> ExtractionResult
def apply_actions(result: ExtractionResult, actions: Sequence[Action], pdf: PdfText) -> ExtractionResult
```

`apply_action` is pure and returns a new object. It raises `InvalidActionError(index, field, reason)` and leaves `result` untouched when the action is invalid. `apply_actions` folds `apply_action` over the list and returns the final result only if every action succeeds. If any action raises, the error propagates and no partially edited result is returned (Req 6.12). Unknown action kinds and values of the wrong JSON type never reach this code: the discriminated union rejects them at request parsing (see Data Models).

**Edit_Action** `{field, action: "edit", value, evidence?}`:

- Invalid if the field is not in the registry.
- Routing (Req 6.1): a number goes to `value` and a `[low, high]` pair goes to `value_range` for a `number` field; a string goes to `text_value` for a `date`, `text`, or `boolean` field. Any other combination, such as a string for a number field, is invalid (Req 6.5).
- The new field must pass `slots_ok` (ISO date, exact `"true"`/`"false"`, non-blank text, finite numbers, `lo <= hi`, integral years). Otherwise invalid (Req 6.5).
- Edit evidence `{page, quote, document_id?}`: `document_id`, if given, must equal the request's `document_id`; `page` must be within the PDF's page count; and `quote_matches(quote, pages[page - 1])` must hold. The stored evidence is `Evidence(document_id=<request document_id>, page, evidence_text=quote, source_type="synthetic_document")`, with the quote kept as supplied (Req 6.13). Evidence that fails these checks makes the action invalid. Roofing records outside the demo folder are out of scope for the demo.
- A Roof_Age_Field edit without evidence is invalid (Req 6.14, 4.6).
- The edited field becomes `InputField(field, unit=spec.unit, status="human_supplied", <one slot>, evidence=<edit evidence or None>, confirmed_by_user=True, request=None)`. The other two slots are cleared (Req 6.1, 6.3).
- `originals = result.originals if name in result.originals else {**result.originals, name: current_field}`. The first edit stores the pre-edit field, which is the field after re-validation. Later edits never overwrite it (Req 6.2, 6.6).

**Confirm_Action** `{field, action: "confirm"}`:

- Invalid if the field is not in the registry, or if the field's status after re-validation of `previous` is `missing` (Req 6.8). A field that failed re-validation therefore cannot be confirmed.
- `extracted_unconfirmed` or `conflicting` becomes `confirmed` with `confirmed_by_user=True` (Req 6.7). `confirmed` stays `confirmed`, so confirm is idempotent.
- `human_supplied` stays `human_supplied` with `confirmed_by_user=True` (Req 6.9).
- `value`, `text_value`, `value_range`, `evidence`, and `originals` are unchanged (Req 6.7, 6.10).

For both kinds, every other field and every other `originals` entry is reused unchanged (Req 6.4).

**`check_previous(previous)`** runs before re-validation. Because the validator leaves `human_supplied` fields unchanged (Req 3.17), a forged `previous` could otherwise carry an unsourced roof-age value. `check_previous` raises `InvalidPreviousError` when a `human_supplied` field fails `slots_ok`, has a unit different from the registry, or is a Roof_Age_Field without evidence (Req 4.6).

### Sources and the sourced guard (`sources.py`)

- `sources` is the constant `[]` for every `ExtractionResult` (Req 8.3, 8.4). Extraction uses no policy constants and no assumptions. Document provenance is recorded in each field's `Evidence.document_id`, `page`, and `source_type`.
- `ensure_sourced(fields) -> list[InputField]` runs on the final field list. Any field with status `extracted_unconfirmed`, `confirmed`, or `conflicting` and no evidence is replaced by `missing(spec, spec.request)` (Req 8.5). It never raises. The validator never produces such a field, so on real output this is a no-op guard against regressions.
- A `human_supplied` field is sourced by its status, and its extracted evidence is kept in `originals` (Req 8.2).

### Pipeline (`run_extract`)

1. `path = resolve_document(req.document_id, documents_dir)`. This reads no file for a non-allowlisted id.
2. If `req.previous` is given: if `previous.document_id != req.document_id`, raise `DocumentMismatchError` (Req 6.15). Then `check_previous(req.previous)`.
3. `pdf = read_pdf(path.read_bytes())`. If `not pdf.has_text`, raise `NoExtractableTextError`.
4. Without `previous`: `raw = obtain_raw(pdf, doc, replay=req.replay, llm=llm, fixtures_dir=fixtures_dir)`, then `fields = extract_from_raw(raw, pdf, doc)` and `originals = {}`. `LlmOutputError` from `call_llm` becomes `LlmSchemaError` (Req 2.6).
5. With `previous`: `fields = validate(previous.fields, pdf.page_texts, doc)` and `originals = previous.originals`. No LLM call and no fixture load (Req 6.11). Then `apply_actions(..., req.actions or [], pdf)`.
6. `fields = ensure_sourced(fields)`.
7. Return `ExtractionResult(document_id=doc, mode="replay" if req.replay else "live", fields=fields, originals=originals, sources=[])` (Req 10.5, 10.6).

For an Action_Round_Trip, `mode` follows the request's `replay` flag. No LLM call is made in either mode.

### Endpoint (`api/index.py`, added last)

The setup task creates `api/index.py` and its `app`. This feature adds only:

```python
from fastapi import Depends, HTTPException
from src.extract import ExtractError, ExtractionResult, ExtractRequest, run_extract
from src.llm import call_llm

EXTRACT_ERROR_STATUS: dict[type[ExtractError], int] = {...}   # see Error Handling

def get_llm() -> LlmCallable:
    return call_llm

@app.post("/api/extract", response_model=ExtractionResult)
def extract(req: ExtractRequest, llm: LlmCallable = Depends(get_llm)) -> ExtractionResult:
    try:
        return run_extract(req, llm=llm)        # exactly one src call (Req 7.1); no logic here (Req 7.3)
    except ExtractError as exc:
        raise HTTPException(EXTRACT_ERROR_STATUS.get(type(exc), 500),
                            detail={"error": exc.code, "message": str(exc)})
    except Exception:
        logger.exception("extraction failed")
        raise HTTPException(500, detail={"error": "extraction_failed", "message": "Extraction failed."})
```

- The handler is a plain `def`, so FastAPI runs the blocking LLM call in its threadpool.
- A malformed body is rejected by FastAPI's request validation with 422 before `run_extract` runs (Req 7.5). This includes invalid JSON, a missing `document_id`, unknown keys, `actions` without `previous`, an unknown `action`, and a `value` of the wrong JSON type.
- The response is the `ExtractionResult` with exactly five keys (Req 7.2). `fields` is returned unchanged.
- The request body is JSON, so no `python-multipart` dependency is needed. File upload is out of scope.

### `src/llm.py`

```python
class LlmNotConfiguredError(RuntimeError): ...
class LlmCallError(RuntimeError): ...        # transport errors, non-2xx, timeouts
class LlmOutputError(RuntimeError): ...      # response content is not a JSON object

def call_llm(prompt: str, schema: dict) -> dict:
    provider = os.environ.get("LLM_PROVIDER", "").strip().lower()
    api_key = os.environ.get("LLM_API_KEY", "")
    if not provider or not api_key:
        raise LlmNotConfiguredError("Set LLM_PROVIDER and LLM_API_KEY")
    adapter = _ADAPTERS.get(provider)
    if adapter is None:
        raise LlmNotConfiguredError(f"Unknown LLM_PROVIDER: {provider}")
    return adapter(prompt, schema, api_key)
```

- There is one adapter, `"openai"`. It covers OpenAI-compatible endpoints through httpx, which is already in `requirements.txt`, and the optional env vars `LLM_MODEL` and `LLM_BASE_URL`.
- The request uses `response_format={"type": "json_schema", "json_schema": {"name": "extraction", "schema": schema, "strict": True}}`, `temperature=0`, and a 60 s timeout. The adapter returns `json.loads` of the message content.
- The key is read only from the environment, never logged, and never included in exception messages.
- Vercel's function duration limit must cover one LLM call. Check `maxDuration` when deploying. Replay mode avoids the call entirely.

## Data Models

The contract types (`InputField`, `Evidence`, `Status`, `SourceType`) come from `src/contract.py` and are not changed. Module-local models live in `src/extract/models.py`:

```python
StrictFiniteFloat = Annotated[float, Field(strict=True, allow_inf_nan=False)]
Quote = Annotated[str, Field(strict=True, max_length=2000)]

class ExtractionResult(BaseModel):
    model_config = ConfigDict(extra="forbid")
    document_id: str
    mode: Literal["live", "replay"]
    fields: list[InputField]                        # one per Target_Field, registry order
    originals: dict[str, InputField] = {}           # field name -> InputField before its first edit
    sources: list[str] = Field(default_factory=list, max_length=0)   # always []

class EditEvidence(BaseModel):
    model_config = ConfigDict(extra="forbid")
    page: Annotated[int, Field(strict=True, ge=1)]
    quote: Quote
    document_id: Optional[str] = None               # must equal the request document_id if given

class EditAction(BaseModel):
    model_config = ConfigDict(extra="forbid")
    field: str
    action: Literal["edit"]
    value: Union[StrictFiniteFloat, tuple[StrictFiniteFloat, StrictFiniteFloat], Quote]
    evidence: Optional[EditEvidence] = None         # required for Roof_Age_Fields

class ConfirmAction(BaseModel):
    model_config = ConfigDict(extra="forbid")
    field: str
    action: Literal["confirm"]

Action = Annotated[Union[EditAction, ConfirmAction], Field(discriminator="action")]

class ExtractRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    document_id: str = Field(max_length=200)        # allowlist check happens in src (Req 10.2, 10.3)
    replay: bool = False                            # absent means false (Req 10.1)
    previous: Optional[ExtractionResult] = None
    actions: Optional[list[Action]] = Field(default=None, max_length=20)

    @model_validator(mode="after")
    def actions_need_previous(self):
        if self.actions is not None and self.previous is None:
            raise ValueError("actions require previous")     # malformed (Req 10.9)
        return self

class LlmFieldClaim(BaseModel):                     # parse model for one LLM item
    field: str
    value: Optional[StrictFiniteFloat] = None
    value_range: Optional[tuple[StrictFiniteFloat, StrictFiniteFloat]] = None
    text_value: Optional[str] = None
    page: Optional[Annotated[int, Field(strict=True)]] = None
    quote: Optional[Quote] = None

class LlmExtraction(BaseModel):
    fields: list[LlmFieldClaim]
```

Notes:

- `ExtractionResult` has no `page_count`. The page count lives in `PdfText` and is used only by the validator and `apply_action`.
- `previous` with no `actions` is a valid round trip that re-validates only.
- In strict mode a JSON integer such as `1979` is accepted as a float, and JSON booleans are rejected for both the float and the string branches of `value`, so `true` is a malformed request.
- `InputField.value_range` is a tuple. JSON `[2, 4]` round-trips to `(2.0, 4.0)`, and the golden test compares numerically.
- `LlmFieldClaim.page` has no lower bound, so a page below 1 becomes a field-level `missing` (Req 3.3) instead of rejecting the whole output.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Properties 1 to 4 are the user-supplied properties. All properties run against the pure functions in `src/extract/` with generated pages, candidates, raw responses, and actions. None of them calls an LLM. Properties 19 and 20 read the demo PDF or a temporary directory through injected paths.

### Property 1: Every accepted value has a page and a quote found on that page

*For any* list of page texts, document id, and candidate fields (quotes drawn from a page, mutated, random, empty, whitespace-only, or absent; claimed pages drawn from -1 to page_count + 2 or absent), every field returned by `validate` with a status other than `missing` and `human_supplied` has `evidence` with `1 <= page <= page_count`, a non-blank `evidence_text` such that `collapse(evidence_text)` is a substring of `collapse(pages[page - 1])`, `document_id` equal to the document id, and `source_type == "synthetic_document"`. Every candidate whose quote is absent, empty, whitespace-only, or not on the claimed page, or whose page is absent or out of range, comes back `missing` with all Value_Slots and `evidence` empty and a non-empty `request`.

**Validates: Requirements 2.15, 3.1, 3.2, 3.3, 3.4, 3.5, 8.1, 9.7**

### Property 2: Roof age stays missing without an explicit roof date, regardless of construction year

*For any* document whose pages are built only from lines with no explicit roof installation, replacement, or reroofing date (construction-year sentences with any year, "no roofing records" and "roof age unknown" sentences, roof cost lines with any amount and dollar year, remaining-life ranges, and digit-free filler), and *for any* LLM claims for `roof_installation_year` and `roof_age_years` that quote any line of any page with any value (including the construction year or numbers derived from it), both Roof_Age_Fields come back `missing` with `value`, `text_value`, `value_range`, and `evidence` unset and `request == "Obtain roofing records; never infer from building construction."`. Separately, *for any* Roof_Age_Field candidate whose quote fails `roof_date_stated`, the field comes back `missing` with that request.

**Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.7, 9.5**

### Property 3: Validating an already validated extraction returns the same result

*For any* pages, document id, and candidate field list `x`, `validate(validate(x)) == validate(x)` compared field by field on `field`, `value`, `text_value`, `value_range`, `unit`, `status`, `evidence`, `confirmed_by_user`, and `request`, and calling `validate(x)` twice returns equal results.

**Validates: Requirements 3.6, 5.1, 5.2, 5.3, 5.4, 9.6**

### Property 4: A human edit marks the field human_supplied and keeps the original extraction

*For any* validated `ExtractionResult` and any valid Edit_Action for one of its fields, `apply_action` returns a result in which that field has `status == "human_supplied"`, `confirmed_by_user is True`, the edited value in the slot that matches the field's kind, the other two slots `None`, and the edit's evidence (when given) stored with the request's document id and the quote as supplied. `originals[field]` equals the field exactly as it stood before the edit, including `value`, `text_value`, `value_range`, and `evidence`. Re-running `validate` on the result returns the edited field unchanged.

**Validates: Requirements 3.17, 6.1, 6.2, 6.3, 6.13, 8.2, 9.8**

### Property 5: Output shape invariant

*For any* input to `validate` that contains no `human_supplied` field, the output contains exactly one field per registry entry in registry order, each with the registry unit. A field with status `missing` has all three Value_Slots and `evidence` empty and a non-empty `request`. A field with any other status has exactly one Value_Slot populated.

**Validates: Requirements 2.12, 3.5, 3.12**

### Property 6: The populated slot must match the field's kind

*For any* candidate whose quote passes the evidence and grounding checks, if more than one Value_Slot is populated, or a Numeric_Field has `text_value` populated, or a Text_Field has `value` or `value_range` populated, the field comes back `missing` with a non-empty `request`. A Numeric_Field holding its single number in `value`, or a Text_Field holding its value in `text_value`, is accepted when the other rules pass.

**Validates: Requirements 2.8, 2.9, 3.10, 3.11**

### Property 7: Date and boolean formats are enforced

*For any* string `s`, a `date` field with `text_value == s` is accepted only if `s` is a valid ISO 8601 calendar date `YYYY-MM-DD`, and a `boolean` field with `text_value == s` is accepted only if `s` is exactly `"true"` or `"false"`. Every other string yields `missing` with a non-empty `request`. Example strings: `"2026-13-01"`, `"Oct 24 2026"`, `"True"`, `"no"`, `" false"`.

**Validates: Requirements 2.10, 2.11, 3.8, 3.9**

### Property 8: Ranges stay ordered ranges and are never collapsed

*For any* Numeric_Field candidate, an accepted `value_range` `(lo, hi)` satisfies `lo <= hi` and is returned unchanged. A candidate with `lo > hi` comes back `missing`. A candidate holding a single `value` whose quote contains a range expression (such as "2 to 4" or "2-to-4") comes back `missing`.

**Validates: Requirements 2.3**

### Property 9: Numeric grounding (Req 3.16)

*For any* Numeric_Field candidate and quote that passes the quote-matching check, the field is accepted only if its `value`, or both bounds of its `value_range`, are members of the set of numbers read by `\d+(?:\.\d+)?` from the quote after Whitespace_Collapse and removal of every `$` and `,`. Any value or bound outside that set yields `missing` with a non-empty `request`. Every accepted `value` and `value_range` is identical to the candidate's.

**Validates: Requirements 2.4, 3.16**

### Property 10: Quote matching collapses whitespace and nothing else

*For any* page text and any quote taken from it, replacing any whitespace run in the quote or in the page with any other non-empty whitespace run (including `"\n"`) still matches, and the stored `evidence_text` equals the supplied quote character for character. *For any* change to a non-whitespace character of the quote (including a case flip) after which `collapse(quote)` is not a substring of `collapse(page)`, the field comes back `missing`.

**Validates: Requirements 3.13, 3.14, 3.15**

### Property 11: Omitted fields become missing and the rest are unchanged

*For any* LLM claim set and any subset of Target_Fields removed from it, each removed field comes back `missing` with all Value_Slots empty and a non-empty `request`, and every field that was not removed equals its result from the full claim set.

**Validates: Requirements 2.5**

### Property 12: Unknown field names are discarded

*For any* LLM claim set and any extra claims whose `field` is not a Target_Field name, the validated fields are identical with and without the extra claims.

**Validates: Requirements 2.7**

### Property 13: LLM call count per request kind

*For any* raw LLM response (valid, partially empty, or schema-invalid) returned by a counting fake, a Live_Extraction calls the fake exactly once, whether it returns a result or raises. *For any* Replay_Extraction and any Action_Round_Trip, the fake is called zero times.

**Validates: Requirements 2.1, 6.11, 7.1, 10.4**

### Property 14: Non-conforming LLM output is rejected whole

*For any* raw object that does not conform to `LlmExtraction` (not a dict; `fields` missing or not a list; an item with a wrong-typed `value`, `page`, or `value_range`; a quote longer than 2000 characters), `parse_llm_output` raises `LlmSchemaError`, and the pipeline raises without returning any fields.

**Validates: Requirements 2.6**

### Property 15: An action changes only its own field

*For any* validated `ExtractionResult` and any valid Edit_Action or Confirm_Action on field `f`, every other field and every `originals` entry for another field are equal before and after `apply_action`, on `value`, `text_value`, `value_range`, `status`, `evidence`, and `confirmed_by_user`.

**Validates: Requirements 6.4**

### Property 16: Editing an edited field keeps the first original

*For any* validated `ExtractionResult` and any sequence of one or more valid Edit_Actions on the same field, `originals[field]` after the whole sequence equals that field as it stood before the first edit, and the field holds the last edit's value.

**Validates: Requirements 6.6**

### Property 17: Confirm changes status only

*For any* validated `ExtractionResult` and any field whose status is not `missing`, a Confirm_Action leaves `value`, `text_value`, `value_range`, `evidence`, and `originals` unchanged and sets `confirmed_by_user` to true. The status becomes `confirmed` for `extracted_unconfirmed`, `conflicting`, or `confirmed` fields, and stays `human_supplied` for `human_supplied` fields. Applying the same confirm twice equals applying it once.

**Validates: Requirements 6.7, 6.9, 6.10**

### Property 18: Invalid actions are rejected whole

*For any* validated `ExtractionResult` and any action list that contains at least one invalid action (unknown field, value of the wrong kind for the field, non-ISO date, boolean other than `"true"`/`"false"`, `lo > hi`, non-integral year, Confirm_Action on a `missing` field, Roof_Age_Field edit without evidence, or edit evidence not found on the cited page), `apply_actions` raises `InvalidActionError` identifying the first invalid action's index and field, and the input result is unchanged. Valid actions that precede the invalid one are not applied.

**Validates: Requirements 6.5, 6.8, 6.12, 6.14**

### Property 19: Replay equals live for the same response

*For any* raw LLM response, running `run_extract` with `replay=True` and a temporary fixtures directory whose replay fixture holds that response, and running it with `replay=False` and an `llm` fake that returns the same response, produce equal `fields`, `originals`, and `sources`, or raise the same error type. The `mode` is `"replay"` and `"live"` respectively.

**Validates: Requirements 9.4, 10.4, 10.5, 10.6**

### Property 20: Non-allowlisted documents are rejected before any file access

*For any* string `document_id` that is not a key of `DOCUMENT_ALLOWLIST` (including traversal such as `../requirements.txt`, absolute paths, URL-encoded forms, and names differing only by case or whitespace), `run_extract` raises `DocumentNotAllowedError`, no file read or path resolution is recorded by the patched file-access functions, and the LLM fake is called zero times.

**Validates: Requirements 10.2, 10.3**

### Property 21: Sources are always empty

*For any* result produced by `run_extract`, in live mode, replay mode, or an Action_Round_Trip, `sources == []`, and no field has `Evidence.source_type == "assumption"`.

**Validates: Requirements 8.3, 8.4**

### Property 22: Unsourced extracted fields become missing

*For any* field list in which some fields have status `extracted_unconfirmed` or `confirmed` and no evidence, `ensure_sourced` returns those fields as `missing` with all Value_Slots empty and a non-empty `request`, and returns every other field unchanged. *For any* result produced by `run_extract`, every Roof_Age_Field with a populated Value_Slot and a status other than `missing` has evidence.

**Validates: Requirements 4.6, 8.5**

### Property 23: Non-PDF bytes are rejected

*For any* byte string that has no `%PDF-` marker in its first 1024 bytes, and for any truncation of the demo PDF that pypdf cannot parse, `read_pdf` raises `UnreadablePdfError` and returns no page texts.

**Validates: Requirements 1.6**

## Error Handling

All extraction errors subclass `ExtractError(Exception)`, which has a `code: str`. They are defined in `src/extract/errors.py`. The route in `api/index.py` maps each type to an HTTP status with one lookup table and returns `{"detail": {"error": code, "message": str(exc)}}`. No error response contains `fields` (Req 7.6).

| condition | raised in | exception | HTTP | `error` code |
|---|---|---|---|---|
| Malformed body: invalid JSON, missing `document_id`, unknown keys, `actions` without `previous`, unknown `action`, `value` of the wrong JSON type, non-empty `previous.sources` | FastAPI request validation | `RequestValidationError` (FastAPI default) | 422 | FastAPI's default `detail` list, whose `loc` names the offending action (Req 7.5, 10.9) |
| `document_id` not in `DOCUMENT_ALLOWLIST` | `documents.py` | `DocumentNotAllowedError` | 403 | `document_not_allowed` (Req 10.3) |
| Allowlisted file absent from the deployment | `documents.py` | `DocumentUnavailableError` | 500 | `document_unavailable` |
| Not a PDF, corrupt, or encrypted | `pdf_reader.py` | `UnreadablePdfError` | 422 | `unreadable_pdf` (Req 1.6) |
| No page has extractable text | `pipeline.py` | `NoExtractableTextError` | 422 | `no_extractable_text` (Req 1.5) |
| Replay fixture absent | `replay.py` | `FixtureMissingError` | 503 | `replay_fixture_missing` (Req 10.7), no live fallback |
| LLM output or replay fixture content not JSON or not schema-conforming | `candidates.py`, `replay.py`, `pipeline.py` (wraps `LlmOutputError`) | `LlmSchemaError` | 502 | `llm_schema_invalid` (Req 2.6) |
| `LLM_PROVIDER` or `LLM_API_KEY` not set, or unknown provider (live mode only) | `pipeline.py` (wraps `LlmNotConfiguredError`) | `LlmNotConfiguredExtractError` | 503 | `llm_not_configured` |
| Provider transport error, timeout, or non-2xx | `pipeline.py` (wraps `LlmCallError`) | `LlmUnavailableError` | 502 | `llm_unavailable` |
| `previous.document_id` differs from `document_id` | `pipeline.py` | `DocumentMismatchError` | 422 | `document_mismatch` (Req 6.15) |
| `previous` holds a `human_supplied` field with bad slots, a wrong unit, or a roof-age value without evidence | `actions.py` | `InvalidPreviousError` | 422 | `invalid_previous` |
| Invalid action (semantic checks in `apply_action`) | `actions.py` | `InvalidActionError(index, field, reason)` | 422 | `invalid_action` (Req 6.5, 6.8, 6.12, 6.14) |
| Any other exception | anywhere | caught by the route | 500 | `extraction_failed`, with a generic message |

Rules:

- Field-level problems never raise. A bad quote, wrong page, wrong slot, bad format, ungrounded number, failed roof-age guard, or unsourced extracted field becomes `missing` with a `request`. Only whole-input problems raise, which keeps partial evidence visible to the reviewer.
- `LlmSchemaError` produces no partial fields (Req 2.6). `apply_actions` is all-or-nothing (Req 6.12).
- Messages never include `LLM_API_KEY`, request headers, or the full prompt. The 500 fallback logs the traceback server-side and returns a generic message.

## Testing Strategy

The suite uses pytest with Hypothesis (both already in `requirements.txt`) and runs with `python -m pytest -q`. Tests never call the real LLM or any live API (Req 9.1, 9.2):

- An autouse fixture in `tests/conftest.py` replaces `socket.socket.connect` with a function that raises, and deletes `LLM_PROVIDER` and `LLM_API_KEY` from the environment. An accidental live call therefore fails fast.
- `fixture_llm(filename)` replays `data/fixtures/<filename>` and raises `FixtureMissingError` if the file is absent.
- Tests read `expected_fields.json` but never write it (Req 9.10).

**Order.** Tests for `src/llm.py` and `src/extract/` are written with those modules. `tests/test_api_extract.py` is written last, together with the route added to the existing `api/index.py`.

### Property-based tests (`tests/test_extract_properties.py`)

- Each correctness property above is implemented by exactly one Hypothesis test with `@settings(max_examples=100, deadline=None)` or more examples.
- Each test carries a tag comment in the form `# Feature: document-extraction, Property {n}: {property title}`.
- Hypothesis tests do not use function-scoped pytest fixtures. Temporary directories come from `tempfile.TemporaryDirectory()` inside the test, and patches use `unittest.mock.patch` context managers.
- Generators (`tests/strategies.py` or the top of the test file):
  - `page_texts()`: 1 to 4 pages. Each page is 1 to 8 lines joined with `"\n"`. Lines are built from printable text without `"\n"`, plus templated lines that embed numbers ("cost: ${n:,}", "estimated at {a} to {b} years", "constructed in {y}").
  - `quote_for(pages)` via `st.data()`: a contiguous substring of a page, possibly spanning a line break (present); the same substring with whitespace runs replaced by other whitespace (present); with one non-whitespace character changed or case-flipped (absent, checked with `assume`); a random string (absent); `""`; a whitespace-only string; or `None`.
  - `claimed_page(n)`: integers from -1 to n + 2, or `None`.
  - `slot_assignment(kind)`: zero, one, two, or three slots populated, with values drawn to match or mismatch the kind. Numbers are drawn from `numbers_in(quote)` (grounded) or not (ungrounded). Dates are drawn from `st.dates()` formatted as ISO, or from free text. Booleans are drawn from `"true"`, `"false"`, or other text.
  - `no_roof_date_document()`: pages built only from the line pool in Property 2.
  - `valid_action(result, pdf)` and `invalid_action(result, pdf)`: edit and confirm actions per slot kind. Valid roof-age edits carry evidence quoted from a page.
  - `llm_raw_valid()` and `llm_raw_invalid()`: raw response dicts for Properties 11 to 14 and 19.
  - `validated_result()`: an `ExtractionResult` built by `validate` over generated pages and candidates.
- Property 19 writes the generated response to `<tmpdir>/llm_extract_demo_pca.handmade.json` and passes `fixtures_dir=<tmpdir>`. Both runs use the real demo PDF.
- Property 20 patches `pathlib.Path.read_bytes`, `pathlib.Path.read_text`, `pathlib.Path.open`, `pathlib.Path.resolve`, `pathlib.Path.is_file`, and `builtins.open` with recording functions that raise, and asserts that none was called.
- Property 23 uses `st.binary()` filtered to inputs without `%PDF-` in the first 1024 bytes, plus truncations of the demo PDF bytes at `st.integers` cut points. Truncations that pypdf still parses are skipped with `assume`.

### Example and edge-case tests (`tests/test_extract_examples.py`)

- **Golden test, replay mode (Req 9.4, 9.9, 9.10).** Run `run_extract(ExtractRequest(document_id="demo_pca.pdf", replay=True), llm=counting_fake)`. Normalize each `expected_fields.json` entry:
  - numeric units keep `value`;
  - `date` and `text` move `value` to `text_value` unchanged;
  - `boolean` moves `value` to `text_value` as `"true"` or `"false"`;
  - `value_range` is compared as stored.

  Then assert exact equality per field on `field`, `status`, `value`, `text_value`, `value_range` (numeric bounds), `unit`, `evidence`, and `request`. Also assert `mode == "replay"`, `sources == []`, `originals == {}`, the response has exactly the five keys, and `counting_fake.calls == 0`. The ground-truth file's SHA-256 is checked before and after the session.
- **Negative fixtures.** One parametrized test over the named cases in `llm_extract_negative.handmade.json` asserts the expected outcome. In every non-error case the other fields still equal the golden result.
- **Wrapped quote on the demo PDF (Req 3.14).** `quote_matches("No roofing installation records were supplied.", page_1)` is true, although page 1 has `"\n"` after "installation".
- **PDF reader (Req 1.1 to 1.5).**
  - The demo PDF gives 3 pages, and page `n` contains `"n / 3"`.
  - The output equals raw `PdfReader(...).pages[i].extract_text()` output character for character.
  - All 8 ground-truth quotes match their pages.
  - A PDF built in memory with `pypdf.PdfWriter` that interleaves a blank page with demo pages yields an `""` entry and unchanged numbering for the other pages.
  - An all-blank PDF yields `has_text is False`, and `run_extract` raises `NoExtractableTextError` with the LLM fake called 0 times.
- **Schema and prompt (Req 2.2, 2.13, 2.14).** `LLM_EXTRACTION_SCHEMA` requires `field`, `value`, `value_range`, `text_value`, `page`, and `quote`, and `page` has `minimum: 1`. `build_prompt` output contains the data-not-instructions statement and every page between markers.
- **Replay and allowlist (Req 10.1, 10.7, 10.8, 9.1).** `ExtractRequest(document_id="demo_pca.pdf").replay is False`. Replay with an empty `fixtures_dir` raises `FixtureMissingError` and calls the fake 0 times. Every value in `DOCUMENT_ALLOWLIST` ends with `.handmade.json` or `.recorded.json`, and both committed LLM fixtures end with `.handmade.json`.
- **Round trip (Req 6.11, 6.15, 10.9).**
  - A `previous` whose `roof_type` quote was tampered with comes back with `roof_type` missing, and a confirm on it raises `InvalidActionError`.
  - A `previous` with a different `document_id` raises `DocumentMismatchError`.
  - `ExtractRequest(document_id="demo_pca.pdf", actions=[...])` without `previous` raises a pydantic `ValidationError`.
  - A round trip with `replay=False` returns `mode == "live"` and calls the fake 0 times.
- **Missing fixture helper (Req 9.3).** `fixture_llm("does_not_exist.handmade.json")` raises `FixtureMissingError` when called.
- **Structure (Req 3.7, 7.4).** An AST scan asserts that no module under `src/` imports `api` or `app`, and that `validate.py`, `actions.py`, and `sources.py` do not import `src.llm`.

### Endpoint tests (`tests/test_api_extract.py`, FastAPI `TestClient`, last step)

`get_llm` is overridden with a counting fake, and `run_extract` is wrapped by a spy where needed.

- **Req 7.1, 7.2.** `POST {"document_id": "demo_pca.pdf", "replay": true}` returns 200 with exactly the keys `document_id`, `mode`, `fields`, `originals`, `sources`. The spy shows `run_extract` called once, and `fields` equals `run_extract(...).model_dump(mode="json")["fields"]`. A live request with a fake that returns the replay fixture's response is called once.
- **Action round trip.** Send the 200 response back as `previous` with one valid edit and one valid confirm. The fake is called 0 times, the edited field is `human_supplied`, the confirmed field is `confirmed`, and `originals` holds the pre-edit field. A list with one invalid action returns 422 `invalid_action`, and no action is applied.
- **Req 7.5, 10.3, 10.9.** Invalid JSON, `{}`, `{"document_id": "demo_pca.pdf", "extra": 1}`, and `actions` without `previous` each return 422 with `run_extract` not called. `{"document_id": "../requirements.txt"}` returns 403 `document_not_allowed`.
- **Req 7.6.** Fakes that raise each `ExtractError` subtype, or a plain `RuntimeError`, return the mapped status with `{"detail": {"error": ...}}` and no `fields` key.

### Coverage map

| Requirement | Covered by |
|---|---|
| 1.1 to 1.5 | PDF reader examples |
| 1.6 | Property 23 |
| 2.1 | Property 13 |
| 2.2 | schema example |
| 2.3 | Property 8, `collapsed_range` fixture |
| 2.4 | Property 9, `removal_cost_trap` and `ungrounded_number` fixtures |
| 2.5 | Property 11 |
| 2.6 | Property 14, `not_json_schema` fixture |
| 2.7 | Property 12, `extra_field` fixture |
| 2.8, 2.9 | Property 6 |
| 2.10, 2.11 | Property 7 |
| 2.12 | Property 5 |
| 2.13, 2.14 | prompt example |
| 2.15 | Property 1 (validator applies to any LLM output) |
| 3.1 to 3.5 | Property 1, `bad_quote`, `wrong_page`, `page_out_of_range`, `whitespace_quote` fixtures |
| 3.6 | Property 3 |
| 3.7 | structure example |
| 3.8, 3.9 | Property 7 |
| 3.10, 3.11 | Property 6 |
| 3.12 | Property 5 |
| 3.13 to 3.15 | Property 10, wrapped-quote example, `wrapped_quote` and `case_changed_quote` fixtures |
| 3.16 | Property 9 |
| 3.17 | Property 4 |
| 4.1 to 4.5, 4.7 | Property 2, roof-age negative fixtures, golden test |
| 4.6 | Property 22 |
| 5.1 to 5.4 | Property 3 |
| 6.1 to 6.3, 6.13 | Property 4 |
| 6.4 | Property 15 |
| 6.5, 6.8, 6.12, 6.14 | Property 18 |
| 6.6 | Property 16 |
| 6.7, 6.9, 6.10 | Property 17 |
| 6.11 | Property 13, round-trip example |
| 6.15 | round-trip example |
| 7.1, 7.2, 7.6 | endpoint tests |
| 7.3 | endpoint equality test and code review |
| 7.4 | structure example |
| 7.5 | endpoint tests |
| 8.1 | Property 1, golden test |
| 8.2 | Property 4 |
| 8.3, 8.4 | Property 21, golden test |
| 8.5 | Property 22 |
| 9.1 to 9.3 | conftest guard, missing-fixture example, fixture naming example |
| 9.4, 9.9, 9.10 | golden test, Property 19 |
| 9.5 to 9.8 | Properties 2, 3, 1, 4 |
| 10.1 | replay default example |
| 10.2, 10.3 | Property 20, endpoint test |
| 10.4 to 10.6 | Properties 13, 19 |
| 10.7 | missing replay fixture example |
| 10.8 | fixture naming example |
| 10.9 | round-trip example, endpoint test |

## Settled Decisions

1. **Response shape.** `ExtractionResult` has exactly `document_id`, `mode` (`"live"` or `"replay"`), `fields`, `originals`, and `sources`. There is no `page_count` in the response. `sources` is always `[]`.
2. **Actions on `POST /api/extract`.** The request carries `previous` plus `actions`, a discriminated union of `EditAction` and `ConfirmAction` on the `action` key. The round trip re-validates `previous.fields` against the page text, then applies the actions all-or-nothing, with no LLM call. `actions` without `previous` is malformed. `previous.document_id` must equal the request `document_id`. This replaces the earlier `edits`/`FieldEdit` design.
3. **No assumption ids.** The `evidence.document_id` assumption-id convention is dropped. `ensure_sourced` turns an unsourced extracted or confirmed field into `missing` with a request, and never raises (Req 8.5).
4. **Strict roof-age guard.** Accepted as designed, plus `roof_date_stated` for Req 4.7: both Roof_Age_Fields need a quote that states a roof installation, replacement, or reroofing date with a year.
5. **An edit clears the other slots.** Accepted.
6. **Quote matching.** `collapse(quote) in collapse(page_text)` with `collapse(s) = re.sub(r"\s+", " ", s)`, no other normalization. Empty or whitespace-only quotes count as missing evidence. The prompt no longer requires a quote to sit on one line. The validator module is `src/extract/validate.py`, following `ai-rules.md`.
7. **Numeric grounding.** Implemented literally per Req 3.16 in the section "Numeric grounding (Req 3.16)", with the range-collapse guard and date-year grounding kept.
8. **Replay and allowlist.** `DOCUMENT_ALLOWLIST = {"demo_pca.pdf": "llm_extract_demo_pca.handmade.json"}` is checked before any file access. Replay loads the fixture's `response` and runs the same parse and validation path as live. A missing replay fixture returns 503 `replay_fixture_missing`. Fixtures are named `*.handmade.json`; only a response captured from a real LLM call may be `*.recorded.json`. A round trip's `mode` follows the request's `replay` flag.
9. **Build order.** `src/llm.py`, `src/extract/`, and their tests come first. The `/api/extract` route and its endpoint tests are added last to the `api/index.py` that the setup task creates.
10. **Human-supplied fields and validation.** The validator leaves `human_supplied` fields unchanged (Req 3.17). `apply_action` enforces slot, format, and evidence rules for edits, and `check_previous` enforces them for a submitted `previous`.
11. **Edit evidence.** Edit evidence is `{page, quote, document_id?}`. It is stored with the request's `document_id` and `source_type="synthetic_document"`. A different `document_id`, an out-of-range page, or a quote not found on the page makes the action invalid. `src/contract.py` is unchanged.
12. **Confirm rules.** Confirm on `confirmed` is idempotent. Confirm requires the field to be non-missing after re-validation of `previous`.
13. **Number fields accept ranges.** Every Numeric_Field may hold a single `value` or a `value_range`, as Req 6.1 describes for edits. Year fields require whole numbers.

### Requirement gaps noted

These design rules reject inputs that the requirements do not list explicitly. They follow from Req 4.6, 6.13, and the user's decisions, but the requirements could name them if wanted:

- Req 6.12 lists the invalid-action cases. The design also rejects edit evidence whose `document_id` differs from the request or whose quote is not on the cited page (decision 11).
- `check_previous` rejects a `previous` with a malformed or unsourced `human_supplied` field (`invalid_previous`), which Req 6 does not mention.
- Req 4.7 makes `roof_age_years` require an explicit roof date in its quote, so "The roof is 12 years old." alone stays missing.
