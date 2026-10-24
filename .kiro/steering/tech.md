---
inclusion: always
---

# Technology Stack

## One repo, one Vercel deploy
- **Frontend:** Next.js (App Router) + TypeScript + Tailwind CSS in `app/`. Recharts for the allocation chart. Follows `DESIGN.md` (see `ui-rules.md`).
- **Backend:** FastAPI (Python 3.11+) in `api/`, deployed as Vercel Python functions. Endpoints: `POST /api/extract`, `POST /api/engine`, `POST /api/coordinate`, `GET /api/constants`.
- **Python core:** pure functions in `src/` (engine, extract, coordinator). `api/` only parses requests, calls `src/`, and returns JSON.
- **Contract:** Pydantic v2 models in `src/contract.py`. The frontend uses TypeScript types generated from or kept identical to these models in `app/lib/contract.ts`. Do not change `src/contract.py` without the engine owner's approval.

## Local development
- `npm run dev` starts the Next.js site and the FastAPI server together (via a dev script that runs `uvicorn api.index:app --reload --port 8000` alongside `next dev`, with Next.js rewrites from `/api/*` to port 8000 in development).
- Python dependencies in `requirements.txt`; Node dependencies in `package.json`.

## Testing
- Python: pytest + **Hypothesis** for property-based tests in `tests/`. Command: `python -m pytest -q`.
- Frontend: Vitest for small logic tests only; the UI never re-implements calculations.
- Tests never call the real LLM or the live PVWatts API; they use recorded fixtures in `data/fixtures/`.

## LLM
- One function `call_llm(prompt, schema) -> dict` in `src/llm.py`, provider chosen by environment variable. Structured JSON output only.
- Secrets: `LLM_API_KEY`, `PVWATTS_API_KEY` from environment variables. Never in code, steering, specs, or commits. `.env.example` has empty values.

## Data
- PVWatts V8: one fixed system configuration; the response is saved in `data/fixtures/pvwatts.json` and used by default.
- Policy constants: `data/policy_constants.json` (see `#policy-sources`).
