# Kiro Usage Log

**Rule:** whenever a hook fires, a test fails, Kiro catches a mistake, or we choose not to use a feature, we add a row right away. The Kiro write-up ([`HOW_KIRO_WAS_USED.md`](HOW_KIRO_WAS_USED.md)) is built only from this log. Never log something that did not happen.

All times are EDT on Saturday, Oct 24, 2026. Rows before 15:00 were kept live in the team's shared doc during the build and copied here before submission.

| Time | Who | Kiro feature | Surface | What happened | Why it mattered |
|---|---|---|---|---|---|
| 12:30 | D | Steering | IDE | Added 8 steering files using all four inclusion modes (always, fileMatch, auto, manual). | Every task starts with our product and money rules. |
| ~13:05 | Qiao | Hooks | IDE | Kiro found 2 invalid hook trigger names (`PostTaskExecution`, `FileCreate`) and fixed them to `PostTaskExec` and `PostFileCreate` (commit `d38e71e`). | Those two hooks would otherwise have silently never fired. |
| ~13:55 | Qiao | Spec (Requirements-First) | IDE | For the document-extraction spec, Kiro read `src/contract.py` and `data/demo_documents/expected_fields.json` first, wrote 9 requirements with 55 EARS criteria, and ran 9 requirement-detailer sub-agents (about 10 min, ~9.3 credits). | Requirements were tied to the real data contract and the ground-truth fields, not to a guess. |
| ~13:55 | Qiao | Spec | IDE | Kiro flagged that `InputField.value` was float-only while the expected fields include dates, text and booleans. It refused to change the frozen contract and escalated to the contract owner. | Caught a type mismatch before any code. Led to `InputField.text_value` (commit `fa7bff9`). |
| ~13:55 | Qiao | Hook (PreToolUse) | IDE | `protect-kiro-folder` ran on all 11 spec-file writes. It never needed to block. | The rules-compliance guard runs on every agent write. |
| ~13:55 | Qiao | Steering (auto) | IDE | `policy-sources.md` loaded on its own during requirement detailing. | Auto inclusion works without being asked. |
| ~14:10 | Qiao | Analyze Requirements | IDE | Found 1 ambiguity: a roof-age value could be accepted without evidence. Added a new acceptance criterion (~1.7 credits). | Closed a loophole in "no citation, no value" before design. |
| ~14:12 | Qiao | Hook (PostFileSave) | IDE | `contract-guard` ran the test suite on each `src/contract.py` edit; Kiro also verified the new fields by importing them. | Contract changes were checked automatically. |
| ~14:15 | Qiao | Steering | IDE | Kiro respected "the contract is frozen" across separate chats and edited only after the owner approved; it also flagged that the TypeScript mirror needed the same change. | Rules held across sessions. |
| 15:02 | Qiao | Spec (design + tasks) | IDE | Spec v2: 10 requirements / 101 criteria, `design.md` with 23 correctness properties, `tasks.md` with 13 tasks and 53 sub-tasks, each property test linked to its requirements. The plan was subsequently revised to **14 tasks / 57 sub-tasks** in the published `main` version. | Every requirement maps to a checkable property; the 15:02 count is retained as historical. |
| ≤15:52 | Kiro agent | Steering (`ai-rules.md`, fileMatch) | IDE | Read before editing `src/extract/validate.py`. Rule 1 allows whitespace normalization only, so Kiro removed the `.lower()` on both quote and page. The existing test that also lowercased was tightened to match. | The old validator accepted an upper-cased quote. It also accepted an invented value of 999999 cited to a line that says "$360,000" (reproduced on `main` before the change). |
| ≤15:52 | Kiro agent | Scope decision | IDE | Ran only the validator fix on branch `fix/extraction-trust`. The deferred extraction task list, the multipart-to-JSON switch, and edits to `src/contract.py`, `src/llm.py`, `api/index.py`, the coordinator and the frontend were left out on purpose. | Deadline. The fix stays in one module plus its test file. |
| ≤15:52 | Kiro agent | Property-based test (Hypothesis) | IDE | Added 23 tests to `tests/test_extract_properties.py`: valid citations, invalid pages (0, 2, 99), case mismatch, any one-letter case flip, mismatched money, `$N,NNN` grounds N and not N+1, range bounds, and missing roof-installation evidence. | `tests/test_extract_properties.py` 28 passed; `python -m pytest -q` 79 passed (56 before). With the old matcher patched back in, both case tests fail. |
| ≤15:52 | Kiro agent | Finding not fixed (scope) | IDE | `_to_input_field` builds `Evidence(page=0)` when the LLM omits `page`, and pydantic raises `ValidationError` instead of returning a missing field. Reproduced, not changed. | The fix is in another file and belongs to the deferred spec tasks. |
| ≤15:52 | Kiro agent | Hook | IDE | No hook output appeared during this change: no new `src/` module (so `test-file-reminder` did not apply) and `src/contract.py` was not saved (so `contract-guard` did not apply). | Tests were run by hand for this PR, not by a hook. |
| 16:03 | Kiro | Context gatherer sub-agent | IDE | Traced the provider, engine sweep, proposal, navigation and brief flows in an isolated worktree before editing. | The change stayed inside the frontend and left extraction, API, contract and engine files untouched. |
| 16:04–16:14 | Kiro | CLI design audit | CLI | Read-only, plan-mode review of the home, Value and Brief pages from source code; 5 ranked findings and a GO/NO-GO verdict. | A second opinion on the UI without touching code. |
| 16:11 | Kiro | Test failure | CLI | New React component tests failed: Vitest compiled TSX with the classic JSX runtime (`React is not defined`). Added the automatic JSX transform to `vitest.config.ts`. | Exposed a test-runner mismatch without changing production behavior. |
| 16:12 | Kiro | Typecheck failure | CLI | Strict TypeScript flagged four nullable test-renderer references; only those assertions changed. | Test code passes the same strict checks as production code. |
| 16:12 | Kiro | Vibe mode implementation | IDE | One `ScenarioProvider` in the root layout; input revisions and latest-request guards; stale financial, sweep, proposal and brief output blocked; AI proposals labeled "Draft — Not Mutually Accepted". | Roof year and tenant share persist across pages, and no result from an older input is shown as current. |
| 16:17 | Kiro | Hook (PreToolUse) | CLI | `protect-kiro-folder` **blocked** a write that would have added `.kiro/` to a scratch `.gitignore`: "Blocked: hackathon rules require the /.kiro directory to be committed." | The disqualification guard works in the CLI as well as the IDE. |
| 16:23 | Kiro | Test failure | CLI | The root-layout persistence test reached Next.js Link's browser-only idle callback in the Node test renderer (`self is not defined`). Replaced Link with an anchor only inside the test module. | The test exercises the real root provider composition without a browser. |
| ~16:23 | Kiro | Hook (PreToolUse) | IDE | Kiro IDE showed "15 hooks triggered": `protect-kiro-folder` ("Block ignoring the .kiro folder") ran on each agent file write while the PR #4 tests and this log were edited. None needed to block. | The guard runs on every agent write in the IDE. |
| 16:24 | Kiro | Validation | CLI | `npm run typecheck`, `npm run test` (3 files, 13 tests), `npm run build` and `git diff --check` passed; PR #4 opened, not auto-merged. | Focused, reviewable PR. |
| 17:00 | Kiro | Release verification | CLI | Confirmed local HEAD `1957585` matched PR #4 and the worktree was clean. Parameterized the persistence test for roof year 4 and tenant share 15% through Timing → Value → Brief (1 passed), then restored the file byte-for-byte. | Verified the exact published revision. |
| 17:00 | Kiro | Release tests | CLI | `npm run typecheck`, `npm run test` (13 passed), `npm run build`, and the engine reference/property subset (38 passed). | Frontend and financial reference values both passed. |
| 17:01 | Kiro | Verification script failure | CLI | A cross-fixture chart probe assumed every fixture had a range and stopped on the expected no-range case; reran with null handling. | Covered both positive-range and no-range fixtures. |
| 17:01 | Kiro | Visual defect caught | CLI | Real Recharts rendering omitted the Positive-Outcome band when its edge was 19%, because the 41-point rounded axis has 18% and 20% but not 19%. The roof-year-4 reference case hits this. | Kiro set PR #4 to NO-GO until fixed. A bug that all unit tests missed. |
| 17:12 | Kiro | Release patch | IDE / CLI | Allocation x-axis switched to numeric 0–100 with exact continuous engine bounds. Ran the real Recharts render test first: the roof-year-4 band and 11%, 12%, 17%, 19% markers all rendered. | Removed the merge blocker. |
| 17:14 | Kiro | Vibe mode patch | IDE | Added the current-outcome verdict, "Agreement not confirmed" labels and fixed-height placeholders; no financial logic changed. | Judges can read the current outcome at a glance; recalculation no longer collapses the layout. |
| 17:15 | Kiro | Acceptance data | CLI | Ran the unchanged Python engine for default, 0%, 10%, 18% and roof-year-4 19%. At 19%: owner NPV $968.62, tenant savings $11,257.70, so the verdict stays positive. | UI verdict tests use authoritative engine outputs. |
| 17:17 | Kiro | Review catch | CLI | Read-only patch review found the small-value formatter returned `$0` while its new test expected `$0k`; corrected the test. | Test contract matches the intended axis format. |
| 17:18 | Kiro | Final release validation | CLI | `npm run typecheck`, `npm run test` (5 files, 30 tests), `npm run build`, `git diff --check`, and 38 engine reference/property tests passed; protected paths had no diff. | PR #4 merged after this. |

