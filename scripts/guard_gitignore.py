"""PreToolUse guard: block any agent write that would add `.kiro` to .gitignore.

Hackathon rule: the /.kiro directory must be committed. Kiro passes the tool call
as JSON on STDIN (fields include tool_name and tool_input). Exit code 2 blocks the
tool call and sends stderr back to the agent; exit 0 lets it proceed.
"""
import json
import re
import sys

KIRO_PATTERN = re.compile(r"^\s*/?\.kiro(/.*)?\s*$", re.MULTILINE)


def main() -> int:
    try:
        event = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        return 0  # nothing to inspect; never block on malformed input

    tool_input = event.get("tool_input") or {}
    blob = json.dumps(tool_input)
    if ".gitignore" not in blob:
        return 0

    # Look at every string value in the tool input for a .kiro ignore line.
    def strings(node):
        if isinstance(node, str):
            yield node
        elif isinstance(node, dict):
            for v in node.values():
                yield from strings(v)
        elif isinstance(node, list):
            for v in node:
                yield from strings(v)

    for text in strings(tool_input):
        if KIRO_PATTERN.search(text):
            print(
                "Blocked: hackathon rules require the /.kiro directory to be committed. "
                "Do not add .kiro (or any sub-folder) to .gitignore.",
                file=sys.stderr,
            )
            return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
