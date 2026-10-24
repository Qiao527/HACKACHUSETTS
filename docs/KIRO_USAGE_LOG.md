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
**Spec vs. vibe comparison**

| Measure | Engine (spec mode) | UI styling (vibe mode) |
|---|---|---|
| Time spent | | |
| Prompts needed to fix things | | |
| Bugs found after "done" | | |
| How we knew it was correct | Property tests tied to requirements | Looked at it |
