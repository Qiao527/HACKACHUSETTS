# Kiro Usage Log

**Rule:** whenever a hook fires, a test fails, Kiro catches a mistake, or you choose not to use a feature, add a row right away and drop a screenshot in the shared folder. The final Kiro write-up is built only from this log. Never log something that did not happen.

| Time | Who | Kiro feature | Surface (IDE / CLI / Web) | What happened | Why it mattered | Screenshot link |
|---|---|---|---|---|---|---|
| 12:30 | D | Steering | IDE | Added steering files with all four inclusion modes | Every task starts with our product and money rules | |
| Oct 24 | Kiro agent | Steering (`ai-rules.md`, fileMatch) | IDE | Read before editing `src/extract/validate.py`. Rule 1 allows whitespace normalization only, so Kiro removed the `.lower()` on both quote and page. The existing test that also lowercased was tightened to match. | The old validator accepted an upper-cased quote. It also accepted an invented value of 999999 cited to a line that says "$360,000" (reproduced on `main` before the change). | |
| Oct 24 | Kiro agent | Scope decision | IDE | Ran only the validator fix on branch `fix/extraction-trust`. The deferred document-extraction task list, the multipart-to-JSON switch, and edits to `src/contract.py`, `src/llm.py`, `api/index.py`, the coordinator and the frontend were left out on purpose. | Deadline. The fix stays in one module plus its test file. | |
| Oct 24 | Kiro agent | Property-based test (Hypothesis) | IDE | Added 23 tests to `tests/test_extract_properties.py`: valid citations, invalid pages (0, 2, 99), case mismatch, any one-letter case flip, mismatched money, `$N,NNN` grounds N and not N+1, range bounds, and missing roof-installation evidence. | Results: `tests/test_extract_properties.py` 28 passed; `python -m pytest -q` 79 passed, 0 failed (56 before). With the old case-insensitive matcher patched back in, both case tests fail, so they catch the bug. | |
| Oct 24 | Kiro agent | Finding not fixed (scope) | IDE | `src/extract/extract.py` `_to_input_field` builds `Evidence(page=0)` when the LLM omits `page`, and pydantic raises `ValidationError` instead of returning a missing field. Reproduced, not changed. | The fix is in another file and belongs to the deferred spec. | |
| Oct 24 | Kiro agent | Hook | IDE | No hook output appeared during this change. No new `src/` module was created, so `test-file-reminder` did not apply. `src/contract.py` was not saved, so `contract-guard` did not apply. | Tests were run by hand, not by a hook. | |
| | | Spec / Analyze Requirements | IDE | | | |
| | | Property-based test | IDE | | | |
| | | Hook | IDE | | | |
| | | MCP | IDE | | | |
| | | CLI | CLI | | | |
| | | Vibe mode (comparison) | IDE | | | |

**Spec vs. vibe comparison**

| Measure | Engine (spec mode) | UI styling (vibe mode) |
|---|---|---|
| Time spent | | |
| Prompts needed to fix things | | |
| Bugs found after "done" | | |
| How we knew it was correct | Property tests tied to requirements | Looked at it |
