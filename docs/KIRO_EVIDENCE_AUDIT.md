# Kiro Evidence Audit: SolarAlign (detailed appendix)

> **Read [`HOW_KIRO_WAS_USED.md`](HOW_KIRO_WAS_USED.md) first.** This file is the detailed, conservative audit a separate Kiro CLI session wrote at about 16:00–17:15 EDT, using only what it could re-run or find in the repository at that moment. It is kept unchanged below as a snapshot. Since then:
> - PR #3 (citation validator) and PR #4 (frontend decision flow) were merged into `main`; `main` now passes 79 Python tests and 30 Vitest tests.
> - The full document-extraction spec (requirements v2, `design.md`, `tasks.md`) was published to `.kiro/specs/document-extraction/`.
> - The team's live usage-log rows from Kiro IDE (hook-trigger fix, spec generation, Analyze Requirements, hooks firing on spec and contract writes) were copied into `docs/KIRO_USAGE_LOG.md`. Several items marked "Not verified" below are therefore **Recorded** there, but this snapshot was not rewritten.


Hackachusetts 2026, Climatech & Clean Energy track. Repository: https://github.com/Qiao527/HACKACHUSETTS

## Executive summary

SolarAlign shows a Boston building owner and its tenants whether some split of rooftop solar value leaves both better off, and whether roof replacement timing keeps that split alive. An LLM reads roof facts from a PDF, only a deterministic Python engine computes money, and code checks every LLM output. Kiro helped us hold that line:

1. **Steering set the rules.** Eight steering files encode "Only the engine computes money", cent-exact money rules and "No citation, no value". Kiro loads the engine and extraction rules when matching files are read.
2. **Kiro found a real citation bug.** Working under `ai-rules.md`, the Kiro agent found that `main` accepted an invented roof cost of 999,999 cited to a line that says $360,000, and ignored letter case in quotes. We reproduced it.
3. **Regression tests fixed it.** PR #3 makes quote matching case-sensitive and requires every reported number to appear in the quote. Its 23 new tests include Hypothesis properties. The Python suite goes from 56 to 79 passed, 0 failed.
4. **Mutation testing shows the tests catch the bug.** Restoring the old matcher fails 2 new tests, and Hypothesis shrinks the failure to a one-letter case flip.
5. **Kiro CLI verified the work independently.** A separate CLI session re-ran the Python tests on clean exports of `main`, PR #3 and PR #4, and the frontend tests on `main` and PR #4. PR #4 is a frontend reliability fix: its 13 Vitest tests, typecheck and build pass, and a mutation check fails 3 tests. A read-only CLI design audit reviewed the UI from source code, not in a browser.
6. **We observed a hook fire.** Of 5 configured hooks, one was seen executing: `protect-kiro-folder` blocked a write that would have added `.kiro/` to a `.gitignore`.

**Not claimed.** We have no evidence of the other four hooks firing, MCP tool use, an Analyze Requirements run or cloud agents. PR #3 and PR #4 are open, not merged. The full extraction spec is on a local branch only.

## How to read this document

Every claim carries one of three labels. Where we lack evidence, we say so.

| Label | Meaning |
|---|---|
| **Verified** | Re-run or directly observed in this Kiro CLI documentation session on 2026-10-24, about 16:00 to 17:15 EDT. Commands are in Appendix A. |
| **Recorded** | Written in a repository file, a commit message, a PR description, or a local Kiro session log. Not re-run. |
| **Not verified** | Planned or plausible, but no artifact was found. |

State reviewed: `origin/main` at `996231c`; PR #3 head at `6dcdac3` and PR #4 head at `1957585` (both open, not merged); the local spec branch `qiao/extraction-spec` at `0fca234` (not pushed).

## Key results

| Result | Value | Status |
|---|---|---|
| Python tests on `main` (`996231c`) | 56 passed | Verified |
| Python tests on PR #3 head (`6dcdac3`) | 79 passed, 0 failed, 1 warning | Verified |
| Extraction tests, `main` vs. PR #3 | 5 vs. 28 passed | Verified |
| Hypothesis property tests on PR #3 head | 12 tests, 1,600 generated examples per run | Verified |
| Engine reference goldens | 27 case/schedule pairs plus 1 contract check | Verified |
| Invented `999999` cited with an upper-cased quote | accepted on `main`, rejected on PR #3 | Verified |
| Old case-insensitive matcher put back into PR #3 | 2 new tests fail | Verified |
| Frontend Vitest, `main` vs. PR #4 | 6 vs. 13 passed | Verified |
| PR #4 typecheck and production build | both pass | Verified |
| PR #4 stale-request guard disabled | 3 of 13 tests fail | Verified |
| Dry-run merge of PR #3 with PR #4 against `main` | no conflicts | Verified |
| Read-only Kiro CLI design audit | 5 ranked issues from source code; no browser test | Recorded |
| Hooks configured / hooks observed executing | 5 / 1 (`protect-kiro-folder`, in Kiro CLI) | Verified |

## 1. The engineering challenge

**The problem.** The owner pays for the roof and the panels. Tenants pay the electricity bills and may keep the savings. A project that is positive for the building as a whole can be negative for the owner, so it never gets built. If the roof needs replacing in a few years, the panels must come off and go back on, which shrinks the value left to share.

**Why the money has to be deterministic.** `financial-rules.md` opens with "They exist because the obvious formulas are wrong." The engine has to:

- compare three roof/solar schedules against one roof-only baseline, so the roof cost is never charged twice;
- split each year's electricity value into owner, tenant and unallocated parts that add up to the cent (`src/engine/allocation.py` works in integer cents and gives the owner the remainder);
- report owner incremental NPV and tenant first-year savings as two separate metrics, never summed;
- solve the exact tenant-share range where both are positive, and return `None` when there is no such range.

**Why the LLM must not touch the numbers.** The synthetic roof report (`data/demo_documents/demo_pca.pdf`) contains deliberate traps, listed in the spec's design research (Recorded): a `$75,000` panel-removal allowance next to the `$300,000` roof cost, a "Year 3" planning scenario inside a 2-to-4-year range, `2024 dollars` that must not become a roof year, and a 1979 construction year that must not become a roof age. A wrong number from extraction would flow into NPV and come out looking precise.

