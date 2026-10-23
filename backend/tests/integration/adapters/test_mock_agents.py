"""The mock agents fit the sample plan to the context, so the demo passes the stage rules
with any team (spec 002, FR-015 and SC-006)."""

import asyncio

from app.adapters.outbound.agents.mock.agents import MockPlanningAgents
from app.adapters.outbound.agents.mock.data import MOCK_PLAN
from app.domain.diagrams import check_mermaid
from app.domain.plan import document_stage, stage_by_key, validate_stage_output

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


# ---------- Writer (spec 006): documents about any project, never the sample's ----------

OTHER_ROADMAP = {
    "phases": [
        {
            "name": "Launch",
            "goal": "Sell online",
            "start_week": 1,
            "end_week": 4,
            "deliverables": ["Shop"],
            "epics": [
                {"key": "EP-7", "title": "Checkout (cards)", "description": "Pay with \"cards\""},
                {"key": "EP-8", "title": "Catalog", "description": "Browse products"},
            ],
        }
    ],
    "rationale": "x",
}


def _document(key: str, context: dict) -> dict:
    return asyncio.run(AGENTS.run_stage(document_stage(key), context)).model_dump(mode="json")


def test_general_spec_describes_the_project():
    context = {
        "project": {"name": "Bakery shop", "description": "Sell bread online."},
        "analysis": MOCK_PLAN["analysis"],
        "architecture": MOCK_PLAN["architecture"],
        "roadmap": OTHER_ROADMAP,
        "backlog": {"stories": [], "rationale": "x"},
    }
    output = _document("general_spec", context)
    assert output["title"] == "General spec: Bakery shop"
    assert "## User Scenarios & Testing" in output["markdown"] and "Checkout (cards)" in output["markdown"]


def test_epic_spec_names_the_stories_of_its_epic():
    epic = OTHER_ROADMAP["phases"][0]["epics"][0]
    story = {**MOCK_PLAN["backlog"]["stories"][0], "key": "US-40", "epic_key": "EP-7", "title": "Pay with a card"}
    output = _document("epic_spec", {"project": {"name": "Bakery shop"}, "epic": epic, "stories": [story]})
    assert output["epic_key"] == "EP-7"
    assert "US-40 Pay with a card" in output["markdown"] and "**Given**" in output["markdown"]


def test_diagrams_render_with_any_names():
    output = _document("flow_diagrams", {"architecture": MOCK_PLAN["architecture"], "roadmap": OTHER_ROADMAP})
    assert [d["kind"] for d in output["diagrams"]] == ["architecture", "flow"]
    assert all(check_mermaid(d["mermaid"]) == [] for d in output["diagrams"])


def test_regenerating_takes_the_instructions_in():
    epic = OTHER_ROADMAP["phases"][0]["epics"][1]
    output = _document("epic_spec", {"epic": epic, "stories": [], "feedback": {"reason": "Add the payments flow"}})
    assert "Add the payments flow" in output["markdown"]
