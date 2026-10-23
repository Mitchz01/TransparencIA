"""check_mermaid: a diagram that wouldn't render is never proposed nor saved (spec 006, FR-006)."""

import pytest

from app.domain.diagrams import check_mermaid


@pytest.mark.parametrize(
    "source",
    [
        'flowchart TD\n    A["Sign up (email)"] --> B{"Valid?"}\n    B -->|yes| C["Done"]',
        "graph LR\n    A --> B",
        "sequenceDiagram\n    participant U as User\n    U->>API: POST /login\n    API-->>U: 200",
        "stateDiagram-v2\n    [*] --> Draft\n    Draft --> Ready\n    Ready --> [*]",
        "erDiagram\n    PROJECT ||--o{ TASK : has\n    TASK }o--|| MEMBER : assigned\n    PROJECT {\n        string name\n    }",
        "%% a comment first\n\nflowchart TD\n    A --> B",
    ],
)
def test_diagrams_that_render(source: str):
    assert check_mermaid(source) == []


def test_empty():
    assert check_mermaid("  \n%% only a comment\n") == ["The diagram is empty."]


def test_unknown_type():
    [issue] = check_mermaid("pie\n    \"A\" : 1")
    assert "first line must be one of" in issue and "'pie'" in issue


def test_type_without_body():
    assert check_mermaid("flowchart TD") == ["The diagram has no body after its type."]


@pytest.mark.parametrize(
    ("source", "expected"),
    [
        ('flowchart TD\n    A["Open] --> B', "Line 2 has an unclosed quote."),
        ("flowchart TD\n    A[Open --> B", "Line 2 doesn't close its '['."),
        ("flowchart TD\n    A --> B)", "Line 2 has an unmatched ')'."),
        ("flowchart TD\n    A(Open] --> B", "Line 2 has an unmatched ']'."),
    ],
)
def test_unbalanced_brackets_and_quotes(source: str, expected: str):
    assert check_mermaid(source) == [expected]


def test_brackets_inside_a_quoted_label_do_not_count():
    assert check_mermaid('flowchart TD\n    A["Pay (card"] --> B') == []


@pytest.mark.parametrize("tag", ["<script>alert(1)</script>", "<br>", "<b>bold</b>", '<img src="x">'])
def test_no_html(tag: str):
    issues = check_mermaid(f'flowchart TD\n    A["Open {tag}"] --> B')
    assert any("HTML tags" in issue for issue in issues)


def test_arrows_are_not_html():
    assert check_mermaid("flowchart LR\n    A <--> B\n    B --> C") == []