**The architecture we locked in `product.md`:** AI extracts evidence, the engine computes, an AI coordinator explains within the engine's results, humans decide.

| Stage | LLM role | What code enforces | Where |
|---|---|---|---|
| Evidence | Proposes a value, page and quote per field | Quote must be on the cited page; otherwise the field becomes `missing` with a `request`. PR #3 adds: every number must be written in the quote. | `src/extract/validate.py` |
| Engine | None | Three schedules vs. one baseline, cent-exact split, exact mutual-benefit range | `src/engine/` |
| Coordinator | Writes owner and tenant explanations from the `EngineResult` only | Rejects any number not in the engine result, a range outside the engine range, a stale `scenario_id`, or a missing "not legal advice" / "eligibility not verified" label | `validate_output` in `src/coordinator/coordinate.py` |
| Decision | None | Human edits become `human_supplied` | UI |

`src/llm.py` is the only module that sends a request to an LLM. `src/extract/extract.py` and `src/coordinator/coordinate.py` take an injected `llm` function and import `call_llm` only when none is passed, so every test passes a fake (Verified by code search).

## 2. How Steering guided the build

The repository has 8 steering files that use all four inclusion modes (Verified).

| File | Mode | What it pins down | Where it shows in the code |
|---|---|---|---|
| `product.md` | always | Locked architecture; "Only the engine computes money"; flag, don't decide; SMART, 48E and BERDO shown as "may change the result", never added | Coordinator rejects outputs without both labels (`test_missing_label_rejected`) |
| `tech.md` | always | One `call_llm`; tests never call a real LLM or live PVWatts; pytest + Hypothesis; secrets only in environment variables | `src/llm.py`; fixtures in `data/fixtures/`; empty `.env.example` |
| `structure.md` | always | Module owners; `src/` never imports `api/` or `app/`; every result carries `sources`; one `tests/test_<module>_properties.py` per module | Test file names follow the rule |
| `financial-rules.md` | fileMatch: `src/engine/**`, `tests/test_engine*.py` | Seven money rules and eight required properties | `tests/test_engine_properties.py` header cites "financial-rules.md rule 6"; each test has a `REQ:` comment |
| `ai-rules.md` | fileMatch: `src/extract/**`, `src/coordinator/**`, `src/llm.py`, extraction and coordinator tests | No citation, no value; never infer roof age; missing is a useful answer; coordinator number check | `validate.py` docstring cites "ai-rules.md, Extraction rule 1" |
| `ui-rules.md` | fileMatch: `app/**`, plus `#[[file:DESIGN.md]]` | UI never calculates money; owner and tenant side by side; synthetic and assumption labels | Not reviewed in detail for this document |
| `policy-sources.md` | auto, plus `#[[file:data/policy_constants.json]]` | Policy numbers come only from `policy_constants.json`, each with source URL and retrieval date | `scripts/check_sources.py`: "11 entries, all cited" (Verified) |
| `demo-script.md` | manual | Video beats and wording rules ("flags" not "certifies") | Not used in this session |

**Steering observed in Kiro CLI (Verified).** `product.md`, `tech.md` and `structure.md` were in context from the start of the session. After the session read files under `src/extract/` and `tests/test_engine*.py`, Kiro CLI added `ai-rules.md` and `financial-rules.md`. `policy-sources.md` loaded on demand through auto inclusion, because this document discusses policy facts. `demo-script.md` (manual) never loaded. The separate design-audit CLI session's log records the same pattern: `product.md` at the start, then `ui-rules.md` and `financial-rules.md` as it read matching files (Recorded).

**Steering in Kiro IDE (Recorded).** The usage log records the steering setup at 12:30 (IDE). A PR #3 log row records that the Kiro agent read `ai-rules.md` before editing `validate.py`, saw that rule 1 allows whitespace normalization only, and removed `.lower()` from quote matching (section 5).

**Gaps between steering and tests (Verified while reviewing):**

- `ai-rules.md` lists "a coordinator text containing a number not in the engine result is rejected" and "a proposed range outside the engine range is rejected" as property tests. Both behaviours are tested, but `tests/test_coordinator_properties.py` has no `@given` tests. They are example-based.
- `financial-rules.md` requires that "Endpoints of the mutual-benefit range satisfy both conditions." `test_mutual_benefit_range_endpoints` checks the midpoint of the range, with a tolerance of 0.01, not the endpoints.

## 3. Spec-driven development

**What exists.**

| Artifact | Location | Content | Status |
|---|---|---|---|
| Spec config | `.kiro/specs/document-extraction/.config.kiro` on `main` | `"workflowType": "requirements-first", "specType": "feature"` | Verified |
| Requirements v1 | `main`, added in `b80197c` (14:02) | 9 requirements, 55 EARS acceptance criteria | Verified |
| Requirements v2, design, tasks | local branch `qiao/extraction-spec`, commit `0fca234` (15:02); also merged into local branch `integrate` | 10 requirements and 101 criteria; `design.md` (934 lines) with 23 correctness properties; `tasks.md` (378 lines) with 13 tasks and 53 sub-tasks | Verified; **not on GitHub** |

**How requirements became checkable tasks.** Each design property names the requirements it validates, and each property-test task names its property. One chain from `0fca234`:

1. Requirement 3.13: compare the quote to the page "with no other normalization (no case folding, ...)" beyond whitespace collapse.
2. Design Property 10: changing any non-whitespace character of a quote, "including a case flip", must make the field `missing`.
3. Task 4.12: "Write property test for quote matching", validating Requirements 3.13, 3.14 and 3.15.

Requirement 3.16 (numeric grounding) follows the same path through Property 9 and task 4.11. The design also has a "Requirement gaps noted" section listing three rules it enforces that the requirements do not name.

**The spec described the bug before PR #3 fixed it.** Requirement 3.1 on `main` (14:02) already demanded a "contiguous exact-character substring". The implementation in `4c48a01` (14:45) lowercased both sides. PR #3 (15:52) brought the code in line (section 5). We do not claim the spec is what led to the discovery; the PR #3 log row credits `ai-rules.md`.

