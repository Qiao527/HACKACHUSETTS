# Requirements Document

## Introduction

This feature adds document extraction to SolarAlign. It reads a selectable-text diligence PDF page by page, calls the Large Language Model exactly once to produce structured JSON, and then validates every extracted value in deterministic Python code so that each value carries a page number and an exact quote found on that page. The feature exposes a single endpoint, `POST /api/extract`, that acts as a thin layer over the pure functions in `src/extract/`.

The core non-negotiable rules this feature enforces: every value shows its source; the Large Language Model never computes or invents numbers; roof age is never inferred from building construction year; validation is deterministic and idempotent; and a human edit marks a field `human_supplied` while preserving the original extraction. All tests use recorded fixtures and the ground-truth file; they never call the real Large Language Model or any live API.

The output of extraction is a list of `InputField` objects as defined in the frozen contract `src/contract.py`. The target fields are those recorded in `data/demo_documents/expected_fields.json` for `data/demo_documents/demo_pca.pdf`: `report_date`, `building_construction_year`, `building_type`, `roof_type`, `roof_remaining_life_years` (range `[2, 4]`), `roof_replacement_cost` (`300000`), `structural_capacity_assessed` (`false`), `tenant_electricity_arrangement` (`"separately metered; tenants pay"`), `roof_installation_year` (missing), and `roof_age_years` (missing).

## Glossary

- **Extraction_System**: The pure-function document extraction module in `src/extract/` that reads a PDF, invokes the Large Language Model once, validates results, and returns a list of `InputField` objects.
- **PDF_Reader**: The component of the Extraction_System that reads a selectable-text PDF page by page using pypdf and produces per-page text.
- **LLM_Caller**: The single call to `call_llm(prompt, schema)` in `src/llm.py` that returns structured JSON. The LLM_Caller is the only place an LLM is invoked.
- **Evidence_Validator**: The deterministic Python component of the Extraction_System that checks each extracted value against its claimed page quote and assigns status.
- **Extract_Endpoint**: The FastAPI route `POST /api/extract` in `api/index.py` that parses the request, calls the Extraction_System, and returns JSON.
- **InputField**: The Pydantic v2 model in `src/contract.py` carrying `field`, `value`, `value_range`, `unit`, `status`, `evidence`, `confirmed_by_user`, and `request`.
- **Evidence**: The Pydantic v2 model in `src/contract.py` carrying `document_id`, `page` (>= 1), `evidence_text`, and `source_type`.
- **Evidence_Text**: The exact words copied from a page, stored in `Evidence.evidence_text`, that must literally appear in that page's text.
- **Status**: One of `extracted_unconfirmed`, `confirmed`, `missing`, `conflicting`, `human_supplied`.
- **Roof_Age_Fields**: The fields `roof_installation_year` and `roof_age_years`.
- **Target_Fields**: The set of fields recorded in `data/demo_documents/expected_fields.json`.
- **Ground_Truth_File**: The file `data/demo_documents/expected_fields.json` holding the known-correct extraction for the demo document.
- **Demo_Document**: The synthetic PDF `data/demo_documents/demo_pca.pdf`.
- **Fixture**: A recorded Large Language Model output or recorded input stored under `data/fixtures/`, used by tests instead of a live call.
- **Sources**: The `sources: list[str]` list of policy constant keys and assumption identifiers carried by a result object.

## Requirements

### Requirement 1: Read the PDF page by page

**User Story:** As the extraction pipeline, I want the diligence PDF read page by page, so that every extracted value can be traced to the page it came from.

#### Acceptance Criteria

1. WHEN a selectable-text PDF is provided, THE PDF_Reader SHALL extract text for each page using pypdf and produce a per-page text collection ordered by ascending page number.
2. THE PDF_Reader SHALL number pages as 1-indexed integers, where the first page is page 1, matching the `page` field of the Evidence model.
3. THE PDF_Reader SHALL preserve each page's extracted text character-for-character, performing no trimming, re-encoding, or reordering, so that an exact-substring match of a quote against that page's text succeeds.
4. WHEN a page contains no extractable text, THE PDF_Reader SHALL emit an empty text entry for that page and SHALL retain the page numbering of all remaining pages.
5. IF the provided PDF contains no extractable text on any page, THEN THE PDF_Reader SHALL return an empty per-page text collection and signal that no text was extractable.
6. IF the provided input is not a PDF or is a corrupt PDF that cannot be read, THEN THE PDF_Reader SHALL return an error indication identifying the input as unreadable and SHALL produce no per-page text collection.

### Requirement 2: Call the Large Language Model once for structured JSON

**User Story:** As the extraction pipeline, I want a single structured LLM call, so that the model proposes field values and their claimed evidence without computing numbers.

#### Acceptance Criteria

