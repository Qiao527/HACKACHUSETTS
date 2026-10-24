# SolarAlign

SolarAlign shows why financially promising rooftop solar stalls on older multi-tenant buildings, by revealing who pays, who benefits, and how roof timing changes the deal, with every input traced to evidence.

Built at Hackachusetts 2026 (Climatech & Clean Energy track) with Kiro.

> One Next.js + FastAPI project, one Vercel deploy. The Next.js frontend lives in `app/`; the FastAPI backend in `api/index.py`; all money math in pure Python under `src/`. The LLM is called in exactly one place (`src/llm.py`) and never computes numbers.

## Team quick start

1. Install once: Kiro, GitHub Desktop, Python 3.11+ (3.9 also works here), Node.js 20+.
2. Clone this repo and open the folder in Kiro.
3. In Kiro, check the **Agent Hooks** panel shows 5 hooks and the **MCP Servers** panel shows `fetch` (needs `uv`: `pip install uv`).
4. First time:
   ```bash
   python3 -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   npm install
   ```
5. Run everything (Next.js + FastAPI together):
   ```bash
   npm run dev          # http://localhost:3000 (API proxied to :8000)
   ```
   Or run the two halves separately: `npm run dev:next` and `npm run dev:api`.

## Run the tests

```bash
python -m pytest -q      # engine, extraction, coordinator, API (property-based)
npm run test             # frontend formatting/logic (Vitest)
npm run typecheck        # TypeScript
npm run build            # production Next.js build
```

Tests never call a real LLM or the live PVWatts API; they use recorded fixtures in `data/fixtures/`.

## What runs where

| Path | What |
|---|---|
| `app/` | Next.js App Router frontend: `/` landing, `/evidence`, `/timing`, `/value`, `/brief` |
| `app/components/` | ProvenanceField, AllocationChart, AllocationToggle, ScheduleChart, RoofControls, ProposalPanel, BriefLayout |
| `app/lib/contract.ts` | TypeScript mirror of `src/contract.py` |
| `api/index.py` | FastAPI: `GET /api/constants`, `POST /api/engine`, `POST /api/engine/sweep`, `POST /api/extract`, `POST /api/coordinate` |
| `src/engine/` | deterministic schedules, yearly split, NPV, exact mutual-benefit range |
| `src/extract/` | per-page PDF read, one LLM call, code-side citation validator |
| `src/coordinator/` | constrained proposal + owner/tenant explanations, number-and-range guardrails |
| `src/data/` | loads the PVWatts fixture into Demo Property A |
| `data/fixtures/pvwatts.json` | cached real NREL PVWatts V8 result (500 kW DC, Boston) |

## Deploy (Vercel)

Push to GitHub and import the repo in Vercel. `package.json` makes Vercel detect **Next.js**; `vercel.json` serves `api/index.py` as a Python function and rewrites `/api/*` to it. Set `LLM_PROVIDER` and `LLM_API_KEY` in Vercel → Settings → Environment Variables (never in the repo). Without an LLM key the whole engine still works end to end; only the AI explanation panel asks for a key.

## Repository map

| Path | What |
|---|---|
| `.kiro/steering/` | 8 steering files using all four inclusion modes |
| `.kiro/hooks/` | 5 hooks: tests after each task, contract guard, policy source guard, `.kiro` protection, property-test reminder |
| `.kiro/settings/mcp.json` | Workspace MCP server (fetch) |
| `src/contract.py` | Shared Pydantic data contract (frozen) |
| `data/policy_constants.json` | Every policy number with its source and date |
| `DESIGN.md` | Visual style reference for the frontend (style only, no brand assets) |
| `docs/` | Playbook, spec seeds, Kiro usage log, write-up template, submission checklist |

## Data sources

- Boston Assessing FY2026 open data (demo building facts)
- NREL PVWatts V8 (solar production)
- U.S. DOE PV system cost benchmarks (cost assumptions)
- MassCEC "Sharing the Sun" landlord/tenant guidance (context)
- Mass.gov SMART 3.0, IRS Notice 2025-42 (shown as factors that may change the result; not calculated)

Synthetic documents and assumptions are labeled in the app.
