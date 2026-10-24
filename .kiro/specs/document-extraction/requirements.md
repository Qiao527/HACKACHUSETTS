# Requirements Document

## Introduction

This feature adds document extraction to SolarAlign. It reads a selectable-text diligence PDF page by page, obtains structured JSON from the Large Language Model (one call in a live extraction, or a hand-made fixture in replay mode), and then validates every extracted value in deterministic Python code so that each value carries a page number and a quote found on that page. The feature exposes a single endpoint, `POST /api/extract`, that acts as a thin layer over the pure functions in `src/extract/`. The same endpoint also accepts a previous Extraction_Result plus a list of human edit and confirm actions; that round trip makes no Large Language Model call.

The core non-negotiable rules this feature enforces: every value shows its source; the Large Language Model never computes or invents numbers; roof age is never inferred from building construction year; document text is data, never instructions; validation is deterministic and idempotent; and a human edit marks a field `human_supplied` while preserving the original extraction. All tests use fixtures and the ground-truth file; they never call the real Large Language Model or any live API.

The output of extraction is an Extraction_Result whose `fields` list holds `InputField` objects as defined in the frozen contract `src/contract.py`. The target fields are those recorded in `data/demo_documents/expected_fields.json` for `data/demo_documents/demo_pca.pdf`. Numeric values live in `value` (or `value_range` for a stated range); non-numeric values live in `text_value`. The expected value of each target field and the attribute that holds it:

- `report_date`: `text_value` `"2026-10-24"` (unit `date`)
- `building_construction_year`: `value` `1979` (unit `year`)
- `building_type`: `text_value` `"low-rise multi-tenant warehouse"` (unit `text`)
- `roof_type`: `text_value` `"low-slope modified-bitumen membrane"` (unit `text`)
- `roof_remaining_life_years`: `value_range` `[2, 4]` (unit `years`)
- `roof_replacement_cost`: `value` `300000` (unit `USD (2024 real)`)
- `structural_capacity_assessed`: `text_value` `"false"` (unit `boolean`); this is the inspection limitation
- `tenant_electricity_arrangement`: `text_value` `"separately metered; tenants pay"` (unit `text`)
- `roof_installation_year`: missing
- `roof_age_years`: missing

## Glossary