1. WHEN extraction runs for one document, THE Extraction_System SHALL invoke the LLM_Caller exactly once (one call, not zero and not more than one) through `call_llm(prompt, schema)` in `src/llm.py`.
2. WHEN extraction runs, THE Extraction_System SHALL request structured JSON that supplies, for each Target_Field, a proposed value, a claimed page number that is an integer greater than or equal to 1, and a claimed quote as a non-empty string of at most 2000 characters.
3. WHERE a Target_Field value is a range, THE Extraction_System SHALL populate `value_range` as an ordered pair in which the lower bound is less than or equal to the upper bound, and SHALL NOT collapse the range to a single value.
4. THE Extraction_System SHALL treat the Large Language Model output solely as candidate values and claimed evidence, and SHALL compute, interpolate, round, or otherwise derive no numeric value from the Large Language Model output.
5. IF the Large Language Model output omits a Target_Field, THEN THE Extraction_System SHALL set that field's status to `missing`, set its value to empty (no value), and retain the remaining extracted fields unchanged.
6. IF the Large Language Model output is not valid JSON conforming to the requested schema, THEN THE Extraction_System SHALL reject the output, produce no partial field results, and return an error indication identifying the schema validation failure.
7. IF the Large Language Model output includes a field name that is not a defined Target_Field, THEN THE Extraction_System SHALL discard that field and retain all valid Target_Fields.

### Requirement 3: Validate evidence and quote in code

**User Story:** As a reviewer, I want every extracted value backed by a page number and an exact quote found on that page, so that I can trust each value's source.

#### Acceptance Criteria

1. WHEN a field is extracted with a claimed page and quote, THE Evidence_Validator SHALL set that field's status to `extracted_unconfirmed` only if the claimed Evidence_Text literally appears, as a contiguous exact-character substring, in the extracted text of the claimed page.
2. IF a field's claimed Evidence_Text does not appear as a contiguous exact-character substring of the claimed page's extracted text, THEN THE Evidence_Validator SHALL set that field's status to `missing` and clear both `value` and `value_range` for that field.
3. IF a field's claimed page number is less than 1 or greater than the document's page count, THEN THE Evidence_Validator SHALL set that field's status to `missing`.
4. IF a field is extracted with an empty-string or absent quote, or with an empty-string or absent page number, THEN THE Evidence_Validator SHALL set that field's status to `missing`.
5. WHEN the Evidence_Validator marks a field `missing`, THE Evidence_Validator SHALL populate the field's `request` with a non-empty string describing what to obtain.
6. WHEN the Evidence_Validator validates the same input two or more times, THE Evidence_Validator SHALL produce identical output on every run for that input.
7. THE Evidence_Validator SHALL run in deterministic Python code and SHALL NOT invoke the Large Language Model.

### Requirement 4: Never infer roof age from building age

**User Story:** As an owner relying on the result, I want roof age to come only from roofing records, so that a reported roof age is never a guess based on building construction year.

#### Acceptance Criteria

1. WHEN the Demo_Document contains no explicit roof installation date and no explicit roof replacement date, THE Extraction_System SHALL set each Roof_Age_Field status to `missing` regardless of whether a building construction year is present.
2. THE Extraction_System SHALL NOT derive `roof_age_years` or `roof_installation_year` from `building_construction_year`, including when a `building_construction_year` value is present.
3. WHEN a Roof_Age_Field is `missing`, THE Extraction_System SHALL set that field's `request` to a non-empty string instructing the reader to obtain roofing records and to not infer roof age from building construction.
4. WHEN a Roof_Age_Field is `missing`, THE Extraction_System SHALL leave `value`, `value_range`, and `evidence` unset for that field.
5. WHEN a `building_construction_year` value is present and the Demo_Document contains no explicit roof installation or replacement date, THE Extraction_System SHALL set each Roof_Age_Field status to `missing` and SHALL leave each Roof_Age_Field `value` and `value_range` unset.

### Requirement 5: Validation is idempotent

**User Story:** As a developer, I want validation to be repeatable, so that re-validating an already validated extraction produces the same result.

#### Acceptance Criteria

1. WHEN the Evidence_Validator validates an extraction that was already produced by a prior Evidence_Validator run, THE Evidence_Validator SHALL return a result in which every InputField has the same `field`, `value`, `value_range`, `unit`, `status`, `evidence`, `confirmed_by_user`, and `request` as the corresponding InputField in the prior result.
2. WHILE a field already satisfies the validation rules, THE Evidence_Validator SHALL leave that field's `status`, `value`, `value_range`, `evidence`, and `request` unchanged on every subsequent validation.
3. WHEN the Evidence_Validator validates the same extraction two or more consecutive times, THE Evidence_Validator SHALL produce a result equal field-by-field to the result of the first of those validations, for every InputField in the collection.
4. WHILE a field has status `missing`, THE Evidence_Validator SHALL leave that field's `status` as `missing` and leave its `value`, `value_range`, `evidence`, and `request` unchanged on every subsequent validation.

### Requirement 6: Human edits produce human_supplied status and preserve the original extraction

**User Story:** As a reviewer, I want my edits recorded as human-supplied while keeping the original extracted value, so that the provenance of a corrected value stays visible.

