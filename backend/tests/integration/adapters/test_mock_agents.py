"""The mock agents fit the sample plan to the context, so the demo passes the stage rules
with any team (spec 002, FR-015 and SC-006)."""

import asyncio

from app.adapters.outbound.agents.mock.agents import MockPlanningAgents
from app.adapters.outbound.agents.mock.data import MOCK_PLAN
from app.domain.plan import stage_by_key, validate_stage_output

AGENTS = MockPlanningAgents(delay_seconds=0)


def _run(key: str, context: dict) -> dict:
    output = asyncio.run(AGENTS.run_stage(stage_by_key(key), context)).model_dump(mode="json")
    assert validate_stage_output(key, output, context) == []
    return output


def test_methodology_respects_the_leader():
    output = _run("methodology", {"project": {"requested_methodology": "kanban"}, "analysis": MOCK_PLAN["analysis"]})
    assert output["methodology"] == "kanban"
    assert "kanban" not in [a["methodology"] for a in output["alternatives"]]


def test_sprints_fit_a_small_team():
    members = [{"name": "Sol", "role": "Frontend", "seniority": "junior", "hours_per_week": 10}]
    context = {
        "project": {"requested_methodology": "auto", "members": members},
        "methodology": MOCK_PLAN["methodology"],
        "roadmap": MOCK_PLAN["roadmap"],
        "backlog": MOCK_PLAN["backlog"],
        "capacity": {"sprint_length_weeks": 2, "points_per_sprint": 5, "members": []},
    }
    output = _run("sprints", context)
    assert len(output["sprints"]) > 3
    frontend = {s["key"] for s in MOCK_PLAN["backlog"]["stories"] if s["role"] == "Frontend"}
    assert {a["story_key"] for a in output["assignments"]} == frontend
    assert {a["member_name"] for a in output["assignments"]} == {"Sol"}


def test_backlog_only_uses_roadmap_epics():
    roadmap = {**MOCK_PLAN["roadmap"], "phases": MOCK_PLAN["roadmap"]["phases"][:1]}
    output = _run("backlog", {"roadmap": roadmap})
    assert {s["epic_key"] for s in output["stories"]} == {"EP-1", "EP-2"}
