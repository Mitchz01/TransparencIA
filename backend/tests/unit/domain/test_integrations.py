import pytest

from app.domain.board import ChecklistItem, Task
from app.domain.errors import ValidationFailed
from app.domain.integrations import RepoAccess, issue_body, issue_labels, validate_repository
from app.domain.proposal_schemas import validate_content


def _task(**fields) -> Task:
    data = {"project_id": 1, "key": "US-4", "title": "Load members"}
    return Task(**{**data, **fields})


# ---------- Repository (US1) ----------


def test_validate_repository():
    assert validate_repository(" acme/agile-app ") == "acme/agile-app"
    assert validate_repository("a-b/c.d_e") == "a-b/c.d_e"
    for bad in ("acme", "acme/", "/app", "acme/app/x", "ac me/app", "acme/a pp", "a" * 40 + "/app"):
        with pytest.raises(ValidationFailed):
            validate_repository(bad)


def test_repo_access_problem():
    full = RepoAccess(status="ok", can_write=True, can_admin=True)
    assert full.problem(needs_webhook=True) is None
    write_only = RepoAccess(status="ok", can_write=True)
    assert write_only.problem(needs_webhook=True) == "missing_permissions"
    assert write_only.problem(needs_webhook=False) is None
    assert RepoAccess(status="not_found").problem(needs_webhook=False) == "not_found"


# ---------- Issues (US2) ----------


def test_issue_body_has_description_criteria_and_checklist_as_task_list():
    task = _task(
        description="As a leader I want to load the team.",
        acceptance_criteria=["Works on mobile", "Validates hours"],
        checklist=[ChecklistItem(text="Works on mobile", done=True), ChecklistItem(text="Validates hours")],
    )
    body = issue_body(task)
    assert body.startswith("As a leader I want to load the team.\n\n## Acceptance criteria\n\n- Works on mobile\n- Validates hours")
    assert "## Checklist\n\n- [x] Works on mobile\n- [ ] Validates hours" in body
    assert body.endswith("_Managed by Agile Planner (task US-4): edit the task on the board, changes made here are overwritten._")


def test_issue_body_leaves_empty_sections_out():
    body = issue_body(_task())
    assert "Acceptance criteria" not in body and "Checklist" not in body
    assert body.startswith("---\n")


def test_issue_labels():
    assert issue_labels(_task()) == ["type:feature", "priority:medium"]
    assert issue_labels(_task(type="bug", priority="high")) == ["type:bug", "priority:high"]


def test_create_issues_content_schema():
    content = {"repository": "acme/app", "tasks": [{"task_id": 1, "key": "US-1", "title": "Login"}]}
    assert validate_content("github_action", "create_issues", content) == content
    with pytest.raises(ValidationFailed) as info:
        validate_content("github_action", "create_issues", {"repository": "acme/app", "tasks": []})
    assert info.value.errors[0].field == "content.tasks"