- **Extraction_System**: The pure-function document extraction module in `src/extract/` that reads a PDF, obtains Large Language Model output (live or replayed), validates results, applies human actions, and returns an Extraction_Result.
- **PDF_Reader**: The component of the Extraction_System that reads a selectable-text PDF page by page using pypdf and produces per-page text.
- **LLM_Caller**: The single call to `call_llm(prompt, schema)` in `src/llm.py` that returns structured JSON. The LLM_Caller is the only place an LLM is invoked.
- **Evidence_Validator**: The deterministic Python component of the Extraction_System that checks each extracted value against its claimed page quote and assigns status.
- **Extract_Endpoint**: The FastAPI route `POST /api/extract` in `api/index.py` that parses the request, calls the Extraction_System, and returns JSON.
- **Extraction_Request**: The request body of `POST /api/extract`, shaped `{"document_id": "demo_pca.pdf", "replay": false, "previous": <Extraction_Result, optional>, "actions": <list of Action, optional>}`, where `replay` defaults to false.
- **Extraction_Result**: The JSON object returned by the Extraction_System, with exactly the keys `document_id`, `mode`, `fields` (the list of InputField objects), `originals` (the Originals), and `sources`.
- **Originals**: The map, held in the Extraction_Result key `originals`, from field name to the InputField as that field stood before its first human edit.
- **Live_Extraction**: An Extraction_Request with `replay` false and no `previous`, in which the Extraction_System obtains Large Language Model output from the LLM_Caller.
- **Replay_Extraction**: An Extraction_Request with `replay` true, in which the Extraction_System obtains Large Language Model output from the Replay_Fixture.
- **Action_Round_Trip**: An Extraction_Request that carries a `previous` Extraction_Result and a list of Actions.
- **Action**: One human instruction in an Action_Round_Trip, either an Edit_Action or a Confirm_Action.
- **Edit_Action**: An Action shaped `{"field": <name>, "action": "edit", "value": <new value>, "evidence": <optional object with page and quote>}`.
- **Confirm_Action**: An Action shaped `{"field": <name>, "action": "confirm"}`.
- **Document_Allowlist**: The fixed list of file names in `data/demo_documents/` that the Extraction_System accepts as `document_id`.
- **Replay_Fixture**: The hand-made file `data/fixtures/llm_extract_demo_pca.handmade.json` that stands in for the Large Language Model response for the Demo_Document.
- **Whitespace_Collapse**: Replacing every run of one or more whitespace characters with a single space character, with no other change to the string.
- **InputField**: The Pydantic v2 model in `src/contract.py` carrying `field`, `value`, `text_value`, `value_range`, `unit`, `status`, `evidence`, `confirmed_by_user`, and `request`.
- **Evidence**: The Pydantic v2 model in `src/contract.py` carrying `document_id`, `page` (>= 1), `evidence_text`, and `source_type`.
- **Evidence_Text**: The words copied from a page, stored in `Evidence.evidence_text` exactly as supplied, that must appear in that page's text when both are compared after Whitespace_Collapse.
- **Status**: One of `extracted_unconfirmed`, `confirmed`, `missing`, `conflicting`, `human_supplied`.
- **Roof_Age_Fields**: The fields `roof_installation_year` and `roof_age_years`.
- **Target_Fields**: The set of fields recorded in `data/demo_documents/expected_fields.json`.
- **Numeric_Field**: A Target_Field whose unit is numeric (for example `year`, `years`, `USD (2024 real)`); its value is held in `value`, or in `value_range` when the source states a range.
- **Text_Field**: A Target_Field whose unit is `date`, `text`, or `boolean`; its value is held in `text_value`.
- **Value_Slots**: The three InputField attributes `value`, `text_value`, and `value_range`.
- **Ground_Truth_File**: The file `data/demo_documents/expected_fields.json` holding the known-correct extraction for the demo document.
- **Demo_Document**: The synthetic PDF `data/demo_documents/demo_pca.pdf`.
- **Fixture**: A stored Large Language Model output or stored input under `data/fixtures/`, used by tests and by Replay_Extraction instead of a live call. A hand-made Fixture is named `*.handmade.json`; only a response captured from a real Large Language Model call is named `*.recorded.json`.
- **Sources**: The `sources: list[str]` list carried by a result object; for extraction this list is always empty.

## Requirements

### Requirement 1: Read the PDF page by page

**User Story:** As the extraction pipeline, I want the diligence PDF read page by page, so that every extracted value can be traced to the page it came from.

#### Acceptance Criteria

1. WHEN a selectable-text PDF is provided, THE PDF_Reader SHALL extract text for each page using pypdf and produce a per-page text collection ordered by ascending page number.
2. THE PDF_Reader SHALL number pages as 1-indexed integers, where the first page is page 1, matching the `page` field of the Evidence model.
3. THE PDF_Reader SHALL store each page's extracted text unchanged, performing no trimming, re-encoding, reordering, or whitespace normalization, so that Whitespace_Collapse is applied only at comparison time by the Evidence_Validator.
4. WHEN a page contains no extractable text, THE PDF_Reader SHALL emit an empty text entry for that page and SHALL retain the page numbering of all remaining pages.
5. IF the provided PDF contains no extractable text on any page, THEN THE PDF_Reader SHALL return an empty per-page text collection and signal that no text was extractable.
6. IF the provided input is not a PDF or is a corrupt PDF that cannot be read, THEN THE PDF_Reader SHALL return an error indication identifying the input as unreadable and SHALL produce no per-page text collection.

### Requirement 2: Call the Large Language Model once for structured JSON

**User Story:** As the extraction pipeline, I want a single structured LLM call, so that the model proposes field values and their claimed evidence without computing numbers.

#### Acceptance Criteria