**What we did not do (Verified unless marked):**

- No task in `tasks.md` is checked. PR #3 calls this "the deferred document-extraction spec".
- Only one spec exists. `docs/SPEC_SEED.md` planned three (engine, extraction, coordinator + UI). The engine, coordinator, API and UI arrived in one commit, `4c48a01`. How that code was produced is Not verified.
- Whether Kiro generated the spec documents: the `.config.kiro` file and the EARS/glossary format match Kiro's requirements-first workflow, and `SPEC_SEED.md` tells the team to generate specs in Kiro rather than paste them. The session itself is not in the repository. Not verified.
- Whether **Analyze Requirements** was run, and whether it produced the "Requirement gaps noted" list: Not verified. No output, screenshot or log entry was found.
- The spec-vs-vibe comparison table in `docs/KIRO_USAGE_LOG.md` is empty. Not verified.
- PR #3's numeric grounding follows the intent of Requirement 3.16 but not its wording. Requirement 3.16 strips every `$` and `,` and then reads numbers. PR #3 parses comma-grouped numbers, rejects malformed grouping such as `30,0000`, and requires a `$`/`USD` marker for money fields. The two should be reconciled when the spec tasks run.

**Known publication gap.** The full spec (requirements v2, `design.md` and `tasks.md`) exists only on the local branch `qiao/extraction-spec`. GitHub `main` has only requirements v1 and `.config.kiro`. `docs/SUBMISSION_CHECKLIST.md` asks for requirements, design and tasks in `.kiro/specs/`. This documentation PR deliberately does not cherry-pick or rewrite the spec. It is to be reconciled and published separately with the extraction (PDF/LLM) owner, partly because requirement 3.16 and the PR #3 validator already differ.

## 4. Property-based testing and reference fixtures

**Test inventory on PR #3 head** (Verified by `pytest --collect-only` and a full run):

| File | Tests | Hypothesis tests (examples each) | What it covers |
|---|---|---|---|
| `tests/test_engine_properties.py` | 10 | 9 (150) | `financial-rules.md` rules 1, 2 and 6 |
| `tests/test_engine_reference.py` | 28 | 0 | 27 goldens from the reference model, plus the contract range check |
| `tests/test_extract_properties.py` | 28 (5 on `main`) | 3 (50, 100, 100) | Citation validator |
| `tests/test_coordinator_properties.py` | 7 | 0 | Coordinator guardrails (example-based) |
| `tests/test_api.py` | 6 | 0 | FastAPI endpoints |
| **Total** | **79** (56 on `main`) | **12** (10 on `main`) | |

With `--hypothesis-show-statistics`, every property test ran to its `max_examples` limit: 1,600 generated examples per run on PR #3 head.

**Engine properties mapped to steering rules:**

| `financial-rules.md` rule | Test |
|---|---|
| 2: owner + tenant + unallocated = total, every year, to the cent | `test_conservation_every_year` |
| 6: tenant share 0 gives tenant value 0 | `test_tenant_share_zero_gives_zero_tenant_value` |
| 6: raising tenant share never lowers tenant value or raises owner value | `test_tenant_share_monotonic` |
| 6: tenant share never changes kWh | `test_tenant_share_does_not_change_kwh` |
| 6: higher removal cost never raises owner NPV (`solar_now_remove_later`) | `test_higher_removal_never_raises_owner_npv` |
| 6: zero generation gives zero value | `test_zero_generation_zero_value` |
| 6: identical inputs give identical outputs | `test_deterministic` |
| 1: roof cost charged exactly once | `test_roof_cost_charged_once` |
| 6: mutual-benefit range is valid (midpoint checked, see section 2) | `test_mutual_benefit_range_endpoints` |
| 5: no zone returns `None` | `test_no_mutual_benefit_when_solar_uneconomic` (example) |

**Reference and recorded fixtures:**

| Fixture | What it is | Status |
|---|---|---|
| `data/fixtures/expected_engine_results.json` | `model_version: solaralign-reference-1.1`, 9 cases x 3 schedules, `tolerance_usd: 0.01`, range edges to 1e-6, an `assumptions_sha256` | Verified (contents). Commit `b80197c` says "from reference model". That it was generated from `data/SolarAlign_Model.xlsx` is Not verified. |
| `data/fixtures/pvwatts.json` | Cached NREL PVWatts V8 result, 500 kW DC, Boston, `retrieved: 2026-10-24` | Recorded (its `_meta`) |
| `data/fixtures/roof_report_pages.json` | Synthetic page text for `demo_roof_report.pdf`, an earlier demo report | Verified (labelled synthetic) |
| `data/fixtures/llm_extract.json` | `_meta` calls it "Recorded LLM extraction output" | Whether it came from a real LLM call: Not verified |
| `data/demo_documents/demo_pca.pdf` + `expected_fields.json` | Synthetic demo report and ground truth for 10 fields (8 extracted, 2 roof-age fields `missing`) | Verified (contents). No test uses them yet. |

**Why both kinds of test.** The 27 goldens show the engine matches the team's reference model on nine chosen cases. The properties check rules on random inputs nobody chose. Neither replaces the other: a golden cannot show conservation holds for every year of every input, and a property cannot show the NPV formula matches the reference model.

**Counterexamples.** No engine counterexample was recorded during the build (Not verified that any occurred). The one Hypothesis counterexample in this document comes from the mutation check in section 5, where Hypothesis shrank the failure to `text='A', idx=0`.

## 5. The citation-validator failure and PR #3

**What was wrong.** On `main`, `quote_on_page` compared `q.lower()` with the lowercased page, and `validate_field` never compared the reported number with the quote. A field could carry any number, as long as its quote appeared on the page in any letter case.

**Reproduction (Verified).** The same three fields, with page text taken from the PR #3 tests, run through both validators:

