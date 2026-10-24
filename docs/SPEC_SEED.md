# Spec Seeds and Prompt Library

Paste these into Kiro. Order: 0 (setup, C) -> 1 (engine, A) and 2 (extraction, B) in parallel -> 3 (coordinator B + UI C).
For specs: Kiro pane -> Specs -> + -> Feature Spec -> Requirements-First -> paste -> let Kiro write EARS requirements -> run **Analyze Requirements** -> approve -> design -> tasks. Never paste these straight into `.kiro/specs/` by hand.


Copy these into Kiro. Replace anything in [brackets].

## 0. Project setup (C runs this first, as a vibe chat)

> Set up a monorepo for SolarAlign that deploys to Vercel as one project: a Next.js + TypeScript + Tailwind frontend in `app/`, and a FastAPI backend in `api/index.py` running as Vercel Python functions, with routes under `/api/` (`/api/extract`, `/api/engine`, `/api/coordinate`, `/api/constants`). Python business logic lives in `src/` (engine, extract, coordinator, contract). Add `npm run dev` that starts both the website and the Python API locally. Add pytest and Hypothesis for Python tests and Vitest for the frontend. Add `.env.example` with `LLM_API_KEY=` and `PVWATTS_API_KEY=`. Do not add `.kiro` to `.gitignore`. Write a README with exact run steps.

## 1. Spec 1: allocation-and-timing-engine (A, Feature Spec, Requirements-First)

> Build the deterministic engine for SolarAlign in `src/engine/`, following `src/contract.py` and the steering files. Given an `EngineInput`, compute three schedules (solar now and remove/reinstall at roof replacement; roof and solar now; roof at planned year then solar) against one roof-only baseline. For each year, split electricity value into owner, tenant and unallocated dollars using the tenant share. Return incremental owner NPV, tenant first-full-year savings, break-even removal cost, and the range of tenant shares where both owner NPV and tenant savings are strictly positive (None if empty). The LLM never computes any of this.
>
> Write these as EARS requirements with property-based tests (Hypothesis):
> - THE System SHALL keep owner + tenant + unallocated equal to total value for every year of every schedule.
> - WHEN tenant share is 0, THE System SHALL report tenant value of 0.
> - WHEN tenant share increases, THE System SHALL NOT decrease tenant value or increase owner value.
> - WHEN tenant share changes, THE System SHALL NOT change kWh generated.
> - WHEN removal/reinstall cost increases, THE System SHALL NOT increase owner NPV for the solar-now schedule.
> - WHEN annual generation is 0, THE System SHALL report 0 electricity value.
> - THE System SHALL NOT charge the roof replacement cost twice in any incremental schedule.
> - WHEN no tenant share makes both outcomes positive, THE System SHALL return no mutual-benefit range.
> - THE System SHALL return identical results for identical inputs.
>
> Before approving requirements, run Analyze Requirements.

## 2. Spec 2: document-extraction (B, Feature Spec, Requirements-First)

> Build document extraction in `src/extract/` and the endpoint `POST /api/extract`. Read a selectable-text PDF page by page with pypdf. Call the LLM once for structured JSON matching `InputField`: roof remaining life (keep a range as a range), roof replacement cost, report date, inspection limitations, and who pays for electricity if stated. Then validate in code: every extracted value needs a page number and an exact quote that appears on that page; otherwise set status to missing. Never infer roof age from building age. Tests use recorded fixtures and never call the real LLM.
>
> EARS properties (Hypothesis):
> - WHEN a field is extracted, THE System SHALL include a page number and a quote found on that page, otherwise mark it missing.
> - WHEN the document has no explicit roof installation or replacement date, THE System SHALL mark roof age missing regardless of construction year.
> - THE System SHALL return the same result when validating an already validated extraction.
> - WHEN a user edits a field, THE System SHALL mark it human_supplied and keep the original extraction.

## 3. Spec 3: coordinator + decision-brief-ui (B for coordinator, C for UI)

> Build `src/coordinator/` and `POST /api/coordinate`: the LLM receives only the `EngineResult`, selects a range inside `mutual_benefit_range`, and writes an owner explanation and a tenant explanation in English or Spanish, plus a list of lease, meter and utility terms to confirm. Code checks that every number in the text appears in the engine result, the range sits inside the engine range, and the scenario_id matches; otherwise reject. Then build the Next.js page: evidence panel with clickable quotes and confirm/edit, allocation chart (Recharts) with a 0–100% slider and two labeled lines (owner NPV, tenant first-year savings) and the mutual-benefit zone shaded, roof timing controls, AI proposal panel with an en/es toggle, and a printable one-page brief. Show "synthetic" labels on every synthetic input and "not legal advice / eligibility not verified" on every proposal.

## 4. When something is wrong (anyone)

> I expected [what you expected]. I saw [what you saw]. Steps: [what you clicked]. Error text: [paste the red text]. Fix it without changing `src/contract.py`, and tell me what you changed in plain English.

## 5. When you do not understand the code (anyone)

> Explain what [file name] does in plain English, in five bullet points, for someone who does not code. Then tell me how I can check that it works.

## 6. Before you commit (anyone)

> Run all tests. Summarize which passed and which failed, in plain English. Do not commit if any fail.
