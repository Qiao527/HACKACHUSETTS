"""Validate data/policy_constants.json: every policy entry must cite its source.

Used by the `policy-source-guard` Kiro hook. Exit code 0 = OK (stdout goes to the
agent's context); non-zero = problems (stderr is sent back to the agent).
"""
import json
import re
import sys
from pathlib import Path

REQUIRED = ("value", "unit", "source_url", "source_title", "retrieved")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
PATH = Path(__file__).resolve().parent.parent / "data" / "policy_constants.json"


def iter_entries(node, path=""):
    """Yield (dotted_path, dict) for every leaf policy entry (a dict with 'value')."""
    if isinstance(node, dict):
        if "value" in node:
            yield path, node
            return
        for key, child in node.items():
            if key.startswith("_"):
                continue
            yield from iter_entries(child, f"{path}.{key}" if path else key)


def main() -> int:
    try:
        data = json.loads(PATH.read_text())
    except (OSError, json.JSONDecodeError) as exc:
        print(f"policy_constants.json could not be read: {exc}", file=sys.stderr)
        return 1

    problems = []
    count = 0
    for name, entry in iter_entries(data):
        count += 1
        missing = [k for k in REQUIRED if k not in entry]
        if missing:
            problems.append(f"{name}: missing {', '.join(missing)}")
        url = entry.get("source_url", "")
        if url and not str(url).startswith("https://"):
            problems.append(f"{name}: source_url must be an https URL")
        retrieved = entry.get("retrieved", "")
        if retrieved and not DATE_RE.match(str(retrieved)):
            problems.append(f"{name}: retrieved must be YYYY-MM-DD")
        if entry.get("value") is None and "TODO" not in str(entry.get("notes", "")):
            problems.append(f"{name}: value is null; add a TODO note explaining how it will be filled")

    if problems:
        print("Policy source check FAILED:\n- " + "\n- ".join(problems), file=sys.stderr)
        return 1
    print(f"Policy source check passed: {count} entries, all cited.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