#### Acceptance Criteria

1. WHEN a user submits a new value for a field, THE Extraction_System SHALL set that field's status to `human_supplied` and set that field's value to the submitted value.
2. WHEN a user submits a new value for a field, THE Extraction_System SHALL retain the field's original extracted value, original value_range, and original evidence as they stood before the edit, and SHALL keep them retrievable after the edit.
3. WHEN a user submits a new value for a field, THE Extraction_System SHALL set `confirmed_by_user` to true for that field.
4. WHEN a user edit is applied to one field, THE Extraction_System SHALL leave every other field's value, value_range, status, evidence, and confirmed_by_user unchanged.
5. IF a user submits an edit whose value is not valid for the field's unit, THEN THE Extraction_System SHALL reject the edit, leave the field's value, value_range, status, and evidence unchanged, and signal that the edit was rejected as invalid.
6. WHEN a user edits a field whose status is already `human_supplied`, THE Extraction_System SHALL keep the retained original extracted value, original value_range, and original evidence equal to the first extraction result rather than replacing them with the previously edited value.

### Requirement 7: Expose POST /api/extract as a thin layer

**User Story:** As the frontend, I want a single extraction endpoint, so that I can request extraction without the API performing any calculation.

#### Acceptance Criteria

1. WHEN a well-formed `POST /api/extract` request is received, THE Extract_Endpoint SHALL parse the request body and invoke the Extraction_System in `src/extract/` exactly once.
2. WHEN the Extraction_System returns successfully, THE Extract_Endpoint SHALL return the resulting list of InputField objects as JSON without modifying any field value.
3. THE Extract_Endpoint SHALL perform no extraction, validation of extracted content, or calculation itself.
4. THE Extraction_System in `src/` SHALL NOT import from `api/` or `app/`.
5. IF the request body is malformed or cannot be parsed into the expected request shape, THEN THE Extract_Endpoint SHALL reject the request, return an error response that identifies the request as malformed, and invoke neither the Extraction_System nor any calculation.
6. IF the Extraction_System raises an error or fails to return a result, THEN THE Extract_Endpoint SHALL return an error response that indicates extraction failure and SHALL NOT return any InputField objects.

### Requirement 8: Every result carries sources

**User Story:** As the UI, I want each extraction result to carry its sources, so that citations can be shown.

#### Acceptance Criteria

1. WHEN a field is extracted from the Demo_Document, THE Extraction_System SHALL assign that field's `Evidence.source_type` the value `synthetic_document`.
2. WHERE a field is drawn from a source other than the Demo_Document, THE Extraction_System SHALL assign that field's `Evidence.source_type` the value defined for that source by the frozen contract `src/contract.py`.
3. WHEN extraction produces a result object, THE Extraction_System SHALL populate the `sources` list with exactly the policy constant keys and assumption identifiers used, containing no duplicate entries.
4. WHEN extraction produces a result object that used no policy constant keys and no assumption identifiers, THE Extraction_System SHALL populate the `sources` list as an empty collection.
5. IF a field has no identifiable source, THEN THE Extraction_System SHALL reject that result, retain no partial result for that field, and return an error indication identifying the missing source.

### Requirement 9: Fixture-based testing that never hits the real Large Language Model

**User Story:** As a developer, I want deterministic tests against recorded fixtures, so that the extraction is verified without calling the real Large Language Model or live APIs.

#### Acceptance Criteria

1. WHEN a test executes an extraction that would otherwise call the Large Language Model, THE tests SHALL substitute recorded Fixtures from `data/fixtures/` for that call.
2. THE tests SHALL NOT issue any network request to the real Large Language Model or any live API, and THE tests SHALL produce identical results across repeated runs on the same inputs.
3. IF a required Fixture is absent from `data/fixtures/` when a test executes, THEN THE tests SHALL fail with an error indicating the missing Fixture and SHALL NOT fall back to a live Large Language Model or live API call.
4. WHEN extraction runs against the Demo_Document using recorded Fixtures, THE tests SHALL assert that every resulting field equals the corresponding Ground_Truth_File entry for each of the attributes field, status, value, value_range, unit, evidence, and request, where equality is an exact match for text attributes and an exact numeric match for value and value_range bounds.
5. THE tests SHALL assert that each Roof_Age_Field resolves to status `missing` when the Demo_Document contains no explicit roof installation or replacement date (property test for Requirement 4).
6. THE tests SHALL assert that validating an already validated extraction returns a result equal to the input extraction across all field attributes (property test for Requirement 5).
7. WHEN a field has status `extracted_unconfirmed`, THE tests SHALL assert that the field's Evidence_Text appears as a literal substring on the claimed page and that the claimed page number is present and is a positive integer (property test for Requirement 3).
8. WHEN a human edit is applied to a field, THE tests SHALL assert that the field's status becomes `human_supplied`, the original extracted value and evidence are preserved, and all other fields in the extraction remain unchanged (property test for Requirement 6).
