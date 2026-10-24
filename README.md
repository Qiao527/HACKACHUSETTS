# SolarAlign

SolarAlign shows why financially promising rooftop solar stalls on older multi-tenant buildings, by revealing who pays, who benefits, and how roof timing changes the deal, with every input traced to evidence.

Built at Hackachusetts 2026 (Climatech & Clean Energy track) with Kiro.

> Starter state: Kiro configuration, contract and docs. The application code is generated with Kiro from `docs/SPEC_SEED.md`. Run steps below are filled in by the setup task.

## Team quick start

1. Install once: Kiro, GitHub Desktop, Python 3.11+, Node.js 20+.
2. Clone this repo and open the folder in Kiro.
3. In Kiro, check the **Agent Hooks** panel shows 5 hooks and the **MCP Servers** panel shows `fetch` (needs `uv`: `pip install uv`).
4. First time: `pip install -r requirements.txt` (and `npm install` after the setup task creates `package.json`).
5. Read `docs/KIRO_PLAYBOOK.md`, then start your spec from `docs/SPEC_SEED.md`.

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