1. WHEN a Live_Extraction runs for one document, THE Extraction_System SHALL invoke the LLM_Caller exactly once (one call, not zero and not more than one) through `call_llm(prompt, schema)` in `src/llm.py`.
2. WHEN a Live_Extraction runs, THE Extraction_System SHALL request structured JSON that supplies, for each Target_Field, a proposed value, a claimed page number that is an integer greater than or equal to 1, and a claimed quote as a non-empty string of at most 2000 characters.
3. WHERE a Target_Field value is a range, THE Extraction_System SHALL populate `value_range` as an ordered pair in which the lower bound is less than or equal to the upper bound, and SHALL NOT collapse the range to a single value.
4. THE Extraction_System SHALL treat the Large Language Model output solely as candidate values and claimed evidence, and SHALL compute, interpolate, round, or otherwise derive no numeric value from the Large Language Model output.
5. IF the Large Language Model output omits a Target_Field, THEN THE Extraction_System SHALL set that field's status to `missing`, leave all Value_Slots (`value`, `text_value`, and `value_range`) empty for that field, populate that field's `request` with a non-empty string naming the document or record that would resolve the field, and retain the remaining extracted fields unchanged.
6. IF the Large Language Model output is not valid JSON conforming to the requested schema, THEN THE Extraction_System SHALL reject the output, produce no partial field results, and return an error indication identifying the schema validation failure.
7. IF the Large Language Model output includes a field name that is not a defined Target_Field, THEN THE Extraction_System SHALL discard that field and retain all valid Target_Fields.
8. WHERE a Numeric_Field value is stated by the source as a single number, THE Extraction_System SHALL place that number in `value`.
9. THE Extraction_System SHALL place the value of each Text_Field in `text_value`.
10. WHERE a Text_Field has unit `date`, THE Extraction_System SHALL express that field's `text_value` as an ISO 8601 calendar date in the form YYYY-MM-DD.
11. WHERE a Text_Field has unit `boolean`, THE Extraction_System SHALL set that field's `text_value` to exactly the string `"true"` or exactly the string `"false"`.
12. WHILE a Target_Field has a status other than `missing`, THE Extraction_System SHALL populate exactly one Value_Slot for that field: `value` alone, `text_value` alone, or `value_range` alone.
13. THE Extraction_System SHALL treat document text as data and SHALL NOT follow instructions contained in the document.
14. WHEN a Live_Extraction builds the prompt for the LLM_Caller, THE Extraction_System SHALL state in the prompt that document text is data and that instructions contained in the document are to be ignored.
15. THE Evidence_Validator SHALL apply every validation rule of Requirement 3 and Requirement 4 to all Large Language Model output, including output influenced by instructions contained in the document.

### Requirement 3: Validate evidence and quote in code

**User Story:** As a reviewer, I want every extracted value backed by a page number and a quote found on that page, so that I can trust each value's source.

#### Acceptance Criteria

1. WHEN a field is extracted with a claimed page and quote, THE Evidence_Validator SHALL set that field's status to `extracted_unconfirmed` only if the claimed Evidence_Text matches the claimed page's extracted text under the comparison rule of criterion 13.
2. IF a field's claimed Evidence_Text does not match the claimed page's extracted text under the comparison rule of criterion 13, THEN THE Evidence_Validator SHALL set that field's status to `missing` and clear all Value_Slots (`value`, `text_value`, and `value_range`) for that field.
3. IF a field's claimed page number is less than 1 or greater than the document's page count, THEN THE Evidence_Validator SHALL set that field's status to `missing`.
4. IF a field is extracted with an empty-string or absent quote, or with an empty-string or absent page number, THEN THE Evidence_Validator SHALL set that field's status to `missing`.
5. WHEN the Evidence_Validator marks a field `missing`, THE Evidence_Validator SHALL populate the field's `request` with a non-empty string naming the document or record that would resolve the field.
6. WHEN the Evidence_Validator validates the same input two or more times, THE Evidence_Validator SHALL produce identical output on every run for that input.
7. THE Evidence_Validator SHALL run in deterministic Python code and SHALL NOT invoke the Large Language Model.
8. IF a Text_Field with unit `date` has a `text_value` that is not a valid ISO 8601 calendar date in the form YYYY-MM-DD, THEN THE Evidence_Validator SHALL set that field's status to `missing`, clear all Value_Slots for that field, and populate the field's `request` with a non-empty string naming the document or record that would resolve the field.
9. IF a Text_Field with unit `boolean` has a `text_value` other than exactly `"true"` or exactly `"false"`, THEN THE Evidence_Validator SHALL set that field's status to `missing`, clear all Value_Slots for that field, and populate the field's `request` with a non-empty string naming the document or record that would resolve the field.
10. IF a field holds its value in a Value_Slot that does not match its unit (a Numeric_Field with `text_value` populated, or a Text_Field with `value` or `value_range` populated), THEN THE Evidence_Validator SHALL set that field's status to `missing`, clear all Value_Slots for that field, and populate the field's `request` with a non-empty string naming the document or record that would resolve the field.
11. IF a field has more than one Value_Slot populated, THEN THE Evidence_Validator SHALL set that field's status to `missing`, clear all Value_Slots for that field, and populate the field's `request` with a non-empty string naming the document or record that would resolve the field.
12. WHILE a field has status `missing`, THE Evidence_Validator SHALL keep all Value_Slots of that field empty.
13. THE Evidence_Validator SHALL compare a quote to the claimed page's text by applying Whitespace_Collapse to both the quote and the page text and then checking whether the collapsed quote is a substring of the collapsed page text, with no other normalization (no case folding, no punctuation or Unicode changes, and no trimming beyond the Whitespace_Collapse).
14. WHEN a quote's words wrap across a line break in the claimed page's text, THE Evidence_Validator SHALL treat the quote as matching under the comparison rule of criterion 13.
15. THE Evidence_Validator SHALL keep the stored `Evidence.evidence_text` exactly as the Large Language Model supplied it, without Whitespace_Collapse or any other normalization.
16. IF a Numeric_Field's `value`, or either bound of its `value_range`, does not appear as a number in the quote after every `$` and `,` character is removed from the quote, THEN THE Evidence_Validator SHALL set that field's status to `missing`, clear all Value_Slots for that field, and populate the field's `request` with a non-empty string naming the document or record that would resolve the field.
17. WHILE a field's status is `human_supplied`, THE Evidence_Validator SHALL leave that field unchanged, because the field's source is the human edit rather than a page quote.