| Field | `main` (`996231c`) | PR #3 (`6dcdac3`) |
|---|---|---|
| `999999`, quote `BUDGETARY COST to replace the roof assembly is approximately $360,000.` (the page says "Budgetary cost") | `extracted_unconfirmed` | `missing` |
| `999999`, exact quote | `extracted_unconfirmed` | `missing` |
| `360000`, exact quote | `extracted_unconfirmed` | `extracted_unconfirmed` |

**Who found it (Recorded).** The rows PR #3 added to `docs/KIRO_USAGE_LOG.md` record "Kiro agent" in the IDE. The agent read `ai-rules.md` (fileMatch) before editing `validate.py` and reproduced the upper-cased quote and the invented `999999` on `main` before changing anything. No transcript or screenshot of that IDE session is in the repository, so who found the bug is Recorded, not Verified. The bug itself and the fix are Verified (above and below).

**The fix.** PR #3, branch `fix/extraction-trust`, commit `6dcdac3`, opened 2026-10-24 15:52 EDT. It changes three files (Verified on GitHub): `src/extract/validate.py` (+131/-10), `tests/test_extract_properties.py` (+190/-2) and `docs/KIRO_USAGE_LOG.md` (+5).

- Quote matching collapses whitespace runs only. It is case-sensitive.
- Every `value` and both `value_range` bounds must appear as a number in the quote. `$360,000` and `1,250,000.50` parse; `30,0000` does not. `USD` fields need a `$`, `USD` or `dollars` marker. `year` fields need a written 4-digit year. Reversed ranges are rejected.
- `roof_installation_year` and `roof_age_years` need roofing words in the quote, so a construction-year quote is rejected. A missing roof-age field gets a fixed request: "Provide roofing records ... Do not infer roof age from the building construction year."
- A missing field also clears `text_value`.
- Public function names and signatures are unchanged. `src/contract.py`, `src/llm.py`, `api/`, `src/coordinator/`, `src/engine/` and `app/` are untouched.

**Tests (Verified).** On a clean export of `6dcdac3`: `python -m pytest -q` gives **79 passed, 0 failed, 1 warning** (a Starlette/httpx deprecation that is also present on `main`). `tests/test_extract_properties.py` alone gives 28 passed. The same command on `main` gives 56 passed. Environment: Python 3.12.13, pytest 9.1.1, Hypothesis 6.170.9, pydantic 2.14.1, pypdf 6.21.2. This matches the numbers in the PR description.

**Do the new tests catch the old bug? (Verified).** The PR description reports that putting the old matcher back makes both case tests fail (Recorded). This session repeated the check in a scratch copy of PR #3 with the old `q.lower() in normalize(page_text).lower()` restored. Two tests failed: `test_case_mismatch_becomes_missing` and the Hypothesis property `test_any_case_flip_is_rejected`, which shrank to `text='A', idx=0`. The other 26 passed.

**Status (Verified).** PR #3 is open, with no reviews and no CI check runs on `6dcdac3`. Until it merges, `main` still has the old validator and 56 tests. The 79-test result applies to PR #3 only.

**Limitations PR #3 leaves (Recorded in the PR; the first one Verified):**

- When the LLM omits `page`, `src/extract/extract.py` builds `Evidence(page=0)` and pydantic raises `ValidationError` instead of returning a `missing` field. We reproduced this on PR #3 head.
- `text_value` (dates, text) is not checked against the quote. Only numbers are.
- Amounts written as `$1.2 million` or `$85k` do not ground and become `missing`. This fails safe but is strict.
- The roof-age wording check is a keyword heuristic.
- The extraction tests use the older `demo_roof_report` fixtures, not `demo_pca.pdf` and `expected_fields.json`.

## 6. PR #4: frontend decision-flow reliability

PR #4 is a separate contribution from the citation fix: https://github.com/Qiao527/HACKACHUSETTS/pull/4, branch `fix/frontend-decision-flow`, one commit `1957585`, opened 2026-10-24 16:24 EDT. It is open and not merged, with no reviews and no CI check runs (Verified). It changes 19 files: 15 under `app/`, plus `docs/KIRO_USAGE_LOG.md`, `package.json`, `package-lock.json` and `vitest.config.ts`. It changes nothing under `src/`, `api/`, `tests/` or `.kiro/` (Verified).

**The problem on `main` (Verified by reading the code).** Each page created its own `ScenarioProvider` inside `DemoShell`, and the "Next" buttons were plain `<a href>` links that reload the page. A roof year or tenant share chosen on one page was lost on the next, so the Brief could show the defaults. `ProposalPanel` kept an AI proposal on screen after the engine result it explained had changed.

**What PR #4 changes (Verified by reading the diff):**

- One `ScenarioProvider` now wraps the app in `app/layout.tsx`, and workflow links use `next/link`.
- A new `LatestRequest` class (`app/lib/latest-request.ts`) gives each async call a token, so only the newest response is applied. The provider, the allocation chart and the proposal panel use it.
- Changing a financial input clears the current result and any AI proposal. The Value and Brief pages show a "Recalculating" message instead of old numbers.
- AI output carries a `Draft — Not Mutually Accepted` badge. The UI names the analyzed schedule ("Solar now, remove & reinstall at roof replacement"), renames "mutual-benefit zone" to "Positive-Outcome Range", and states that the range "does not establish agreement".
- Owner NPV and tenant first-year savings are drawn as two charts with separate dollar axes.
- The homepage "Jump to the allocation" button now goes to `/value` instead of `/timing`.
- New dev dependencies `react-test-renderer` and `@types/react-test-renderer`; `vitest.config.ts` switches to the automatic JSX transform.

**Tests: reported in the PR vs. re-run here.**