## Choices we made not to use a feature

| Feature | Decision | Why |
|---|---|---|
| Spec for engine and coordinator | Not written; only the extraction module has a spec | The engine was checked against 27 reference goldens and property tests instead. A second and third spec did not fit the day. |
| Running the 57 extraction sub-tasks (published plan) | Deferred | Rewriting extraction, the endpoint and fixtures hours before the deadline was riskier than one focused, tested fix (PR #3). |
| MCP `fetch` | Configured, no recorded use | We worked from cached fixtures (PVWatts, Boston Assessing) so tests never call the network. |
| Kiro Web / Crew / Powers | Not used | No paid plan for Web; Crew targets persistent scheduled work, not a one-day build. |

## Spec vs. vibe comparison

| Measure | Extraction (spec mode) | Frontend decision flow, PR #4 (vibe mode) |
|---|---|---|
| Time | Requirements ~10 min; Analyze Requirements a few minutes; design + tasks by 15:02 | ~29 min for the first PR, plus a ~20 min release pass (17:00–17:18) |
| Credits | ~9.3 (requirements) + ~1.7 (Analyze) | ~115.5 for the first PR |
| Problems found before code | 2 (float-only contract field; roof age without evidence) | 0 — vibe mode starts from code |
| Bugs found after "done" | 1: the one-shot implementation lowercased quotes, breaking Requirement 3.1 ("exact-character substring"); found by Kiro under `ai-rules.md` (PR #3) | 1: the Positive-Outcome band vanished at a 19% edge; found by a real-render check, not by the 13 unit tests |
| How we knew it was correct | Requirement → design property → Hypothesis test, plus a mutation check | Component tests, a mutation check of the stale-request guard, and a real Recharts render test |
| Lesson | The spec caught problems before code, and later told us exactly which rule the code broke | Fast for UI, but the defect only surfaced when we rendered the real chart |