### Requirement 4: Never infer roof age from building age

**User Story:** As an owner relying on the result, I want roof age to come only from roofing records, so that a reported roof age is never a guess based on building construction year.

#### Acceptance Criteria

1. WHEN the Demo_Document contains no explicit roof installation date and no explicit roof replacement date, THE Extraction_System SHALL set each Roof_Age_Field status to `missing` regardless of whether a building construction year is present.
2. THE Extraction_System SHALL NOT derive `roof_age_years` or `roof_installation_year` from `building_construction_year`, including when a `building_construction_year` value is present.
3. WHEN a Roof_Age_Field is `missing`, THE Extraction_System SHALL set that field's `request` to a non-empty string instructing the reader to obtain roofing records and to not infer roof age from building construction.
4. WHEN a Roof_Age_Field is `missing`, THE Extraction_System SHALL leave `value`, `text_value`, `value_range`, and `evidence` unset for that field.
5. WHEN a `building_construction_year` value is present and the Demo_Document contains no explicit roof installation or replacement date, THE Extraction_System SHALL set each Roof_Age_Field status to `missing` and SHALL leave each Roof_Age_Field `value`, `text_value`, and `value_range` unset.
6. WHEN a Roof_Age_Field has any Value_Slot (`value`, `text_value`, or `value_range`) set and its status is not `missing`, THE Extraction_System SHALL require that field to carry supporting `evidence`, and SHALL NOT report a present Roof_Age_Field value without accompanying evidence.
7. WHEN a Roof_Age_Field's quote does not explicitly state a roof installation, replacement, or reroofing date, THE Evidence_Validator SHALL set that Roof_Age_Field's status to `missing`, clear all Value_Slots for that field, and set its `request` to the roofing-records request of criterion 3.
8. WHEN a quote states a roof age (for example "the roof is 12 years old") without also explicitly stating a roof installation, replacement, or reroofing date, THE Evidence_Validator SHALL set `roof_age_years` to `missing`, clear all Value_Slots for that field, and set its `request` to the roofing-records request of criterion 3.

### Requirement 5: Validation is idempotent

**User Story:** As a developer, I want validation to be repeatable, so that re-validating an already validated extraction produces the same result.

#### Acceptance Criteria

