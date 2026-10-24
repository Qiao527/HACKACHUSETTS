# How Kiro Was Used: SolarAlign

Hackachusetts 2026 · Climatech & Clean Energy track · https://github.com/Qiao527/HACKACHUSETTS

Every claim below points to a file, a commit or a row in [`KIRO_USAGE_LOG.md`](KIRO_USAGE_LOG.md). A longer, conservative audit written by a separate Kiro CLI session is kept in [`KIRO_EVIDENCE_AUDIT.md`](KIRO_EVIDENCE_AUDIT.md).

## Our strategy in one paragraph

SolarAlign mixes two kinds of work that fail in different ways: an LLM that reads a roof report, and money math that must be exact to the cent. Our strategy was to let Kiro move fast but never let it guess. **Steering** wrote our non-negotiable rules down once ("only the engine computes money", "no citation, no value"). A **requirements-first spec** turned those rules into EARS criteria, design properties and tasks. **Property-based tests** and reference goldens turned the properties into executable checks. **Hooks** guarded the things that could disqualify us or break the shared contract. We used **vibe mode** on purpose for the UI and compared the two approaches.

## Results at a glance

| | |
|---|---|
| Steering files | 8, using all four inclusion modes |
| Specs | 1 full requirements-first spec: 10 requirements, 101 EARS criteria, 23 correctness properties, 14 tasks / 57 sub-tasks (`.kiro/specs/document-extraction/`) |
| Analyze Requirements | 1 loophole found and closed before design |
| Hooks | 5 configured; 2 fixed by Kiro on day one; seen firing on spec writes, contract saves, and blocking a `.kiro` ignore in the CLI |
| Tests on `main` | 79 Python (12 Hypothesis property tests, 27 engine reference goldens at $0.01) + 30 Vitest |
| Real bugs Kiro caught | A citation validator that accepted an invented 999,999; a chart band that vanished at a 19% edge; a float-only contract field that could not hold dates |
| Kiro surfaces | Kiro IDE (build) and Kiro CLI (verification, audit, release checks) |

## 1. Which Kiro tools we used, and how they differed

