# SolarAlign

**SolarAlign turns scattered roof, solar, utility, and project information into a transparent path toward broader rooftop-solar adoption.**

**Hackachusetts 2026 · Climatech & Clean Energy · Built with Kiro**

[**Open the site**](https://solaralign2.vercel.app/) · [**How we used Kiro**](docs/HOW_KIRO_WAS_USED.md) · [**Download the field worksheet**](public/solaralign-field-worksheet.pdf) · [**Synthetic extraction fixture**](data/demo_documents/demo_pca.pdf)

## The problem

A sunny roof is not enough to make a solar project buildable. The roof and panels have different lifecycles; project facts are scattered across reports, proposals, utility bills, and facilities knowledge; and the organization funding the work may not be the same group receiving the electricity savings. Incentive, meter, structural, lease, and utility questions can add more uncertainty.

SolarAlign helps a project team collect and source those facts, compare three roof-and-solar timing pathways, and explore how usable value could support both project investment and building electricity users. It is a **decision-support prototype**, not a solar design, underwriting service, structural approval, lease agreement, or eligibility certification.

## Use the site

The calculator starts **empty**. SolarAlign does not insert a demo building or hidden financial assumptions.

1. Read the **Home** page for a plain-language explanation, process diagram, key terms, and links to government guidance, research, and industry examples.
2. Open **Analyze** and either enter project information manually or upload a selectable-text PDF. Text extraction works without AI; optional structured field identification requires a configured LLM and sends the document text to that provider.
3. If the information is not ready, download the generated **six-page field worksheet**. Every item explains what to collect, why it matters, and a likely source.
4. Complete every required model field, then calculate. Uploaded PDFs remain available in a viewer throughout the calculation flow and are retained in that browser using IndexedDB.
5. Use **Timing** to compare solar now, roof-and-solar now, and roof-then-solar against the same roof-only baseline.
6. Use **Align value** to explore project-side NPV, first-full-year building-user savings, and the Positive-Outcome Range. The range is a planning tool, not an agreement.
7. Print the **Brief** to record outputs, sources, assumptions, and unresolved implementation checks.

## What the prototype does

| Stage | User-facing result | Engineering constraint |
| --- | --- | --- |
| **Home** | Explains deployment barriers, key terms, and outside sources | Article summaries link to their original publishers |
| **Analyze** | Manual intake, PDF text extraction, optional cited field identification | No default project; missing values block calculation |
| **Sources** | Review values, source passages, and manual assumptions | Unsupported evidence is never presented as verified |
| **Timing** | Compare three roof/solar pathways against one roof-only baseline | Financial calculations run only in deterministic Python |
| **Align value** | Explore project-side NPV, building-user savings, and the Positive-Outcome Range | The range means both metrics exceed zero; it does not imply consent |
| **Brief** | Print a source-aware solar-readiness summary | Unverified roof, structural, utility, and eligibility questions remain visible |

## How it works

```text
Manual field data or selectable-text PDF
                  |
        Page text + cited evidence
                  |
        Complete, reviewed model inputs
                  |
        Deterministic Python engine
           /                 \
  Roof/solar timing     Value alignment
           \                 /
       Source-aware brief + unresolved checks
                  |
       Optional constrained AI explanation
```

The language model may propose extracted facts and draft explanations; **it does not calculate financial values**. Python owns the schedule comparisons, cent-exact allocations, NPV, break-even removal cost, and Positive-Outcome Range. Code validates citations and constrains model-generated explanations to numbers already produced by the engine.

**Core stack:** Next.js 14, React 18, TypeScript, Recharts, FastAPI, Pydantic, pypdf, Vitest, pytest, and Hypothesis. The website and Python API deploy together on Vercel.

## Run locally

**Prerequisites:** Node.js 20+, Python 3.11+, and npm.

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

Open **http://localhost:3000**. `npm run dev` starts Next.js and FastAPI together. Manual analysis and PDF text extraction do not require a paid LLM credential. Optional field identification and drafted explanations require a supported provider and credentials in `.env`; never commit an API key.

Regenerate the printable worksheet after editing `data/field_collection_schema.json`:

```bash
npm run generate:worksheet
```

Run verification:

```bash
python -m pytest -q
npm run test
npm run typecheck
npm run build
```

## Kiro and engineering evidence

We built SolarAlign with Kiro IDE and verified it with Kiro CLI: eight steering documents (all four inclusion modes), a requirements-first extraction spec, five hooks, and property-based tests. The current suites include 79 Python tests and 30 frontend tests.

- [How Kiro Was Used](docs/HOW_KIRO_WAS_USED.md)
- [Kiro usage log](docs/KIRO_USAGE_LOG.md) · [detailed evidence audit](docs/KIRO_EVIDENCE_AUDIT.md)
- [Steering](.kiro/steering/) · [Hooks](.kiro/hooks/) · [Document-extraction spec](.kiro/specs/document-extraction/) · [MCP config](.kiro/settings/mcp.json)
- [Deterministic engine reference cases](data/fixtures/expected_engine_results.json)

## Repository guide

| Location | Purpose |
| --- | --- |
| `app/` | Home, Analyze, source review, timing, value alignment, field form, and brief |
| `api/index.py` | FastAPI extraction, engine, sweep, coordinator, constants, and health endpoints |
| `src/engine/` | Deterministic schedule, allocation, and NPV calculations |
| `src/extract/` | Selectable-PDF text extraction and provenance checks |
| `src/coordinator/` | Constrained optional explanations |
| `data/field_collection_schema.json` | Shared definitions for intake help and the printable worksheet |
| `public/solaralign-field-worksheet.pdf` | Generated field-ready PDF |
| `data/` | Policy sources, synthetic fixtures, and reference cases |
| `.kiro/` | Steering, hooks, MCP configuration, and published specs |
| `tests/` | Python unit, reference, property-based, and integration tests |

## Team

Hackachusetts 2026 team: **Rahma Wadood**, **David Slavtcheff**, **Zaiqiao Long**, and **Taein Kang**.

## Assumptions and limits

The browser calculator does not preload the fictional Harbor Loom scenario; that fixture remains in the repository for reproducible tests and demonstrations. Every real analysis depends on user-entered or document-extracted inputs. SMART, 48E, BERDO, structural feasibility, lease rights, utility metering, credit allocation, and consent require independent verification. SolarAlign flags those dependencies and does not claim eligibility, legal approval, or guaranteed savings.