1. WHEN the Evidence_Validator validates an extraction that was already produced by a prior Evidence_Validator run, THE Evidence_Validator SHALL return a result in which every InputField has the same `field`, `value`, `text_value`, `value_range`, `unit`, `status`, `evidence`, `confirmed_by_user`, and `request` as the corresponding InputField in the prior result.
2. WHILE a field already satisfies the validation rules, THE Evidence_Validator SHALL leave that field's `status`, `value`, `text_value`, `value_range`, `evidence`, and `request` unchanged on every subsequent validation.
3. WHEN the Evidence_Validator validates the same extraction two or more consecutive times, THE Evidence_Validator SHALL produce a result equal field-by-field to the result of the first of those validations, for every InputField in the collection.
4. WHILE a field has status `missing`, THE Evidence_Validator SHALL leave that field's `status` as `missing` and leave its `value`, `text_value`, `value_range`, `evidence`, and `request` unchanged on every subsequent validation.

### Requirement 6: Human edits and confirmations

**User Story:** As a reviewer, I want to edit or confirm extracted fields, with edits recorded as human-supplied while keeping the original extracted value, so that the provenance of every confirmed or corrected value stays visible.

#### Acceptance Criteria

1. WHEN an Edit_Action is applied to a field, THE Extraction_System SHALL set that field's status to `human_supplied`, store the Edit_Action `value` in the Value_Slot that matches the field's unit (a number goes to `value` for a Numeric_Field, a two-number list `[low, high]` goes to `value_range` for a Numeric_Field, and a string goes to `text_value` for a Text_Field), and clear the other Value_Slots of that field.
2. WHEN an Edit_Action is applied to a field that has no entry in Originals, THE Extraction_System SHALL record in Originals the field's InputField as it stood before the edit, including its original value, original text_value, original value_range, and original evidence.
3. WHEN an Edit_Action is applied to a field, THE Extraction_System SHALL set `confirmed_by_user` to true for that field.
4. WHEN an Action is applied to one field, THE Extraction_System SHALL leave every other field's value, text_value, value_range, status, evidence, and confirmed_by_user unchanged.
5. IF an Edit_Action's `value` is not valid for the field's unit (non-numeric input for a Numeric_Field, a date for a `date` Text_Field that is not an ISO 8601 calendar date in the form YYYY-MM-DD, a value for a `boolean` Text_Field other than exactly `"true"` or exactly `"false"`, or a range whose lower bound exceeds its upper bound), THEN THE Extraction_System SHALL reject the whole Action_Round_Trip under criterion 12 and signal that the edit was rejected as invalid.
6. WHEN an Edit_Action is applied to a field whose status is already `human_supplied`, THE Extraction_System SHALL keep that field's Originals entry equal to the first extraction result rather than replacing the entry with the previously edited value.
7. WHEN a Confirm_Action is applied to a field, THE Extraction_System SHALL set that field's status to `confirmed`, set `confirmed_by_user` to true, and leave `value`, `text_value`, `value_range`, and `evidence` unchanged.
8. IF a Confirm_Action targets a field whose status is `missing`, THEN THE Extraction_System SHALL reject the Confirm_Action as invalid because the field holds nothing to confirm, and SHALL leave the Extraction_Result unchanged.
9. WHILE a field's status is `human_supplied`, THE Extraction_System SHALL respond to a Confirm_Action on that field by keeping the status `human_supplied` and keeping `confirmed_by_user` true.
10. WHEN a Confirm_Action is applied, THE Extraction_System SHALL leave Originals unchanged.
11. WHEN an Action_Round_Trip is received, THE Extraction_System SHALL re-validate the `previous` fields against the document's page text with the Evidence_Validator, then apply the Actions, and SHALL NOT invoke the LLM_Caller.
12. IF any Action in an Action_Round_Trip is invalid (an unknown field, an unknown action, an invalid value for the field's unit, a Confirm_Action on a `missing` field, an Edit_Action on a Roof_Age_Field without evidence, an Edit_Action whose `evidence` names a document other than the Extraction_Request `document_id`, or an Edit_Action whose `evidence` quote does not match the cited page's text under the comparison rule of Requirement 3 criterion 13), THEN THE Extraction_System SHALL reject the whole Action_Round_Trip, apply none of its Actions, and return an error indication identifying the invalid Action.
13. WHERE an Edit_Action includes an `evidence` object with a page and a quote, THE Extraction_System SHALL store that evidence as the edited field's `evidence`.
14. IF an Edit_Action targets a Roof_Age_Field and carries no `evidence` object, THEN THE Extraction_System SHALL reject the Edit_Action as invalid, consistent with Requirement 4 criterion 6.
15. IF the `previous` Extraction_Result carries a `document_id` different from the Extraction_Request `document_id`, THEN THE Extraction_System SHALL reject the Action_Round_Trip, apply none of its Actions, and return an error indication identifying the document mismatch.
16. IF an Edit_Action's `evidence` names a document other than the Extraction_Request `document_id`, or the Edit_Action's `evidence` quote does not match the cited page's text under the comparison rule of Requirement 3 criterion 13, THEN THE Extraction_System SHALL reject the Edit_Action as invalid under criterion 12.
17. WHEN the Extraction_System stores an Edit_Action's `evidence` as the edited field's `evidence`, THE Extraction_System SHALL set that Evidence's `document_id` to the Extraction_Request `document_id` and its `source_type` to `synthetic_document`.
18. IF the `previous` Extraction_Result contains a `human_supplied` field whose Value_Slots are not valid for the field's unit, or a `human_supplied` Roof_Age_Field without evidence, THEN THE Extraction_System SHALL reject the Action_Round_Trip, apply none of its Actions, and return an error indication identifying the invalid previous result.
19. WHEN a Confirm_Action is applied to a field whose status is already `confirmed`, THE Extraction_System SHALL leave that field unchanged.
20. WHEN an Action_Round_Trip with `replay` true is processed, THE Extraction_System SHALL set the Extraction_Result `mode` to `"replay"` and SHALL NOT invoke the LLM_Caller.
21. WHEN an Action_Round_Trip with `replay` false or absent is processed, THE Extraction_System SHALL set the Extraction_Result `mode` to `"live"` and SHALL NOT invoke the LLM_Caller.

