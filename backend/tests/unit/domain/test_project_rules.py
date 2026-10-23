import pytest

from app.domain.errors import MethodologyLocked, ValidationFailed
from app.domain.project import Member, MemberPatch, Project, ProjectChanges, apply_update, diff_team, validate_project
from tests.fakes import project


def _fields(error: ValidationFailed) -> dict[str, str]:
    return {e.field: e.message for e in error.errors}


def test_valid_project_is_normalized():
    result = validate_project(
        project(name="  Agile   Planner ", members=[Member(name=" Ana  Gómez ", role=" Backend ", skills=[" python", "Python", "", "fastapi "])])
    )
    assert result.name == "Agile Planner"
    member = result.members[0]
    assert (member.name, member.role, member.skills) == ("Ana Gómez", "Backend", ["python", "fastapi"])


def test_member_defaults():
    member = validate_project(project(members=[Member(name="Ana", role="Backend")])).members[0]
    assert (member.seniority, member.hours_per_week, member.skills) == ("mid", 20, [])


def test_every_failing_field_is_reported():
    bad = Project(
        name="  ",
        description="",
        duration_weeks=0,
        members=[
            Member(name="Ana", role="Backend", hours_per_week=61),
            Member(name="ana ", role="", skills=["x" * 41]),
        ],
    )
    with pytest.raises(ValidationFailed) as info:
        validate_project(bad)
    assert _fields(info.value) == {
        "name": "Required.",
        "description": "Required.",
        "duration_weeks": "Must be between 1 and 52.",
        "members[0].hours_per_week": "Must be between 1 and 60.",
        "members[1].name": "Duplicated name.",
        "members[1].role": "Required.",
        "members[1].skills[0]": "Max 40 characters.",
    }


def test_team_needs_a_member_and_limits_lengths():
    with pytest.raises(ValidationFailed) as info:
        validate_project(Project(name="x" * 121, description="d" * 5001, members=[]))
    assert _fields(info.value) == {
        "name": "Max 120 characters.",
        "description": "Max 5000 characters.",
        "members": "The team needs at least one member.",
    }


def _saved(**overrides) -> Project:
    p = project(**overrides)
    return p.model_copy(update={"id": 1, "members": [m.model_copy(update={"id": i}) for i, m in enumerate(p.members, start=10)]})


def test_partial_update_keeps_the_rest():
    edited, diff = apply_update(_saved(), ProjectChanges(values={"auto_approve": True}))
    assert edited.auto_approve and edited.name == "Agile Planner" and len(edited.members) == 2
    assert diff.empty


def test_add_edit_and_remove_members_in_one_change():
    changes = ProjectChanges(
        members=[MemberPatch(10, {"hours_per_week": 25}), MemberPatch(None, {"name": "Sofía Paz", "role": "QA"})]
    )
    edited, diff = apply_update(_saved(), changes)
    assert [m.name for m in edited.members] == ["Ana Gómez", "Sofía Paz"]
    assert edited.members[0].hours_per_week == 25 and edited.members[0].seniority == "senior"
    assert diff.joined == ["Sofía Paz"] and diff.left == ["Leo Ruiz"] and diff.left_ids == [11]
    assert [(c.member_id, c.fields) for c in diff.changed] == [(10, ["hours_per_week"])]


def test_empty_team_unknown_member_and_empty_body_fail():
    with pytest.raises(ValidationFailed) as info:
        apply_update(_saved(), ProjectChanges(members=[]))
    assert _fields(info.value) == {"members": "The team needs at least one member."}

    with pytest.raises(ValidationFailed) as info:
        apply_update(_saved(), ProjectChanges(members=[MemberPatch(99, {"name": "X"})]))
    assert _fields(info.value)["members[0].id"] == "Unknown member."

    with pytest.raises(ValidationFailed) as info:
        apply_update(_saved(), ProjectChanges())
    assert _fields(info.value) == {"": "No fields to update."}


def test_null_on_a_required_field_fails():
    with pytest.raises(ValidationFailed) as info:
        apply_update(_saved(), ProjectChanges(values={"name": None}))
    assert _fields(info.value) == {"name": "Required."}


def test_methodology_locked_once_planning_started():
    apply_update(_saved(), ProjectChanges(values={"requested_methodology": "kanban"}))  # draft: fine
    with pytest.raises(MethodologyLocked):
        apply_update(_saved(status="planning"), ProjectChanges(values={"requested_methodology": "kanban"}))
    # the same methodology isn't a change
    apply_update(_saved(status="ready"), ProjectChanges(values={"requested_methodology": "auto"}))


def test_diff_team_ignores_project_fields():
    p = _saved()
    assert diff_team(p.members, p.members).empty
