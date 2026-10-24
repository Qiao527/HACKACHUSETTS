# Kiro Playbook — SolarAlign

Kiro is required (insufficient use can disqualify us) and "how well we used Kiro" is one of the three judging criteria. Use it deliberately and log everything in `docs/KIRO_USAGE_LOG.md`.

## Five rules
1. All config stays in the repo's `.kiro/`. Never add `.kiro` to `.gitignore` (a hook blocks the agent from doing it).
2. Let Kiro make code changes: file hooks only fire on agent edits, not manual ones.
3. Log as you go: screenshot + one row in the usage log whenever Kiro catches something or a hook fires.
4. Command hooks for routine checks (no credits); agent hooks only where judgment is needed.
5. Save credits: write precise prompts (expected vs. actual vs. error text), use Quick Spec for well-understood pieces, vibe mode for small UI tweaks.

## What we use, and why

| Feature | How we use it | Owner |
|---|---|---|
| **Specs** (Requirements-First) | One spec per module: engine (A), extraction (B), coordinator + UI (B + C). Seeds in `docs/SPEC_SEED.md`. Run **Analyze Requirements** before approving; **Run all Tasks** for parallel waves | A, B, C |
| **Property-based tests** | Kiro turns EARS properties into Hypothesis tests: conservation, monotonicity, no inference, no invented numbers. Our strongest Kiro story | A, B |
| **Steering** (all 4 modes) | always: `product`, `tech`, `structure` · fileMatch: `financial-rules` (engine), `ai-rules` (extract/coordinator), `ui-rules` (app, references `DESIGN.md`) · auto: `policy-sources` (live link to `policy_constants.json`) · manual: `demo-script` | D |
| **Hooks** | `run-tests-after-task` (PostTaskExecution), `contract-guard` (PostFileSave on contract), `policy-source-guard` (PostFileSave on constants), `protect-kiro-folder` (PreToolUse), `test-file-reminder` (FileCreate, agent) | D |
| **MCP** | `fetch` server so Kiro reads real API/dataset docs (PVWatts, Boston open data) instead of guessing field names | B |
| **CLI** | Data scripts (PVWatts fixture, Assessing row) run from the terminal with the same steering | D |
| **Web** | Only if someone has a paid plan: delegate one independent task to a cloud session that opens a PR | any |
| **Crew** | Evaluated, not used: built for persistent scheduled work, not a one-day build. Say so in the write-up | — |
| **Spec vs. vibe** | Engine in spec mode, UI styling in vibe mode on purpose; compare rework in the log | C, D |
| **Checkpoints** | Roll back a bad task instead of prompting Kiro to undo; log it | all |

## Verify early (first 15 minutes)
- Agent Hooks panel shows 5 hooks, all enabled (fix any schema warning by asking Kiro, and log it).
- MCP Servers panel shows `fetch` connected.
- Steering panel shows 8 files.
- Note: the PreToolUse hook blocks with exit code 2; confirm it behaves as expected and log the result.