### Requirement 7: Expose POST /api/extract as a thin layer

**User Story:** As the frontend, I want a single extraction endpoint, so that I can request extraction without the API performing any calculation.

#### Acceptance Criteria

1. WHEN a well-formed `POST /api/extract` request is received, THE Extract_Endpoint SHALL parse the request body into an Extraction_Request and invoke the Extraction_System in `src/extract/` exactly once, which in turn invokes the LLM_Caller once for a Live_Extraction and zero times for a Replay_Extraction or an Action_Round_Trip.
2. WHEN the Extraction_System returns successfully, THE Extract_Endpoint SHALL return a JSON object with exactly the keys `document_id`, `mode`, `fields` (the list of InputField objects, unmodified), `originals`, and `sources`.
3. THE Extract_Endpoint SHALL perform no extraction, validation of extracted content, or calculation itself.
4. THE Extraction_System in `src/` SHALL NOT import from `api/` or `app/`.
5. IF the request body is malformed or cannot be parsed into the Extraction_Request shape, THEN THE Extract_Endpoint SHALL reject the request, return an error response that identifies the request as malformed, and invoke neither the Extraction_System nor any calculation.
6. IF the Extraction_System raises an error or fails to return a result, THEN THE Extract_Endpoint SHALL return an error response that indicates extraction failure and SHALL NOT return any InputField objects.

### Requirement 8: Every result carries sources

**User Story:** As the UI, I want each extraction result to carry its sources, so that citations can be shown.

#### Acceptance Criteria

1. WHEN extraction produces a field with status `extracted_unconfirmed` or `confirmed`, THE Extraction_System SHALL assign that field's `Evidence.source_type` the value `synthetic_document`.
2. WHILE a field's status is `human_supplied`, THE Extraction_System SHALL identify the human edit as that field's source through the `human_supplied` status, and SHALL keep the field's extracted evidence in Originals.
3. THE Extraction_System SHALL set the `sources` list of every Extraction_Result to the empty list `[]`.
4. THE Extraction_System SHALL produce no field whose value comes from an assumption, and SHALL use no assumption identifiers in an Extraction_Result.
5. IF a field with status `extracted_unconfirmed` or `confirmed` has no evidence, THEN THE Extraction_System SHALL retain no value for that field, set its status to `missing`, and populate its `request` with a non-empty string naming the document or record that would resolve the field.

### Requirement 9: Fixture-based testing that never hits the real Large Language Model

**User Story:** As a developer, I want deterministic tests against stored fixtures, so that the extraction is verified without calling the real Large Language Model or live APIs.

