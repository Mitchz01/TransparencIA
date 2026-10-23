"""Stage lookups and the consistency rules of each stage output (spec 002, FR-008 to FR-010)."""

import pytest

from app.adapters.outbound.agents.mock.data import MOCK_PLAN
from app.domain.errors import StageNotFound
from app.domain.plan import PLANNING_STAGES, first_pending_stage, next_stage, stage_by_key, validate_stage_output

MEMBERS = [{"name": "Ana", "role": "Backend"}, {"name": "Leo", "role": "Frontend"}]


def _project(methodology: str = "auto") -> dict:
    return {"name": "Demo", "requested_methodology": methodology, "members": MEMBERS}


def _story(key: str, points: int = 3, epic: str = "EP-1") -> dict:
    return {**MOCK_PLAN["backlog"]["stories"][0], "key": key, "points": points, "epic_key": epic}


def _sprints_context(*stories: dict, capacity: int = 10, methodology: str = "scrum") -> dict:
    return {
        "project": _project(),
        "methodology": {**MOCK_PLAN["methodology"], "methodology": methodology},
        "roadmap": MOCK_PLAN["roadmap"],
        "backlog": {"stories": list(stories), "rationale": ""},
        "capacity": {"sprint_length_weeks": 2, "points_per_sprint": capacity, "members": []},
    }


def _sprints(*sprints: list[str], assignments: dict[str, str] | None = None) -> dict:
    return {
        "sprints": [
            {"number": i, "name": f"Sprint {i}", "goal": "Goal", "phase": "MVP", "story_keys": keys}
            for i, keys in enumerate(sprints, 1)
        ],
        "assignments": [{"story_key": k, "member_name": n} for k, n in (assignments or {}).items()],
        "rationale": "Fits.",
    }


# ---------- Stage lookups ----------


def test_stage_lookups_follow_the_fixed_order():
    assert stage_by_key("roadmap").title == "Product manager"
    assert next_stage("analysis").key == "methodology"
    assert next_stage("sprints") is None
    with pytest.raises(StageNotFound) as error:
        stage_by_key("design")
    assert error.value.code == "stage_not_found"


def test_first_pending_stage_skips_approved_ones():
    assert first_pending_stage([]).key == "analysis"
    assert first_pending_stage(["analysis", "methodology", "architecture", "roadmap"]).key == "backlog"
    assert first_pending_stage([s.key for s in PLANNING_STAGES]) is None


def test_every_stage_output_has_a_rationale():
    for stage in PLANNING_STAGES:
        assert "rationale" in stage.schema.model_fields, stage.key
        assert MOCK_PLAN[stage.key]["rationale"]


# ---------- Methodology (US2) ----------


def test_requested_methodology_must_be_respected():
    kanban = {**MOCK_PLAN["methodology"], "methodology": "kanban"}
    assert validate_stage_output("methodology", kanban, {"project": _project("kanban")}) == []
    [issue] = validate_stage_output("methodology", MOCK_PLAN["methodology"], {"project": _project("kanban")})
    assert "'kanban'" in issue


def test_auto_needs_two_discarded_alternatives():
    assert validate_stage_output("methodology", MOCK_PLAN["methodology"], {"project": _project()}) == []
    one = {**MOCK_PLAN["methodology"], "alternatives": MOCK_PLAN["methodology"]["alternatives"][:1]}
    assert validate_stage_output("methodology", one, {"project": _project()}) == [
        "List at least two discarded alternatives, each with why_not."
    ]


# ---------- Backlog and sprints (US3) ----------


def test_mock_backlog_is_consistent_with_the_mock_roadmap():
    assert validate_stage_output("backlog", MOCK_PLAN["backlog"], {"roadmap": MOCK_PLAN["roadmap"]}) == []


def test_backlog_stories_belong_to_existing_epics_and_have_unique_keys():
    backlog = {"stories": [_story("US-1"), _story("US-1"), _story("US-2", epic="EP-9")], "rationale": ""}
    issues = validate_stage_output("backlog", backlog, {"roadmap": MOCK_PLAN["roadmap"]})
    assert issues == [
        "Story key US-1 is repeated: keys must be unique.",
        "Story US-2 belongs to epic EP-9, which isn't in the roadmap.",
    ]


def test_valid_sprints_have_no_issues():
    context = _sprints_context(_story("US-1"), _story("US-2"), _story("US-3"))
    output = _sprints(["US-1", "US-2"], ["US-3"], assignments={"US-1": "Ana", "US-3": "Leo"})
    assert validate_stage_output("sprints", output, context) == []


def test_each_story_in_exactly_one_iteration():
    context = _sprints_context(_story("US-1"), _story("US-2"), _story("US-3"))
    issues = validate_stage_output("sprints", _sprints(["US-1", "US-9"], ["US-1"]), context)
    assert issues == [
        "Iteration 1 has story US-9, which isn't in the backlog.",
        "Story US-1 is in 2 iterations: it must be in exactly one.",
        "Story US-2 isn't in any iteration.",
        "Story US-3 isn't in any iteration.",
    ]


def test_assignments_refer_to_real_members_and_stories():
    context = _sprints_context(_story("US-1"))
    issues = validate_stage_output("sprints", _sprints(["US-1"], assignments={"US-1": "Nobody", "US-7": "Ana"}), context)
    assert issues == [
        "Nobody isn't on the team: use a member's exact name.",
        "The assignment of US-7 refers to a story that isn't in the backlog.",
    ]


def test_no_iteration_over_capacity():
    context = _sprints_context(_story("US-1", 5), _story("US-2", 8), _story("US-3", 13), capacity=10)
    issues = validate_stage_output("sprints", _sprints(["US-1", "US-2"], ["US-3"]), context)
    # A single story bigger than the capacity can't be split: it's allowed alone.
    assert issues == ["Iteration 1 has 13 points, over the team's capacity of 10."]


def test_kanban_has_no_sprint_capacity():
    context = _sprints_context(_story("US-1", 8), _story("US-2", 8), capacity=5, methodology="kanban")
    assert validate_stage_output("sprints", _sprints(["US-1", "US-2"]), context) == []


def test_stages_without_rules_are_always_valid():
    assert validate_stage_output("analysis", MOCK_PLAN["analysis"], {}) == []
