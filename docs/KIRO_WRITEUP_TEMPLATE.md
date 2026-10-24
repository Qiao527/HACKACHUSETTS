# How We Used Kiro — SolarAlign

> Required by the rules. Fill each section only with evidence from `docs/KIRO_USAGE_LOG.md`. Concrete beats general: name the file, requirement, counterexample, commit.

## Strategy in two sentences
[e.g. "SolarAlign is a money-and-evidence tool where the obvious formulas are wrong, so we led with specs and property-based tests, encoded domain rules in steering, and made verification automatic with hooks."]

## Kiro tools (IDE, CLI, Web, Crew)
| Tool | Used for | How it differed |
|---|---|---|
| IDE | | |
| CLI | | |
| Web | [used for … / not used because …] | |
| Crew | Evaluated, not used | Persistent scheduled orchestration; not needed for a one-day build |

## Spec-driven development
- How we structured the specs: [engine / extraction / coordinator + UI, and why]
- What Analyze Requirements caught: [...]
- Spec vs. vibe: [table from the log]

## Agent hooks
| Hook | Trigger | What it automated | Example of it mattering |
|---|---|---|---|
| run-tests-after-task | PostTaskExecution | pytest + Hypothesis after every task | |
| contract-guard | PostFileSave (src/contract.py) | full suite on contract change | |
| policy-source-guard | PostFileSave (policy_constants.json) | every policy number must cite a source | |
| protect-kiro-folder | PreToolUse | blocks ignoring .kiro (rules compliance) | |
| test-file-reminder | FileCreate (agent) | property tests for new core modules | |

## Steering
| File | Mode | Why |
|---|---|---|
| product, tech, structure | always | |
| financial-rules | fileMatch (engine) | |
| ai-rules | fileMatch (extract, coordinator) | |
| ui-rules | fileMatch (app) + DESIGN.md reference | |
| policy-sources | auto + live file reference | |
| demo-script | manual | |
- Biggest difference: [...]

## MCP
- [what fetch let Kiro read, and the before/after]

## Property-based testing
- Requirements with PBT: [...]
- What PBT caught that unit tests would have missed: [counterexample, fix]

## Powers
- [used / not used, why]
