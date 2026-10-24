---
inclusion: always
---

# Project Structure

```
.
├── .kiro/                    # Kiro config. NEVER add to .gitignore (hackathon rule)
├── app/                      # Next.js frontend (owner C)
│   ├── page.tsx              # main flow: evidence -> allocation -> proposal -> brief
│   ├── brief/page.tsx        # printable one-page brief
│   ├── components/           # EvidencePanel, AllocationChart, RoofControls, ProposalPanel
│   └── lib/contract.ts       # TS mirror of src/contract.py
├── api/
│   └── index.py              # FastAPI app: /api/extract, /api/engine, /api/coordinate, /api/constants
├── src/
│   ├── contract.py           # Pydantic models (frozen, owner A)
│   ├── engine/               # owner A: schedules, split, NPV, mutual-benefit range
│   ├── extract/              # owner B: PDF text per page, LLM extraction, citation validator
│   ├── coordinator/          # owner B: constrained proposal + owner/tenant explanations
│   └── llm.py                # call_llm(): the only place an LLM is called
├── data/
│   ├── policy_constants.json # every policy number with source + date (owner D)
│   ├── fixtures/             # pvwatts.json, recorded LLM outputs, expected results
│   └── demo_documents/       # synthetic roof report PDF + expected_fields.json (owner D)
├── tests/                    # test_<module>_properties.py per src module
├── scripts/                  # helpers used by Kiro hooks
├── docs/                     # playbook, usage log, write-up, checklist
└── DESIGN.md                 # visual style reference for the frontend
```

## Conventions
- Each module has one owner; do not edit another owner's folder without asking.
- `src/` never imports from `api/` or `app/`. `api/` is a thin layer over `src/`.
- Every result object carries `sources: list[str]` (policy constant keys and assumption ids used) so the UI can show citations.
- Every `src/<module>/` has a matching `tests/test_<module>_properties.py`.
