import pytest

from app.domain.board import ChecklistItem, Task
from app.domain.errors import ValidationFailed
from app.domain.integrations import (
    RepoAccess,
    agent_comment,
    closing_refs,
    issue_body,
    issue_labels,
    pick_reviewers,
    review_comment,
    validate_github_username,
    validate_repository,
)
from app.domain.plan import CodeReview, ReviewFinding
from app.domain.project import Member
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


# ---------- GitHub usernames (US3) ----------


def test_validate_github_username():
    assert validate_github_username(" ana-gomez ") == "ana-gomez"
    assert validate_github_username("@ana") == "ana"
    assert validate_github_username("a" * 39) == "a" * 39
    assert validate_github_username(None) is None
    for bad in ("", "-ana", "ana-", "an--a", "ana_gomez", "ana gomez", "a" * 40):
        with pytest.raises(ValidationFailed) as info:
            validate_github_username(bad)
        assert info.value.errors[0].field == "github_username", bad


# ---------- Code review (US4) ----------


def test_closing_refs():
    body = "Closes #12, fixes #3 and RESOLVES #12.\nfixed: #7 · Resolved #8 · closed #9 · refs #4 · closes#5 · fixes #10a"
    assert closing_refs(body) == [12, 3, 7, 8, 9]
    assert closing_refs("Implements the login") == [] and closing_refs(None) == []


def _member(id: int, name: str, role: str, username: str | None) -> Member:
    return Member(id=id, name=name, role=role, github_username=username)


TEAM = [
    _member(1, "Ana", "Backend", "ana"),
    _member(2, "Bruno", "Backend", "bruno"),
    _member(3, "Carla", "Backend", "carla"),
    _member(4, "Leo", "Frontend", "leo"),
    _member(5, "Mia", "Backend", None),
]


def test_pick_reviewers_same_role_fewest_pending_never_the_author():
    [reviewer] = pick_reviewers(TEAM, author="ana", role="Backend", pending_reviews={2: 2, 3: 1})
    assert (reviewer.github_username, reviewer.member_id) == ("carla", 3)
    assert reviewer.reason == "Backend like the task, with the fewest pending reviews (1)."
    # The author is never suggested, whatever their load; the comparison ignores case.
    [reviewer] = pick_reviewers(TEAM, author="CARLA", role="backend", pending_reviews={1: 5, 2: 5})
    assert reviewer.github_username == "ana"


def test_pick_reviewers_falls_back_to_another_role_with_a_reason():
    team = [_member(1, "Ana", "Backend", "ana"), _member(4, "Leo", "Frontend", "leo"), _member(6, "Uma", "QA", "uma")]
    [reviewer] = pick_reviewers(team, author="ana", role="Backend", pending_reviews={4: 3})
    assert reviewer.github_username == "uma"
    assert reviewer.reason.startswith("Nobody else with the Backend role has a GitHub username")
    [reviewer] = pick_reviewers(team, author="ana", role=None, pending_reviews={})
    assert reviewer.github_username == "leo"  # tie: by name


def test_pick_reviewers_none_when_nobody_else_has_a_username():
    team = [_member(1, "Ana", "Backend", "ana"), _member(5, "Mia", "Backend", None)]
    assert pick_reviewers(team, author="ana", role="Backend", pending_reviews={}) == []


def test_review_comment_and_agent_mark():
    review = CodeReview(
        summary="Adds the login form.",
        findings=[ReviewFinding(criterion="Validates email", status="not_met", comment="No validation in the diff.")],
        risks=["No tests"],
        reviewed_fully=False,
        rationale="Add validation first.",
    )
    comment = review_comment(review)
    assert "| Validates email | Not met | No validation in the diff. |" in comment
    assert "**Risks**\n\n- No tests" in comment
    assert comment.endswith("_The PR was too big to review entirely: only part of the diff was reviewed._")
    assert "too big" not in review_comment(review.model_copy(update={"reviewed_fully": True}))
    marked = agent_comment(comment, 63)
    assert marked.startswith(comment) and marked.endswith("approved in proposal #63._")
    assert "code reviewer agent" in marked
