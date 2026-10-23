"""Spec 008, US2: the replan's consistency rules against the board it was made for."""

from app.domain.plan import Replan, validate_replan, validate_stage_output

CONTEXT = {
    "project": {"members": [{"name": "Ana Gómez", "role": "Backend"}, {"name": "Leo Ruiz", "role": "Frontend"}]},
    "board": {
        "sprints": [{"number": 1, "closed": True}, {"number": 2, "closed": False}, {"number": 3, "closed": False}],
        "tasks": [
            {"key": "US-1", "status": "done", "sprint": 1},
            {"key": "US-2", "status": "todo", "sprint": 1},
            {"key": "US-3", "status": "in_progress", "sprint": 2},
            {"key": "US-4", "status": "backlog", "sprint": None},
        ],
    },
}
STORY = {
    "key": "US-20", "epic_key": "EP-1", "title": "Export", "description": "CSV export", "acceptance_criteria": ["Has a CSV"],
    "type": "feature", "points": 3, "priority": "medium", "role": "Backend",
}


def issues(*changes: dict) -> list[str]:
    output = Replan.model_validate({"changes": list(changes), "rationale": "Because."}).model_dump(mode="json")
    return validate_replan(output, CONTEXT)


def test_a_consistent_replan_has_no_issues():
    assert issues(
        {"kind": "move", "task_key": "US-2", "to_sprint": 2, "expected_status": "todo", "rationale": "Late."},
        {"kind": "move", "task_key": "US-3", "to_sprint": None, "expected_status": "in_progress", "rationale": "Later."},
        {"kind": "reassign", "task_key": "US-3", "to_member": "  leo ruiz ", "expected_status": "in_progress", "rationale": "Free."},
        {"kind": "add", "new_story": STORY, "to_sprint": 3, "rationale": "New client."},
        {"kind": "discard", "task_key": "US-4", "expected_status": "backlog", "rationale": "Out of scope."},
    ) == []


def test_rejects_changes_to_done_tasks():
    [issue] = issues({"kind": "reassign", "task_key": "US-1", "to_member": "Ana Gómez", "expected_status": "done", "rationale": "x"})
    assert "US-1 is done" in issue


def test_rejects_unknown_task_keys():
    [issue] = issues({"kind": "discard", "task_key": "US-99", "expected_status": "todo", "rationale": "x"})
    assert "US-99 isn't a task on the board" in issue


def test_rejects_unknown_members():
    [issue] = issues({"kind": "reassign", "task_key": "US-2", "to_member": "Sofía", "expected_status": "todo", "rationale": "x"})
    assert "Sofía isn't on the team" in issue


def test_rejects_unknown_or_closed_sprints():
    found = issues(
        {"kind": "move", "task_key": "US-2", "to_sprint": 1, "expected_status": "todo", "rationale": "x"},
        {"kind": "add", "new_story": STORY, "to_sprint": 9, "rationale": "x"},
    )
    assert len(found) == 2
    assert "sprint 1 doesn't exist or is closed" in found[0] and "sprint 9" in found[1]


def test_expected_status_must_be_the_current_one():
    [issue] = issues({"kind": "move", "task_key": "US-2", "to_sprint": 2, "expected_status": "review", "rationale": "x"})
    assert "current status, 'todo'" in issue


def test_added_stories_need_a_story_and_a_new_key():
    found = issues(
        {"kind": "add", "to_sprint": 2, "rationale": "x"},
        {"kind": "add", "new_story": {**STORY, "key": "US-2"}, "to_sprint": 2, "rationale": "x"},
    )
    assert "needs new_story" in found[0] and "US-2 is already used" in found[1]


def test_it_is_the_replan_stage_rule():
    output = Replan.model_validate(
        {"changes": [{"kind": "discard", "task_key": "US-1", "expected_status": "done", "rationale": "x"}], "rationale": "r"}
    ).model_dump(mode="json")
    assert validate_stage_output("replan", output, CONTEXT)
