# SolarAlign

**Rooftop solar can benefit a building and still be a bad deal for its owner. SolarAlign makes the split incentive—and the effect of roof-replacement timing—visible.**

**Hackachusetts 2026 · Climatech & Clean Energy · Built with Kiro**

[**Explore the live demo**](https://solaralign2.vercel.app/) · [**How we used Kiro**](docs/HOW_KIRO_WAS_USED.md) · [**Synthetic roof report**](data/demo_documents/demo_pca.pdf)

## The problem

On an older multi-tenant building, an owner may pay for solar equipment, future roof work, and panel removal and reinstallation, while tenants benefit from lower electricity bills. A project with positive overall economics can therefore fail to offer the owner a compelling return. The timing of roof replacement can change that outcome.

SolarAlign is a **decision-support prototype**, not a solar installer, underwriting service, lease agreement, or eligibility certification.

## Try the 60-second demo

The browser demo is preloaded with **Harbor Loom Warehouse**, a fictional Boston-area property and a synthetic diligence document; no personal or building records are needed.

1. Open [SolarAlign](https://solaralign2.vercel.app/) and select **Launch demo**. Review the labeled sample inputs under **Evidence**.
2. In **Timing**, set **roof replacement to year 4**.
3. In **Value**, move the **tenant share to 18%**. The reference model gives the owner **+$7,566.83** in incremental NPV and tenants **+$10,665.19** in savings during the first full operating year.
4. Return to **Timing**, change the roof replacement to **year 2**, and revisit **Value** at the same 18% split. Owner incremental NPV becomes **−$826.32**, while tenant first-full-year savings remain **+$10,665.19**.
5. Open **Brief** to review the modeled outcomes, source-backed assumptions, unresolved conditions, and a printable decision summary.

These figures are **synthetic-scenario model outputs** reproduced in the project's reference fixtures, not real-world savings, measured project impacts, or an agreement between actual parties. Owner NPV and tenant first-year savings have different time horizons and should not be added together.

## What the prototype does

| Stage | User-facing result | Engineering constraint |
| --- | --- | --- |
| **Evidence** | Review values, page references, and quoted source passages; confirm or edit fields | Missing or unsupported evidence must not be presented as verified |
| **Timing** | Compare three roof/solar schedules against a roof-only baseline | Financial calculations run in the deterministic Python engine |
| **Value** | Explore owner incremental NPV, tenant first-year savings, and the **Positive-Outcome Range** | The range means both modeled metrics exceed zero; it does **not** imply consent |
| **Brief** | Print an assumption-aware decision summary | Unverified lease, roof, metering, and incentive questions remain visible |

The current browser flow starts with a preloaded synthetic evidence scenario. The backend also exposes `POST /api/extract` for selectable-text PDF processing, subject to LLM configuration; the seeded browser experience should not be confused with a live PDF-upload workflow. AI-generated proposals, when available, are drafts—not accepted agreements.

## How it works

```text
Synthetic evidence / selectable-text PDF
                 |
        Provenance and validation
                 |
        Deterministic Python engine
           /              \
    Timing comparison   Owner / tenant allocation
           \              /
          Decision brief + unresolved checks
                 |
       Optional constrained AI explanation
```

The language model can propose extracted facts and draft explanations; **it does not calculate financial values**. Python owns the schedule comparisons, cent-exact allocations, NPV, and Positive-Outcome Range. Code validates citations and constrains model-generated explanations to engine results.

**Core stack:** Next.js 14, React 18, TypeScript, Recharts, FastAPI, Pydantic, Python, Vitest, pytest, and Hypothesis. The web app and Python API are configured for Vercel.

## Run locally

**Prerequisites:** Node.js 20+, Python 3.11+ and npm.

```bash
git clone https://github.com/Qiao527/HACKACHUSETTS.git
cd HACKACHUSETTS

python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

npm ci
cp .env.example .env
npm run dev
```

Open **http://localhost:3000**. The development command starts Next.js and the FastAPI service together. The deterministic financial demo does **not** require a paid LLM credential; optional extraction and AI explanations require a supported provider and credentials in `.env`. Never commit an API key.

Run the verification suites independently:

```bash
python -m pytest -q
npm run test
npm run typecheck
npm run build
```

## Kiro and engineering evidence

Kiro was used for steering rules, implementation work, regression testing, and independent CLI verification. A documented extraction-validation defect was reproduced and covered by new tests. The repository contains **eight steering documents**, **five configured hooks**, and the observations supporting the Kiro write-up. Only **one hook was independently observed firing** during the documented audit; unverified capabilities are not represented as used.

- [**How Kiro Was Used** — evidence-backed engineering write-up](docs/HOW_KIRO_WAS_USED.md)
- [Kiro steering rules](.kiro/steering/) · [Hooks](.kiro/hooks/) · [Document extraction requirements](.kiro/specs/document-extraction/requirements.md)
- [Deterministic engine reference cases](data/fixtures/expected_engine_results.json)

The write-up includes point-in-time Git/PR states and clearly separates verified, recorded, and unverified claims. See the [current pull requests](https://github.com/Qiao527/HACKACHUSETTS/pulls) for live status.

## Repository guide

| Location | Purpose |
| --- | --- |
| `app/` | Browser workflow: Evidence → Timing → Value → Brief |
| `api/index.py` | FastAPI HTTP endpoints |
| `src/engine/` | Deterministic schedule, allocation, and NPV calculations |
| `src/extract/` | PDF text extraction and provenance checks |
| `src/coordinator/` | Constrained, draft AI explanations |
| `data/` | Synthetic demonstration document, assumptions, and recorded/reference fixtures |
| `.kiro/` | Steering, hooks, MCP configuration, and published specs |
| `tests/` | Python unit, reference, property-based, and integration tests |
| `docs/` | Kiro evidence, design notes, and internal submission materials |

## Assumptions and limits

The model uses a **fictional demonstration property** and recorded/reference inputs informed by Boston Assessing FY2026 data, NREL PVWatts V8, U.S. DOE solar cost benchmarks, and MassCEC landlord–tenant guidance. See [policy sources and assumptions](data/policy_constants.json). Incentives, lease rights, utility metering, roof access, and tenant consent need independent verification; the model does **not** establish SMART/48E eligibility or provide legal advice.

**Built for Hackachusetts 2026.** For reproduction, use the live demo, the scenarios above, and the test commands. For development-method evidence, see the linked Kiro write-up.