#### Acceptance Criteria

1. WHEN a test executes an extraction that would otherwise call the Large Language Model, THE tests SHALL substitute Fixtures from `data/fixtures/` for that call, where a hand-made Fixture is named `*.handmade.json` and only a response captured from a real Large Language Model call is named `*.recorded.json`.
2. THE tests SHALL NOT issue any network request to the real Large Language Model or any live API, and THE tests SHALL produce identical results across repeated runs on the same inputs.
3. IF a required Fixture is absent from `data/fixtures/` when a test executes, THEN THE tests SHALL fail with an error indicating the missing Fixture and SHALL NOT fall back to a live Large Language Model or live API call.
4. WHEN extraction runs against the Demo_Document using the Replay_Fixture passed through the same parsing and Evidence_Validator as a live response, THE tests SHALL assert that every resulting field equals the corresponding Ground_Truth_File entry, normalized as defined in criterion 9, for each of the attributes field, status, value, text_value, value_range, unit, evidence, and request, where equality is an exact match for text attributes and an exact numeric match for value and value_range bounds.
5. THE tests SHALL assert that each Roof_Age_Field resolves to status `missing` when the Demo_Document contains no explicit roof installation or replacement date (property test for Requirement 4).
6. THE tests SHALL assert that validating an already validated extraction returns a result equal to the input extraction across all field attributes (property test for Requirement 5).
7. WHEN a field has status `extracted_unconfirmed`, THE tests SHALL assert that the field's Evidence_Text, after Whitespace_Collapse, is a substring of the claimed page's text after Whitespace_Collapse, and that the claimed page number is present and is a positive integer (property test for Requirement 3).
8. WHEN a human edit is applied to a field, THE tests SHALL assert that the field's status becomes `human_supplied`, the original extracted value and evidence are preserved in Originals, and all other fields in the extraction remain unchanged (property test for Requirement 6).
9. WHEN the tests compare an extraction result with the Ground_Truth_File, THE tests SHALL normalize each Ground_Truth_File entry before comparison, because the Ground_Truth_File stores every expected answer in its `value` attribute (strings and JSON booleans included): an entry with a numeric unit keeps its answer in `value`; an entry with unit `date` or `text` has its answer moved unchanged to `text_value`; an entry with unit `boolean` has its answer moved to `text_value` as the string `"true"` or `"false"`; and `value_range` is compared as stored.
10. THE tests SHALL NOT modify the Ground_Truth_File.

### Requirement 10: Replay mode and document allowlist

**User Story:** As a presenter and a developer, I want a replay mode that uses a hand-made fixture instead of the live Large Language Model, and a fixed list of accepted documents, so that the demo runs without an API key and no request can read an arbitrary file.

#### Acceptance Criteria

1. THE Extraction_System SHALL accept an Extraction_Request shaped `{"document_id": "demo_pca.pdf", "replay": false, "previous": <optional>, "actions": <optional>}`, and SHALL treat an absent `replay` as false.
2. THE Extraction_System SHALL accept only a `document_id` that is in the Document_Allowlist of files in `data/demo_documents/`.
3. IF the `document_id` is not in the Document_Allowlist, THEN THE Extraction_System SHALL reject the Extraction_Request, read no file, and return an error indication identifying the document as not allowed.
4. WHEN `replay` is true, THE Extraction_System SHALL load the Replay_Fixture in place of calling `call_llm`, pass the Replay_Fixture content through the same parsing and Evidence_Validator as a live response, and SHALL NOT invoke the LLM_Caller.
5. WHEN `replay` is true, THE Extraction_System SHALL set the Extraction_Result `mode` to `"replay"`.
6. WHEN `replay` is false, THE Extraction_System SHALL set the Extraction_Result `mode` to `"live"`.
7. IF `replay` is true and the Replay_Fixture for the requested document is absent, THEN THE Extraction_System SHALL return an error indication identifying the missing fixture and SHALL NOT fall back to a live call.
8. THE Extraction_System SHALL name each hand-made Fixture `*.handmade.json`, and SHALL use the name `*.recorded.json` only for a response captured from a real Large Language Model call.
9. IF an Extraction_Request carries `actions` without a `previous` Extraction_Result, THEN THE Extraction_System SHALL reject the Extraction_Request as malformed and apply no Action.
