# Kiro Usage Log

**Rule:** whenever a hook fires, a test fails, Kiro catches a mistake, or you choose not to use a feature, add a row right away and drop a screenshot in the shared folder. The final Kiro write-up is built only from this log. Never log something that did not happen.

| Time | Who | Kiro feature | Surface (IDE / CLI / Web) | What happened | Why it mattered | Screenshot link |
|---|---|---|---|---|---|---|
| 12:30 | D | Steering | IDE | Added steering files with all four inclusion modes | Every task starts with our product and money rules | |
| | | Spec / Analyze Requirements | IDE | | | |
| | | Property-based test | IDE | | | |
| | | Hook | IDE | | | |
| | | MCP | IDE | | | |
| | | CLI | CLI | | | |
| | | Vibe mode (comparison) | IDE | | | |

| 16:03 | Kiro | Context gatherer | IDE | Traced the provider, engine sweep, proposal, navigation, and brief flows in the isolated worktree before editing. | The implementation stayed inside the frontend ownership boundary and left extraction, API, contracts, and engine files untouched. | |
| 16:11 | Kiro | Test failure | CLI | New React component tests failed because Vitest compiled TSX with the classic JSX runtime (`React is not defined`). Added the automatic JSX transform to `vitest.config.ts` before rerunning. | The failure exposed a test-runner mismatch without changing production behavior. | |
| 16:12 | Kiro | Typecheck failure | CLI | Strict TypeScript flagged four nullable test-renderer references. Changed only those assertions to use the renderer’s established non-null invariant. | Test code now passes the same strict checks as production code. | |
| 16:12 | Kiro | Vibe mode implementation | IDE | Moved one ScenarioProvider to the root layout; added input revisions and latest-request guards; blocked stale financial, sweep, proposal, and brief output; converted owned CTAs to Link and kept the external-owned Evidence CTA on client-side navigation through DemoShell. | Roof year and tenant share now remain in one provider across workflow route changes, and financial output is tied to the current input rather than scenario_id. | |
| 16:12 | Kiro | Acceptance tests | CLI | Added component tests that exercise the root-layout provider, retain roof year and a 30% tenant share across child-route replacement, reject out-of-order and failed engine completions, hide obsolete allocation sweeps, clear an obsolete proposal after an input revision, and require the draft label on the current proposal. | The requested state-consistency behavior has repeatable regression coverage. | |
| 16:24 | Kiro | Final validation | CLI | `npm run typecheck`, `npm run test` (3 files, 13 tests), `npm run build`, and `git diff --check` passed. | The focused branch typechecks, passes frontend tests, and produces all six application routes in a production build. | |
| 16:23 | Kiro | Test failure | CLI | The root-layout persistence test reached Next.js Link’s browser-only idle callback in the Node test renderer (`self is not defined`). Replaced Link with a semantic anchor only inside the test module. | The test can exercise the real root provider composition without requiring a browser or changing production navigation. | |
| 17:00 | Kiro | Release verification | CLI | Confirmed local HEAD `1957585` matches PR #4, the PR is open and mergeable, and the worktree was clean before verification. | The review used the exact published PR revision. | |
| 17:00 | Kiro | Acceptance test | CLI | Temporarily parameterized the existing root-layout persistence test for roof year 4 and tenant share 15%, stepped its child through Timing → Value → Brief, observed 1 passing test, then restored the committed test file byte-for-byte. | This verified the requested state values without changing the PR implementation. | |
| 17:00 | Kiro | Release tests | CLI | `npm run typecheck`, `npm run test` (13 passed), `npm run build`, and the engine reference/property subset (38 passed) all completed successfully. | Frontend compilation, regression behavior, production output, and financial reference values passed. | |
| 17:01 | Kiro | Verification script failure | CLI | The first cross-fixture chart probe assumed every fixture had a range and stopped on the expected null-range case. Reran it with null handling. | The corrected probe covered both positive-range and no-range fixtures. | |
| 17:01 | Kiro | Visual defect | CLI | Actual Recharts rendering omitted `ReferenceArea` when its categorical x2 value was 19%, because the 41-point rounded axis contains 18% and 20% but not 19%. The roof-year-4 reference case has this endpoint. | The required Positive-Outcome Range shading is absent for the requested release scenario, so PR #4 is NO-GO pending a focused chart-axis fix and browser confirmation. | |
| 17:01 | Kiro | Scope verification | CLI | Protected paths and fixture Git object hashes matched `origin/main`; `tests/test_engine_reference.py` and `tests/test_engine_properties.py` passed 38 tests. Browser access was unavailable. | Extraction, contracts, API implementation, financial engine, policy constants, and reference fixtures were unchanged; visual layout still needs manual browser verification. | |
| 17:12 | Kiro | Release patch | IDE / CLI | Changed the allocation x-axis to numeric 0–100 coordinates with fixed 25-point ticks, exact continuous engine bounds, and whole-percent current markers. Ran the actual Recharts rendering test first: roof-year-4 band plus 11%, 12%, 17%, and 19% markers all rendered. | This directly removed the confirmed PR #4 merge blocker before other UI work. | |
| 17:14 | Kiro | Verdict and stability patch | IDE | Added the compact current-outcome verdict, two “Agreement not confirmed” labels, continuous-vs-whole range copy, and fixed-height allocation/proposal placeholders. Kept the 41-point request flow; no sweep cache or financial logic changed. | Judges can read the current modeled outcome immediately, while recalculation hides old money without collapsing the main frames. | |
| 17:15 | Kiro | Acceptance data | CLI | Ran the unchanged Python engine for default, 0%, 10%, 18%, and roof-year-4 19%. The 19% owner NPV was $968.62 and tenant savings were $11,257.70, so the verdict remains positive. | The UI verdict tests use authoritative engine outputs and do not mislabel the 19% case. | |
| 17:17 | Kiro | Review catch | CLI | Read-only patch review found the updated small-value currency formatter returned `$0` while its new test still expected `$0k`. Corrected the test expectation; production formatting was retained. | The final test contract now matches the intended readable axis format, including `-$19k` and `-$500`. | |
| 17:18 | Kiro | Final release validation | CLI | `npm run typecheck`, `npm run test` (5 files, 30 tests), `npm run build`, `git diff --check`, and 38 unchanged engine reference/property tests passed. Protected engine, API, extraction, contract, and fixture paths had no diff. | The focused release patch is ready for PR update; no browser session was available for a manual responsive-layout check. | |
**Spec vs. vibe comparison**

| Measure | Engine (spec mode) | UI styling (vibe mode) |
|---|---|---|
| Time spent | | |
| Prompts needed to fix things | | |
| Bugs found after "done" | | |
| How we knew it was correct | Property tests tied to requirements | Looked at it |
