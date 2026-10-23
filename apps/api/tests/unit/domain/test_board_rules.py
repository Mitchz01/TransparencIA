"""Board rules: reorder, WIP warnings, sprint load and PATCH validation (spec 003, US2–US4);
new task keys and validation (spec 014)."""

from app.adapters.outbound.agents.mock.data import MOCK_PLAN
from app.domain.board import (
    OverloadWarning,
    Task,
    WipWarning,
    is_continuous,
    new_task_errors,
    next_task_key,
    reorder,
    sprint_capacity,
    sprint_load,
    task_change_errors,
    wip_limits,
    wip_warnings,
)
from app.domain.capacity import member_capacity, team_capacity
from app.domain.errors import FieldError
from app.domain.plan import WipLimit
from app.domain.project import Member
from tests.fakes import project


def _task(id: int, status="todo", position=0, sprint_id: int | None = 1, points=1) -> Task:
    return Task(id=id, project_id=1, sprint_id=sprint_id, key=f"US-{id}", title="t", status=status, position=position, points=points)


def _positions(tasks: list[Task]) -> dict[int, tuple[int | None, str, int]]:
    return {t.id: (t.sprint_id, t.status, t.position) for t in tasks}  # type: ignore[misc]


# ---------- reorder ----------


def test_reorder_within_a_column_moves_the_third_to_the_top():
    tasks = [_task(1, position=0), _task(2, position=1), _task(3, position=2)]
    changed = reorder(tasks, 3, "todo", 0, 1)
    assert _positions(changed) == {3: (1, "todo", 0), 1: (1, "todo", 1), 2: (1, "todo", 2)}


def test_reorder_to_another_column_compacts_both():
    tasks = [_task(1, position=0), _task(2, position=1), _task(3, position=2), _task(4, "in_progress", 0)]
    changed = reorder(tasks, 2, "in_progress", 0, 1)
    assert _positions(changed) == {2: (1, "in_progress", 0), 4: (1, "in_progress", 1), 3: (1, "todo", 1)}


def test_reorder_without_position_appends_and_clamps_big_positions():
    tasks = [_task(1), _task(2, "in_progress", 0)]
    assert _positions(reorder(tasks, 1, "in_progress", None, 1)) == {1: (1, "in_progress", 1)}
    assert _positions(reorder(tasks, 1, "in_progress", 99, 1)) == {1: (1, "in_progress", 1)}


def test_reorder_to_the_same_place_changes_nothing():
    tasks = [_task(1, position=0), _task(2, position=1)]
    assert reorder(tasks, 2, "todo", 1, 1) == []


def test_columns_are_per_sprint_unless_continuous():
    tasks = [_task(1, sprint_id=1), _task(2, sprint_id=2), _task(3, "done", sprint_id=2)]
    # Sprint 2's "todo" column is separate from sprint 1's: task 2 stays at 0
    assert _positions(reorder(tasks, 3, "todo", 0, 2)) == {3: (2, "todo", 0), 2: (2, "todo", 1)}
    # On a continuous board the "todo" column holds both (and their positions get compacted)
    changed = reorder(tasks, 3, "todo", None, 2, continuous=True)
    assert _positions(changed) == {2: (2, "todo", 1), 3: (2, "todo", 2)}


def test_moving_to_another_sprint():
    tasks = [_task(1, sprint_id=1), _task(2, sprint_id=1, position=1), _task(3, sprint_id=2)]
    changed = reorder(tasks, 1, "todo", None, 2)
    assert _positions(changed) == {1: (2, "todo", 1), 2: (1, "todo", 0)}


# ---------- WIP warnings ----------


def test_wip_warnings_only_for_columns_over_the_limit():
    tasks = [_task(i, "in_progress") for i in range(1, 5)] + [_task(5, "review")]
    limits = [WipLimit(column="in_progress", limit=3), WipLimit(column="review", limit=2)]
    assert wip_warnings(tasks, limits) == [WipWarning(column="in_progress", limit=3, count=4)]
    assert wip_warnings(tasks[:3], limits) == []
    assert WipWarning(column="in_progress", limit=3, count=4).model_dump() == {
        "code": "wip_limit_exceeded", "column": "in_progress", "limit": 3, "count": 4
    }
    assert OverloadWarning(sprint_id=5, points=21, capacity=18).model_dump()["code"] == "sprint_overloaded"