- **Kiro IDE** was where we built: steering setup, the spec, the citation-validator fix (PR #3) and the frontend decision-flow fix (PR #4). The IDE's sub-agents mattered most here: 9 requirement-detailer sub-agents for the spec, and a context-gatherer sub-agent that traced the frontend flows before PR #4 touched anything.
- **Kiro CLI** was where we verified. Running from one terminal with the same `.kiro/` steering and hooks, it re-ran the test suites on clean exports of each branch, ran mutation checks, did a read-only plan-mode design audit, and caught the PR #4 chart defect before merge (log 16:04–17:18).
- **The difference:** the IDE was best for building with visible diffs and approvals; the CLI was best for repeatable, scriptable checks across branches and worktrees. Using both gave us an independent second pass on every change.
- **Not used:** Kiro Web (no paid plan) and Crew (built for persistent scheduled work, not a one-day build).

## 2. Spec-driven development

**How we structured it.** We chose requirements-first for the riskiest module: document extraction, where an LLM proposes numbers. Before writing anything, Kiro read our data contract (`src/contract.py`) and the ground-truth answers (`data/demo_documents/expected_fields.json`), then wrote 9 requirements with 55 EARS criteria using 9 requirement-detailer sub-agents (log ~13:55).

**What the spec caught before code (log ~13:55, ~14:10):**
1. Kiro noticed `InputField.value` was float-only while the roof report contains dates, text and booleans. Because steering marks the contract as frozen, Kiro refused to edit it and escalated to the contract owner. We added `text_value` (commit `fa7bff9`).
2. **Analyze Requirements** found that a roof-age value could be accepted without evidence. We added an acceptance criterion so it becomes `missing` with a request for roofing records.

**How requirements became checks.** Version 2 has 10 requirements and 101 criteria, a `design.md` with 23 correctness properties, and a `tasks.md` with 14 tasks and 57 sub-tasks (published revision). Each property names the requirements it validates, and each property-test task names its property. Example chain: Requirement 3.13 (compare the quote to the page with no case folding) → Property 10 (any non-whitespace change, including a case flip, makes the field `missing`) → Task 4.12 (property test for quote matching).

**How it compared to vibe coding.** We measured both (table at the end of the usage log). The spec found 2 problems before any code existed. Later, when the one-shot implementation lowercased quotes, the spec told us exactly which rule it broke (Requirement 3.1, "exact-character substring"). Vibe mode was faster for the UI, but its one post-"done" bug only appeared when we rendered the real chart. Our takeaway: spec mode for anything that decides a number, vibe mode for presentation, and a real-render check either way.

**Honest scope cut.** We wrote one spec, not three, and did not execute the 57 extraction sub-tasks: rewriting extraction hours before the deadline was riskier than one focused, tested fix.

## 3. Agent hooks

| Hook | What it automates | Evidence |
|---|---|---|
| `protect-kiro-folder` (PreToolUse, command) | Blocks any agent write that would add `.kiro` to a `.gitignore` — the one mistake that disqualifies a submission | Ran on all 11 spec writes (IDE, ~13:55); "15 hooks triggered" during PR #4 (IDE, ~16:23); **blocked** a real write in the CLI (16:17) |
| `contract-guard` (PostFileSave on `src/contract.py`, command) | Runs the full test suite whenever the shared contract changes | Ran on each contract edit (IDE, ~14:12) |
| `policy-source-guard` (PostFileSave on `data/policy_constants.json`) | Fails if any policy number lacks a source URL and retrieval date | `scripts/check_sources.py`: 11 entries, all cited |
| `run-tests-after-task` (PostTaskExec) | Runs pytest with Hypothesis statistics after each spec task | Configured; spec tasks were deferred, so it had nothing to fire on |
| `test-file-reminder` (PostFileCreate, agent prompt) | Asks Kiro to write requirement-tagged Hypothesis tests for any new engine/extract/coordinator module | Configured; no new module was created after it was fixed |

**Kiro fixed our hooks first.** On day one Kiro flagged two invalid trigger names (`PostTaskExecution`, `FileCreate`) and corrected them (commit `d38e71e`). Without that, two hooks would have silently never fired. We used command hooks for routine checks (no credits) and an agent hook only where judgment was needed.

## 4. Steering

| File | Mode | What it pins down |
|---|---|---|
| `product.md`, `tech.md`, `structure.md` | always | Locked architecture; one `call_llm`; tests never call a real LLM or the network; module boundaries |
| `financial-rules.md` | fileMatch `src/engine/**` | Seven money rules (three schedules vs. one baseline, integer-cent splits, two metrics never summed, `None` is a valid range) |
| `ai-rules.md` | fileMatch `src/extract/**`, `src/coordinator/**` | No citation, no value; never infer roof age; the coordinator may only copy engine numbers |
| `ui-rules.md` | fileMatch `app/**` + `#[[file:DESIGN.md]]` | The UI never computes money; owner and tenant always side by side |
| `policy-sources.md` | auto + `#[[file:data/policy_constants.json]]` | Policy numbers only from the cited constants file |
| `demo-script.md` | manual | Video beats and wording rules |

**The strategy that made the biggest difference: fileMatch rules next to the code they govern.** The money rules load only when Kiro opens engine files, and the AI rules load only for extraction and coordinator files. We saw `policy-sources.md` load by itself during requirement detailing, and `ai-rules.md` / `financial-rules.md` appear in the CLI as soon as matching files were read. The payoff was concrete: working under `ai-rules.md`, Kiro read "whitespace normalization only", found that `src/extract/validate.py` lowercased both quote and page, and reproduced the consequence — `main` accepted an invented roof cost of **999,999** cited to a line that says **$360,000**. Steering also held across separate chats: Kiro never edited the frozen contract without the owner's approval.

## 5. Property-based testing

- **Engine:** 9 Hypothesis properties from `financial-rules.md`: owner + tenant + unallocated equals the year's total to the cent; more tenant share never helps the owner; tenant share never changes kWh; a higher removal cost never raises owner NPV; the roof cost is charged once; points inside the positive-outcome range satisfy both conditions. Plus 27 reference goldens matched within $0.01.
- **Extraction (PR #3):** 23 new tests, including "any one-letter case flip in a quote makes the field `missing`" and "`$N,NNN` grounds N and not N+1". The suite went from 56 to 79 passing.
- **Did PBT catch what unit tests missed?** Yes. The original example-based test lowercased its own input and so passed the bug. We proved the new properties work with a mutation check: putting the old matcher back fails both case tests, and Hypothesis shrinks the counterexample to a single-letter flip (`text='A'`).

## 6. MCP and Powers

We configured the `fetch` MCP server (`.kiro/settings/mcp.json`) so Kiro could read real API docs. In practice we deliberately worked from cached fixtures (NREL PVWatts, Boston Assessing) so that no test touches the network, and we have no recorded MCP call to claim. We did not install Powers.

## 7. What we would do next

Execute the 57 extraction sub-tasks under `run-tests-after-task`, add engine and coordinator specs, and turn the coordinator's example tests into Hypothesis properties.
