# Submission text — SolarAlign

Copy each block into the matching field of the Hackachusetts submission form.

## Project name
SolarAlign

## Tagline (one line)
Shows why profitable rooftop solar stalls on older multi-tenant buildings: who pays, who benefits, and how roof timing changes the deal, with every input traced to evidence.

## Track
Climatech & Clean Energy (challenge: cleaner, more affordable buildings)

## Team members
- Rahma Wadood
- David Slavtcheff
- Zaiqiao Long
- Taein Kang

Representative: Zaiqiao Long

## Links
- Live demo (no login): https://solaralign2.vercel.app
- Public GitHub repo: https://github.com/Qiao527/HACKACHUSETTS
- Demo video: _[YouTube link, public]_
- How Kiro was used: https://github.com/Qiao527/HACKACHUSETTS/blob/main/docs/HOW_KIRO_WAS_USED.md

## Text description

**The problem.** On an older multi-tenant building, the owner pays for the roof and the solar panels, but the tenants pay the electricity bills and keep the savings. A project that is clearly positive for the building as a whole can be negative for the owner, so it never gets built. Roof timing makes it worse: if the roof needs replacing in a few years, the panels must come off and go back on, which shrinks the value left to share. This "split incentive" is a well-known reason roofs on older Massachusetts buildings stay empty.

**What SolarAlign does.** It answers one question for an owner and their tenants: is there a split of solar value that leaves both better off, does the roof schedule keep that split alive, and what has to be confirmed before anyone signs?

1. **Evidence.** Roof facts such as replacement year and cost come from a synthetic roof condition report. Every value carries a page number and an exact quote. The backend's extraction endpoint uses an LLM to propose them, and code checks that each quote really appears on that page and contains the number; the browser demo starts from a preloaded, labeled set of these facts. No citation, no value: anything unproven is shown as "missing" with a request for the document that would settle it. People confirm or correct each fact.
2. **Timing.** A deterministic Python engine compares three roof/solar schedules (solar now and reinstall later; roof and solar now; roof first, solar later) against one roof-only baseline, so the roof cost is never counted twice. Move the roof year and the results update instantly.
3. **Value.** One slider moves value between owner and tenants. The owner's 25-year incremental NPV and the tenants' first-year savings are shown side by side and never added together. The engine solves the exact Positive-Outcome Range where both are above zero, or says honestly that no split works, because allocation can redistribute value but cannot create it.
4. **AI coordinator.** A neutral AI drafts a proposal inside the engine's range and explains it separately to the owner and to the tenants, in English or Spanish. It may only copy engine numbers: code rejects any number not in the engine result, any range outside it, and any output missing "not legal advice" and "eligibility not verified". Proposals are labeled "Draft — Not Mutually Accepted".
5. **Brief.** One printable page with both outcomes, the evidence, the assumptions and the lease, meter and utility terms to confirm.

**Why it is trustworthy.** The LLM never computes money. All math runs in one pure Python engine with integer-cent splits, checked by 27 reference cases (within $0.01) and Hypothesis property tests. Incentives such as SMART 3.0 and the federal ITC are shown as "may change the result", not silently added.

**Who benefits and how it scales.** Owners and asset managers see whether a deal can work before paying for engineering studies; tenants see what they gain in plain language and in Spanish; solar developers, community solar programs and city building-decarbonization teams get a shared, cited brief instead of a sales pitch. The engine is building-agnostic: the next steps are a real document upload, more buildings from public assessing data, and more languages.

**Data.** The demo property, Harbor Loom Warehouse, is fictional; its inputs are informed by Boston Assessing FY2026 open data, NREL PVWatts V8 (solar production), U.S. DOE PV cost benchmarks (costs), MassCEC "Sharing the Sun" landlord/tenant guidance (context), Mass.gov SMART 3.0 and IRS Notice 2025-42 (shown as factors, not calculated). The roof report, tenancy and meters are synthetic and labeled as such.

**Accessibility.** Keyboard-operable sliders with spoken values, a data-table alternative for every chart, owner and tenant explanations in English and Spanish, and a print-friendly brief.

**Built with.** Kiro (IDE and CLI), Next.js, TypeScript, Tailwind, Recharts, Python, FastAPI, Pydantic, Hypothesis, Vercel.

## Testing instructions
Open https://solaralign2.vercel.app (no login). Click **Launch demo**, then go through Evidence → Timing → Value → Brief. On Timing, move the roof year; on Value, move the tenant share and press **Generate proposal**, then switch to Español; on Brief, press **Print → PDF**. To run locally and run the tests, follow the README (`npm install`, `pip install -r requirements.txt`, `npm run dev`; `python -m pytest -q`, `npm run test`).

