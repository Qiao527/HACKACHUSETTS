# Demo documents

Put the team-made sample diligence PDF here, plus `expected_fields.json` with the known correct answers (used as the ground truth for extraction tests).

Every document in this folder is **synthetic** unless its source and usage permission are recorded below. The UI must label synthetic documents as "Sample diligence document (synthetic)".

| File | Synthetic? | Source / permission |
|---|---|---|
| `../fixtures/roof_report_pages.json` | Yes (synthetic) | Team-authored sample roof/diligence text for Demo Property A. Used as recorded page text so extraction tests never read a binary PDF or call an LLM. |

The UI labels this document "Sample diligence document (synthetic)" on the Evidence screen. A real selectable-text PDF can be uploaded at runtime via `POST /api/extract`; the citation validator (`src/extract/validate.py`) re-checks every quote against the actual page text regardless.
