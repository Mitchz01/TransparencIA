"""Structural check of a Mermaid diagram before it's proposed or saved (spec 006, FR-006).

It isn't a Mermaid parser: it catches what usually breaks rendering in the tool and on GitHub
(an unknown diagram type, an empty body, unbalanced brackets or quotes) and refuses HTML,
which GitHub strips and the frontend must never render. Each issue is a sentence the agent
gets back as feedback on its retry, or the leader sees on a manual edit."""

import re

# The diagram types the tool and GitHub render the same way.
ALLOWED_TYPES = ("flowchart", "graph", "sequenceDiagram", "stateDiagram-v2", "erDiagram")

_PAIRS = {")": "(", "]": "[", "}": "{"}
_HTML_TAG = re.compile(r"<\s*/?\s*[a-zA-Z][^>]*>")
_QUOTED = re.compile(r'"[^"\n]*"')
# erDiagram cardinalities (||--o{, }o..|{) use braces that aren't brackets.
_ER_CARDINALITY = re.compile(r"[|}o]{2}(?:--|\.\.)[|{o]{2}")


def _lines(source: str) -> list[tuple[int, str]]:
    """Non-empty lines without Mermaid comments (%%), with their line number in the source."""
    stripped = ((number, line.strip()) for number, line in enumerate(source.splitlines(), 1))
    return [(number, line) for number, line in stripped if line and not line.startswith("%%")]


def _bracket_issues(lines: list[tuple[int, str]]) -> list[str]:
    """Across the whole body: an erDiagram entity opens its brace on one line and closes it later."""
    stack: list[tuple[str, int]] = []
    for number, line in lines:
        for char in line:
            if char in "([{":
                stack.append((char, number))
            elif char in _PAIRS:
                if not stack or stack[-1][0] != _PAIRS[char]:
                    return [f"Line {number} has an unmatched '{char}'."]
                stack.pop()
    return [f"Line {stack[-1][1]} doesn't close its '{stack[-1][0]}'."] if stack else []


def check_mermaid(source: str) -> list[str]:
    """The issues that would keep the diagram from rendering; empty = valid."""
    lines = _lines(source)
    if not lines:
        return ["The diagram is empty."]
    issues: list[str] = []
    header = lines[0][1].split()[0]
    if header not in ALLOWED_TYPES:
        issues.append(f"The first line must be one of {', '.join(ALLOWED_TYPES)}; it's '{header}'.")
    if len(lines) < 2:
        issues.append("The diagram has no body after its type.")
    if _HTML_TAG.search(source):
        issues.append("HTML tags (like <script> or <br>) aren't allowed: use plain text.")

    body: list[tuple[int, str]] = []
    for number, line in lines[1:]:
        if line.count('"') % 2:
            issues.append(f"Line {number} has an unclosed quote.")
            continue
        plain = _QUOTED.sub('""', line)  # brackets inside a quoted label don't count
        if header == "erDiagram":
            plain = _ER_CARDINALITY.sub("--", plain)
        body.append((number, plain))
    issues.extend(_bracket_issues(body))
    return issues