# ---------- Sprint load and capacity ----------


def test_capacity_rule_from_hours_and_seniority():
    senior = Member(name="Ana", role="Backend", seniority="senior", hours_per_week=30)
    mid = Member(name="Leo", role="Frontend", seniority="mid", hours_per_week=20)
    junior = Member(name="Sol", role="QA", seniority="junior", hours_per_week=10)
    assert [member_capacity(m, 2) for m in (senior, mid, junior)] == [15, 6, 2]
    assert team_capacity([senior, mid, junior], 2) == 23


def test_sprint_load_uses_the_capacity_rule_or_the_override():
    p = project(plan={"methodology": MOCK_PLAN["methodology"]})  # 2-week sprints
    assert sprint_capacity(p) == 15 + 6
    assert sprint_capacity(p.model_copy(update={"sprint_capacity_override": 30})) == 30
    tasks = [_task(1, points=13), _task(2, points=8), _task(3, points=5, sprint_id=2)]
    assert sprint_load(1, tasks, 21).model_dump() == {"points": 21, "capacity": 21, "overloaded": False}
    assert sprint_load(1, tasks, 20).overloaded


def test_continuous_and_wip_limits_come_from_the_approved_methodology():
    scrumban = project(plan={"methodology": MOCK_PLAN["methodology"]})
    kanban = project(plan={"methodology": {**MOCK_PLAN["methodology"], "methodology": "kanban"}})
    assert not is_continuous(scrumban) and is_continuous(kanban)
    assert is_continuous(project(requested_methodology="kanban"))  # before the plan has one
    assert [(w.column, w.limit) for w in wip_limits(scrumban)] == [("in_progress", 3), ("review", 2)]
    assert wip_limits(project()) == []


# ---------- PATCH validation ----------


def test_task_change_errors_lists_every_failing_field():
    values = {"position": -1, "points": 101, "title": "  ", "sprint_id": 9, "assignee_id": 9, "description": None}
    assert task_change_errors(values, {1}, {1}) == [
        FieldError("description", "Required."),
        FieldError("position", "Must be 0 or more."),
        FieldError("points", "Must be between 0 and 100."),
        FieldError("title", "Required."),
        FieldError("sprint_id", "Unknown sprint in this project."),
        FieldError("assignee_id", "Unknown member in this project."),
    ]
    assert task_change_errors({}, set(), set()) == [FieldError("", "No fields to update.")]
    assert task_change_errors({"title": "x" * 201}, set(), set()) == [FieldError("title", "Max 200 characters.")]
    assert task_change_errors({"sprint_id": None, "assignee_id": None, "points": 0}, set(), set()) == []


# ---------- New tasks (spec 014) ----------


def test_next_key_follows_the_highest_activity_number():
    tasks = [Task(project_id=1, key=f"A-{n}", title="t") for n in (1, 12, 3)]
    assert next_task_key(tasks) == "A-13"
    others = [Task(project_id=1, key="BUG-40", title="t"), Task(project_id=1, key="US-99", title="t")]
    assert next_task_key([*tasks, *others]) == "A-13"  # other key shapes are ignored (spec 019)
    assert next_task_key(others) == next_task_key([]) == "A-1"


def test_new_task_needs_a_title_and_follows_the_edit_rules():
    assert new_task_errors({}, set(), set()) == [FieldError("title", "Required.")]
    assert new_task_errors({"points": 101, "epic_key": "E" * 21}, set(), set()) == [
        FieldError("title", "Required."),
        FieldError("points", "Must be between 0 and 100."),
        FieldError("epic_key", "Max 20 characters."),
    ]
    assert new_task_errors({"title": "  ", "sprint_id": 9}, {1}, set()) == [
        FieldError("title", "Required."),
        FieldError("sprint_id", "Unknown sprint in this project."),
    ]
    assert new_task_errors({"title": "Fix checkout copy", "sprint_id": 1, "epic_key": "E2"}, {1}, set()) == []