## How Kiro was used (short version, if the form has a text box)

We built SolarAlign with Kiro IDE and verified it with Kiro CLI, with one rule: Kiro may move fast but may never guess a number.

- **Steering:** 8 files in all four inclusion modes. fileMatch rules sit next to the code they govern: money rules load for engine files, AI rules for extraction and coordinator files. Working under `ai-rules.md`, Kiro found that our citation validator accepted an invented roof cost of 999,999 cited to a line that says $360,000, and fixed it.
- **Spec-driven:** a requirements-first spec for document extraction. Kiro read our data contract and ground-truth fields first, then wrote 10 requirements, 101 EARS criteria, 23 correctness properties, 14 tasks and 57 sub-tasks in the published revision. Before any code, it caught a float-only contract field that could not hold dates, and Analyze Requirements closed a loophole that let a roof age through without evidence.
- **Property-based tests:** Hypothesis properties for the engine (cent-exact conservation, monotonicity, roof cost charged once) and for extraction (any one-letter case flip in a quote is rejected). A mutation check proved the new tests catch the old bug. 79 Python + 30 frontend tests pass.
- **Hooks:** a PreToolUse hook blocks any write that would hide `.kiro` from Git (it fired on every spec write and blocked a real attempt in the CLI); a PostFileSave hook runs the suite whenever the shared contract changes. Kiro also fixed two of our hook trigger names on day one.
- **Spec vs. vibe:** we used vibe mode for the UI on purpose and logged the difference. The spec found problems before code; vibe mode was faster, but its one late bug (a chart band that vanished at a 19% edge) was caught only when Kiro CLI rendered the real chart before merge.

Full write-up: `docs/HOW_KIRO_WAS_USED.md`; every claim is backed by `docs/KIRO_USAGE_LOG.md`.

## Video script (target 2:45, hard limit 3:00)

Record the live site in a clean browser window. Narrate in English. No music, or royalty-free only. Keep "synthetic" labels visible.

| Time | Screen | Say |
|---|---|---|
| 0:00–0:15 | Home page hero | "The owner pays for the panels. The tenants keep the savings. Why would the owner proceed? That split incentive keeps solar off older Massachusetts buildings." |
| 0:15–0:40 | Evidence page; hover a fact's page + quote; point at a "missing" field | "SolarAlign starts from evidence. Every roof fact needs a page and an exact quote from the report, and code verifies the quote. If it can't be proven, it is marked missing with a request for the document." |
| 0:40–1:10 | Timing page; drag the roof year from 4 to 2 | "A deterministic engine compares three roof and solar schedules against one roof-only baseline. If the roof is due in two years, the panels come off and go back on, and the solar-now plan loses money for the owner." |
| 1:10–1:45 | Value page; drag tenant share slowly; show the shaded range | "One slider splits the value. The owner's 25-year NPV and the tenants' first-year savings sit side by side, never added. The shaded range is where both are positive — and if there is none, SolarAlign says so." |
| 1:45–2:05 | Generate proposal; switch to Español | "An AI coordinator drafts a split inside that range and explains it to each side, in English or Spanish. It can only copy the engine's numbers, and every draft is marked not mutually accepted." |
| 2:05–2:20 | Brief page; Print → PDF preview | "Everything ends in one printable brief: both outcomes, the evidence, and the lease, meter and utility terms to confirm." |
| 2:20–2:45 | Kiro: steering panel, the spec (requirements → design → tasks), the hooks panel, the PR #3 test diff | "We built it with Kiro: steering rules next to the code they govern, a requirements-first spec that caught bugs before code, property tests that caught an invented 999,999, and hooks that guard our rules on every write. SolarAlign shows why a sunny roof is not enough: the deal has to fit the roof's lifecycle and the people who pay and benefit." |

## Final checklist before pressing Submit
- [x] Extraction spec v2 (`design.md`, `tasks.md`, updated `requirements.md`) is published in `main` under `.kiro/specs/document-extraction/`
- [ ] Live demo works in an incognito window, including Generate proposal (LLM key set in Vercel)
- [ ] Video is under 3:00 and **public** on YouTube; link pasted in the form and in the README
- [ ] All team members added; track = Climatech & Clean Energy
- [ ] Confirm `.kiro/` is tracked and not ignored. (The `.gitignore` contains a protective comment mentioning `.kiro`, not an ignore pattern.)