| Check | Reported in PR #4 | Re-run on a clean export of `1957585` (Verified) |
|---|---|---|
| `npm run test` | 3 files, 13 tests | 13 passed: `latest-request.test.ts` 2, `format.test.ts` 6, `decision-flow.test.ts` 5 |
| `npm run typecheck` | passed | `tsc --noEmit` exit 0 |
| `npm run build` | passed | `next build` succeeded: `/`, `/brief`, `/evidence`, `/timing`, `/value`, `/_not-found` |
| `git diff --check` | passed | no whitespace errors against `main` |
| `python -m pytest -q` | not reported | 56 passed (PR #4 changes no Python) |

The five component tests in `app/components/decision-flow.test.ts` run the real provider and components against a mocked API; the first one renders the real root layout. They check that roof year and a 30% tenant share survive a child-route change, that an older engine response never becomes current, that a failed recalculation leaves no current result, that an obsolete allocation sweep is never shown, and that an input change discards an in-flight proposal while the current proposal carries the draft label.

**Mutation check (Verified).** In a scratch copy, making `LatestRequest.isCurrent` always return `true` fails 3 of 13 tests: both `LatestRequest` unit tests and the out-of-order engine test. The sweep and proposal tests still pass, because those components also compare the input revision, which gives them a second guard.

**Kiro activity (Recorded).** PR #4 adds seven usage-log rows credited to Kiro. They record a context-gatherer trace of the provider, sweep, proposal, navigation and brief flows before editing (IDE); a Vitest failure (`React is not defined`) fixed with the automatic JSX transform; a strict-typecheck failure in test code; a test failure (`self is not defined`) from Next.js `Link` in the Node renderer, fixed inside the test module only; the vibe-mode implementation; and the final validation. No transcript is in the repository.

**Not verified.** Behaviour in a real browser. Because `setInput` clears the result immediately, the owner and tenant cards are replaced by a "Recalculating" message on every slider step until the engine responds. Whether that shows as visible flicker was not checked.

## 7. Read-only Kiro CLI design audit

A separate Kiro CLI session ran a read-only design audit of the home, Value and Brief pages from 16:04 to 16:14 EDT. Its log is a local Kiro session file, not part of the repository, so its findings are Recorded. Reading that log, we confirmed (Verified):

- It ran in plan mode on a separate clone made at 16:02 EDT from `main` at `996231c`. The clone's reflog shows no later checkout and it has no local changes, so the audit reviewed the code before PR #4.
- It used only read and search tools (`read_file`, `list_directory`, `file_search`, `grep_search`), the built-in `web_fetch`, and steering. It made no edits. `web_fetch` is a built-in text fetch, not the `fetch` MCP server.
- **It was a code-based review, not a browser visual test.** The audit states that it had no browser tool and could not view the drawn chart, measure the fold or open print preview. It fetched the production HTML as text, which showed only a loading message, and the `/api/constants` JSON.

| ID | Audit finding (Recorded) | In PR #4's code (Verified by reading code; no browser) |
|---|---|---|
| A1 | Missing decision verdict: the Value page's first screen never says whether both parties come out positive, and "a positive result is not an agreement" appears only below the fold. | PR #4 adds "does not establish agreement" to the intro and range text, and a draft badge on AI output. It adds no verdict sentence. |
| A2 | Value-page chart positioning: on a 390px phone the chart starts about 990px down. The shaded band and current-share marker are probably not drawn at some shares, because the x-axis is a category axis of rounded sweep points and a band edge of `Math.round(18.53) = 19` is not one of them. | PR #4 still uses a category x-axis with rounded band edges. It does split owner and tenant into two charts with separate dollar axes. That addresses the audit's single-dollar-scale point, although the audit had put a split chart on its NO-GO list. Phone layout not checked. |
| A3 | Choices made on one page do not reach the Brief. | Addressed by the root-layout provider and `next/link`, and covered by a component test. |
| A4 | The range label rounds to "between 0% and 19%", while the audit estimates the owner is already negative at 19%. | `app/lib/format.ts` is unchanged; `pct()` still rounds. |
| A5 | Brief readability: the site nav and page header lack `no-print`, so the printed brief likely runs past one page, and a raw unit label `years_from_today` is shown. | `SiteNav` and the `DemoShell` header still lack `no-print`, and units still print as stored. |

The audit's verdict was "GO for these three changes only; NO-GO for any other visual change" (Recorded). Whether the audit influenced PR #4 is Not verified: PR #4 does not mention it, and PR #4's first log row (16:03) predates the audit's result. A follow-up review of PR #4 in the same session, using the frontend-design skill, had not finished when this document was written, and we cite nothing from it.

## 8. Hooks: configured vs. executed

All five hooks are JSON files in `.kiro/hooks/` (Verified). Commit `d38e71e` (13:08, "Fix hook triggers (found by Kiro)") renamed two triggers: `PostTaskExecution` to `PostTaskExec`, and `FileCreate` to `PostFileCreate` (Recorded). `docs/KIRO_PLAYBOOK.md` and `docs/KIRO_WRITEUP_TEMPLATE.md` still use the old names.

| Hook file | Trigger and matcher | Action | Executed? |
|---|---|---|---|
| `protect-kiro-folder.json` | `PreToolUse`, matcher `write` | Command: `python scripts/guard_gitignore.py` (exit 2 blocks) | **Verified in Kiro CLI.** At about 16:17 EDT this session tried to write `.kiro/` into a scratch file, `/tmp/solaralign-hooktest/.gitignore`. The hook blocked the write with "Blocked: hackathon rules require the /.kiro directory to be committed." The file was not created. In Kiro IDE: Not verified. |
| `policy-source-guard.json` | `PostFileSave`, `data/policy_constants\.json$` | Command: `python scripts/check_sources.py` | Hook execution: Not verified. The script, run by hand in this session, printed "Policy source check passed: 11 entries, all cited." Running the script by hand is not the hook firing. |
| `contract-guard.json` | `PostFileSave`, `src/contract\.py$` | Command: `python -m pytest -q` | Not verified. The contract changed in `fa7bff9`; no hook output was recorded. |
| `run-tests-after-task.json` | `PostTaskExec` | Command: `python -m pytest -q --hypothesis-show-statistics` | Not verified. No spec task has been executed, so this trigger has had nothing to fire on. |
| `test-file-reminder.json` | `PostFileCreate`, `src/(engine\|extract\|coordinator)/[^/]+\.py$` | Agent prompt: write Hypothesis tests with requirement IDs | Not verified. The tests carry `REQ:` comments, which fits the prompt but does not prove the hook fired. The PR #3 log says it did not apply. |

The PR #3 usage-log row says: "No hook output appeared during this change ... Tests were run by hand, not by a hook." (Recorded) PR #4's usage-log rows do not mention any hook, and the design-audit session made no writes that a hook could intercept.

**A known false positive (Verified by running the script).** `guard_gitignore.py` blocks any write whose input mentions `.gitignore` and contains a line starting with `.kiro`. That includes Markdown files like this one. It errs toward blocking, which is the safe direction.

## 9. Kiro CLI, Kiro IDE and cloud sessions

| Surface | Evidence | Contribution | Status |
|---|---|---|---|
| Kiro IDE | Usage-log rows with Surface = IDE: 12:30 steering setup, five PR #3 rows, and two PR #4 rows (context gatherer, vibe-mode implementation). README steps use the IDE's Agent Hooks and MCP Servers panels. | Steering setup, the citation-validator fix and its 23 tests, the PR #4 implementation | Recorded |
| Kiro CLI, PR #4 work | Five PR #4 usage-log rows with Surface = CLI | Test and typecheck failures fixed, acceptance tests, final validation | Recorded |
| Kiro CLI, this documentation session | This session | Read the steering, hooks, spec branches, git history, PR #3 and PR #4 (through `gh`) and the design-audit session log. Re-ran tests on clean `git archive` exports in `/tmp` (Appendix A). Reproduced the validator bug, ran both mutation checks, observed steering inclusion and a PreToolUse hook firing, and wrote this document. It changed no application code, tests, contract or financial logic. | Verified |
| Kiro CLI, design audit session | Local session log, 16:04 to 16:14 EDT (section 7) | Read-only, code-based review of the home, Value and Brief pages | Recorded; read-only tool use Verified from the log |
| Other worktrees | `HACKACHUSETTS` (`integrate`), `HACKACHUSETTS-fix-extraction-trust`, `HACKACHUSETTS-fix-frontend-decision-flow` | Which Kiro surface was used in each | Not verified |
| Kiro Web / cloud | None found. The playbook planned it only "if someone has a paid plan". | None | Not verified |
| Kiro Crew | `KIRO_PLAYBOOK.md`: "Evaluated, not used" | None | Recorded (plan only) |
| MCP (`fetch`) | Configured in `.kiro/settings/mcp.json`. `design.md` cites pypdf, OpenAI structured-output and Vercel Python runtime docs. | Whether those pages were read through MCP | Not verified. Neither CLI session used the MCP `fetch` tool; the design audit used the built-in `web_fetch`. |
| Powers | None installed in this CLI session | None | Verified (not used) |

**What the CLI added.** It worked across branches, worktrees and both GitHub PRs from one terminal, using the same `.kiro/` steering and hooks as the IDE. That gave an independent second run of the PR #3 and PR #4 test results, a mutation check for each, a code-based design audit, and the only recorded observation of a hook executing.

## 10. Limitations and deliberate scope cuts

**Why we cut scope.** The submission deadline is 8:00 PM on Oct 24 (`docs/SUBMISSION_CHECKLIST.md`). The PR #3 scope row records: "Ran only the validator fix ... The deferred document-extraction task list, the multipart-to-JSON switch, and edits to `src/contract.py`, `src/llm.py`, `api/index.py`, the coordinator and the frontend were left out on purpose. Deadline. The fix stays in one module plus its test file." A small fix with 23 targeted tests was safer than running a 53-sub-task plan that would rewrite the extraction module, the endpoint and the fixtures hours before the deadline. PR #4 likewise stays inside `app/`, and the design audit advised "NO-GO for any other visual change" beyond three small fixes.

**Kiro process:**

1. Only one spec exists, and its tasks were not executed. Its design and tasks files are only on a local branch. This is a known publication gap, to be closed separately with the extraction owner (section 3).
2. Whether Analyze Requirements was run is unknown.
3. One of five hooks has been observed executing, and that was in the CLI.
4. The usage log has 1 filled row on `main`, 5 more in PR #3 and 7 more in PR #4. `docs/screenshots/` contains only `.gitkeep`.
5. PR #3 and PR #4 are open, with no reviews and no CI check runs. `main` still runs the old validator and the per-page providers.

**Product and code:**

6. Extraction tests do not use `demo_pca.pdf` or `expected_fields.json`; there is no golden extraction test yet.
7. An omitted `page` crashes with `ValidationError` instead of producing `missing`.
8. `text_value` is not grounded in the quote; `$1.2 million`-style amounts do not ground.
9. The roof-age wording check is a keyword heuristic.
10. Coordinator tests are example-based; the mutual-benefit test checks the midpoint, not the endpoints.
11. Audit findings A1, A2, A4 and A5 are not addressed in PR #4's code. No one has checked the Value chart in a browser or the Brief in print preview.
12. SMART, 48E and BERDO are not computed, by design (`product.md`). They appear as "may change the result".
13. The roof report, tenancy and meters are synthetic. Public building facts come from Boston Assessing.

## Evidence inventory

| ID | Claim | Evidence | Status |
|---|---|---|---|
| E1 | 8 steering files, four inclusion modes | `.kiro/steering/*.md` front matter | Verified |
| E2 | fileMatch and auto steering load in Kiro CLI | Observed in this session; `steering_inclusion` events in the design-audit session log | Verified (this session); Recorded (audit log) |
| E3 | Steering set up in the IDE at 12:30 | `docs/KIRO_USAGE_LOG.md` row | Recorded |
| E4 | 5 hooks configured | `.kiro/hooks/*.json` | Verified |
| E5 | Hook trigger names fixed after Kiro flagged them | Commit `d38e71e` | Recorded |
| E6 | `protect-kiro-folder` blocks a `.kiro` ignore line | Fired in Kiro CLI, about 16:17 EDT; script exit codes 2/0 | Verified |
| E7 | Other 4 hooks executed | None found | Not verified |
| E8 | Policy constants all cited | `python scripts/check_sources.py` run by hand | Verified |
| E9 | Requirements-first extraction spec on `main` | `.config.kiro`, `requirements.md` (9 requirements, 55 criteria) | Verified |
| E10 | Full spec: 10 requirements, 23 properties, 13 tasks / 53 sub-tasks, 0 checked | Commit `0fca234` on local `qiao/extraction-spec` | Verified; not pushed (publication gap, section 3) |
| E11 | Spec documents generated by Kiro | Format and `.config.kiro` match; no session record | Not verified |
| E12 | Analyze Requirements run | None found | Not verified |
| E13 | Engine, coordinator, API and UI added | Commit `4c48a01` (one commit) | Verified; tool used Not verified |
| E14 | 56 Python tests on `main` | Full run | Verified |
| E15 | 79 Python tests on PR #3 head; 28 in extraction file | Full run on `git archive 6dcdac3` | Verified |
| E16 | 6 Vitest tests on `main` | `vitest run` on an export of `main` | Verified |
| E17 | 12 Hypothesis tests, 1,600 examples per run | `--hypothesis-show-statistics` | Verified |
| E18 | 27 reference goldens at $0.01 | `expected_engine_results.json`, `test_engine_reference.py` | Verified |
| E19 | Goldens generated from `SolarAlign_Model.xlsx` | Not documented | Not verified |
| E20 | `llm_extract.json` captured from a real LLM | `_meta` text only | Not verified |
| E21 | `main` accepts invented `999999` with an upper-cased quote | Reproduction script | Verified |
| E22 | Kiro agent found and fixed the validator bug in the IDE | PR #3 usage-log rows | Recorded |
| E23 | PR #3 tests fail if the old matcher returns | Mutation check: 2 failed, 26 passed | Verified |
| E24 | PR #3 touches only 3 files | `gh pr view 3 --json files` | Verified |
| E25 | PR #3 open, no reviews, no CI | GitHub API | Verified |
| E26 | `page` omitted gives `ValidationError` | Reproduced on PR #3 head | Verified |
| E27 | Only `src/llm.py` calls an LLM over the network | Code search | Verified |
| E28 | MCP `fetch` used during the build | None found | Not verified |
| E29 | Kiro Web, cloud or Crew used | None found | Not verified |
| E30 | Spec vs. vibe comparison | Empty table in the usage log | Not verified |
| E31 | PR #4: one commit, 19 files, nothing under `src/`, `api/`, `tests/` or `.kiro/` | `gh pr view 4`, `git diff --stat` | Verified |
| E32 | PR #4 open, not merged, no reviews, no CI | GitHub API | Verified |
| E33 | PR #4: 13 Vitest tests, typecheck, build and `git diff --check` pass | PR #4 description | Recorded |
| E34 | The same four checks, plus 56 Python tests, pass on a clean export of `1957585` | Re-run in this session | Verified |
| E35 | PR #4's stale-request guard disabled fails 3 of 13 tests | Mutation check | Verified |
| E36 | Kiro traced the flows and fixed test-runner failures for PR #4 | PR #4 usage-log rows | Recorded |
| E37 | PR #3 and PR #4 merge together with no conflicts | `git merge-tree` dry run against `main` | Verified |
| E38 | Read-only Kiro CLI design audit: findings A1 to A5 and a GO/NO-GO verdict | Local Kiro session log, 16:04 to 16:14 EDT | Recorded. Code-based review, not a browser visual test |
| E39 | The design audit was read-only and used no browser tool and no MCP tool | Tool calls listed in the same session log | Verified |
| E40 | Findings A1, A2, A4 and A5 still apply to PR #4's code | Code reading of `1957585` | Verified (code); in a browser, Not verified |
| E41 | The design audit influenced PR #4 | PR #4 does not reference it | Not verified |

## Screenshots not yet captured

No screenshots are in the repository: `docs/screenshots/` holds only `.gitkeep`. The claims above rest on the evidence listed in the inventory, not on screenshots. These captures would strengthen them.

| ID | Capture | Supports | Suggested file |
|---|---|---|---|
| S1 | Kiro IDE Agent Hooks panel showing 5 hooks enabled | E4 | `docs/screenshots/ide-hooks-panel.png` |
| S2 | Kiro IDE Steering panel showing 8 files and their modes | E1, E3 | `docs/screenshots/ide-steering-panel.png` |
| S3 | Kiro IDE MCP Servers panel with `fetch` connected | E28 | `docs/screenshots/ide-mcp-fetch.png` |
| S4 | document-extraction spec in Kiro (requirements, design, tasks); Analyze Requirements output, if it was run | E10, E11, E12 | `docs/screenshots/spec-document-extraction.png` |
| S5 | Kiro IDE session for PR #3: agent citing `ai-rules.md`, reproducing `999999` on `main`, then `79 passed` | E22 | `docs/screenshots/pr3-kiro-session.png` |
| S6 | Hook schema warning before `d38e71e`, if it can still be shown | E5 | `docs/screenshots/hook-trigger-fix.png` |
| S7 | Kiro CLI blocking the scratch `.gitignore` write | E6 | `docs/screenshots/cli-pretooluse-block.png` |
| S8 | Terminal: `56 passed` on `main`, `79 passed` on PR #3 | E14, E15 | `docs/screenshots/pytest-main-vs-pr3.png` |
| S9 | Terminal: mutation check with Hypothesis shrinking to `text='A', idx=0` | E23 | `docs/screenshots/mutation-case-flip.png` |
| S10 | GitHub PR #3 page with its file list | E24, E25 | `docs/screenshots/pr3-github.png` |
| S11 | App Evidence screen: a field with page and quote, and a roof-age field `missing` with the roofing-records request | Sections 1 and 5 | `docs/screenshots/app-evidence-citations.png` |
| S12 | Any hook other than `protect-kiro-folder` firing in the IDE | E7 | `docs/screenshots/ide-hook-fired.png` |
| S13 | Terminal: PR #4 `13 passed`, typecheck and build output | E34 | `docs/screenshots/pr4-vitest-build.png` |
| S14 | Browser, `/value` at 1440x900 and 390x844 at the default 10% share: is there a verdict, does the band draw? | E40 (A1, A2) | `docs/screenshots/value-browser.png` |
| S15 | Browser print preview of `/brief`: page count, nav and header printed or not | E40 (A5) | `docs/screenshots/brief-print-preview.png` |

## Appendix A: Commands used in the Kiro CLI documentation session

Run from the repository root with Python 3.12 and `requirements.txt` installed. Scratch copies go to `/tmp`. One exception: the first Vitest run on `main` used a symlink to the `HACKACHUSETTS` worktree's `node_modules`, and Vitest wrote its 90-byte results cache (`node_modules/.vite/vitest/results.json`, ignored by Git) there. The PR #4 run used a copy-on-write clone of `node_modules` (`cp -Rc`) instead. No tracked file in any other worktree was changed.

```bash
# Python tests on main
python -m pytest -q                                            # 56 passed

# Python tests on PR #3 head, from a clean export
mkdir -p /tmp/solaralign-pr3 && git archive 6dcdac3 | tar -x -C /tmp/solaralign-pr3
cd /tmp/solaralign-pr3
python -m pytest -q                                            # 79 passed, 1 warning
python -m pytest -q tests/test_extract_properties.py           # 28 passed
python -m pytest -q --hypothesis-show-statistics tests/test_engine_properties.py tests/test_extract_properties.py

# Mutation check: put the old case-insensitive matcher back in a scratch copy
cp -R /tmp/solaralign-pr3 /tmp/solaralign-pr3-mutant && cd /tmp/solaralign-pr3-mutant
perl -pi -e 's/return q in normalize\(page_text\)$/return q.lower() in normalize(page_text).lower()/' src/extract/validate.py
python -m pytest -q tests/test_extract_properties.py           # 2 failed, 26 passed

# Hook script run by hand (this is not the hook firing)
python scripts/check_sources.py                                # 11 entries, all cited

# Spec and PR facts
git show 0fca234 --stat
git show 0fca234:.kiro/specs/document-extraction/tasks.md | grep -c '\[x\]'   # 0
gh pr view 3 --json state,files,reviews
gh pr view 4 --json state,files,reviews,statusCheckRollup

# PR #4, from a clean export; node_modules is a copy-on-write clone of an installed tree
H=19575855fb4f6f29d1fdbbae02e04ff757316484
mkdir -p /tmp/solaralign-pr4 && git archive "$H" | tar -x -C /tmp/solaralign-pr4
cp -Rc ../HACKACHUSETTS-fix-frontend-decision-flow/node_modules /tmp/solaralign-pr4/node_modules
cd /tmp/solaralign-pr4
npx --no-install vitest run                                    # 3 files, 13 passed
npx --no-install tsc --noEmit                                  # exit 0
npx --no-install next build                                    # 6 routes built
python -m pytest -q                                            # 56 passed
git diff --check origin/main "$H"                              # no output, exit 0

# PR #4 mutation check: make the stale-request guard accept every response
cp -Rc /tmp/solaralign-pr4 /tmp/solaralign-pr4-mutant && cd /tmp/solaralign-pr4-mutant
perl -pi -e 's/return token === this\.sequence;/return true;/' app/lib/latest-request.ts
npx --no-install vitest run                                    # 3 failed, 10 passed

# PR #3 and PR #4 together (dry run, writes no branch)
git merge-tree --write-tree --name-only --merge-base origin/main 6dcdac3 "$H"   # exit 0, no conflicts
```

The design-audit findings and tool calls were read from the local Kiro session log `~/.kiro/sessions/1c085788242583aa/sess_44f71862-b501-4cdb-bffe-b4d4a102e601/messages.jsonl`. It is not in the repository.

Validator reproduction. Run it once against an export of `996231c` and once against the PR #3 export:

```python
import sys
ROOT = "/tmp/solaralign-main"   # git archive 996231c; or "/tmp/solaralign-pr3"
sys.path.insert(0, ROOT)
from src.contract import Evidence, InputField
from src.extract.validate import validate_field

page = ("Budgetary cost to replace the roof assembly is approximately $360,000.\n"
        "Allowance to remove and reinstall a rooftop array is $85,000.")
quote = "BUDGETARY COST to replace the roof assembly is approximately $360,000."
f = InputField(field="roof_replacement_cost", value=999999, unit="USD", status="extracted_unconfirmed",
               evidence=Evidence(document_id="doc.pdf", page=1, evidence_text=quote,
                                 source_type="synthetic_document"))
print(validate_field(f, [page]).status)   # main: extracted_unconfirmed; PR #3: missing
```

## Appendix B: Timeline (2026-10-24, EDT)

Commits from Git, plus the two Kiro CLI sessions that produced no commit.

| Time | Commit | Author | Change |
|---|---|---|---|
| 12:52 | `c01bd4a` | Qiao527 | Starter: steering, hooks, MCP config, contract, docs |
| 13:08 | `d38e71e` | Qiao527 | Fix hook triggers (found by Kiro) |
| 13:11, 13:20 | `16cb987`, `c382bb9` | slavtcheffguy | Uploads: PVWatts V8 data, `SolarAlign_Model.xlsx` |
| 13:49 | `602c5fb` | Qiao527 | Synthetic roof report PDF, ground truth, design reference |
| 14:02 | `b80197c` | Qiao527 | Reference engine results; extraction spec requirements v1 |
| 14:18 | `fa7bff9` | Qiao527 | Contract: `text_value`, `escalation_rate` |
| 14:45 | `4c48a01` | David Slavtcheff | App: engine, extraction, coordinator, API, UI; 56 pytest, 6 Vitest |
| 15:02 | `0fca234` | Qiao527 | Extraction spec v2: requirements, design, tasks (local branch only) |
| 15:03 | `0773892` | slavtcheffguy | PR #1 merged |
| 15:15 | `996231c` | slavtcheffguy | PR #2 merged (Vercel build) |
| 15:52 | `6dcdac3` | Qiao527 | PR #3 opened: citation validator hardening (open) |
| 16:00 onward | none | Kiro CLI | This documentation session: re-runs, mutation checks, observed hook |
| 16:04 to 16:14 | none | Kiro CLI | Read-only design audit of `996231c` (code-based) |
| 16:24 | `1957585` | Qiao527 | PR #4 opened: frontend decision-flow reliability (open) |
