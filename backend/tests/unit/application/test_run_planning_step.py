"""RunPlanningStep: one stage → one pending proposal; validation retry; failures (spec 002, US1-US3, US5)."""

import asyncio

from app.adapters.outbound.agents.mock.data import MOCK_PLAN
from app.domain.plan import PLANNING_STAGES
from tests.unit.application.planning_fixtures import ScriptedAgents, pipeline

STAGE_KEYS = [stage.key for stage in PLANNING_STAGES]


def _run(p, key: str, feedback=None) -> None:
    asyncio.run(p.run_step.execute(p.project.id, key, feedback))


def test_saves_a_pending_proposal_and_publishes_progress():
    p = pipeline()
    _run(p, "analysis")

    [proposal] = p.proposals()
    assert (proposal.kind, proposal.key, proposal.agent, proposal.status) == ("plan_stage", "analysis", "Product analyst", "pending")
    assert proposal.content == MOCK_PLAN["analysis"]
    assert proposal.rationale == MOCK_PLAN["analysis"]["rationale"]
    assert [e.type for e in p.bus.events] == ["agent_started", "agent_finished", "proposal_created"]
    started, finished, created = p.bus.events
    assert (started.agent, started.title) == ("analysis", "Product analyst")
    assert finished.output == MOCK_PLAN["analysis"]
    assert (created.proposal_id, created.key, created.agent) == (proposal.id, "analysis", "Product analyst")
    assert p.stored_project().status == "planning"  # no auto-approve: it waits for the leader


def test_context_only_has_the_stage_inputs_with_final_content():
    p = pipeline()
    adjusted = {**MOCK_PLAN["analysis"], "summary": "Adjusted by the leader"}
    p.seed("analysis", "adjusted", adjusted_content=adjusted)
    p.seed("methodology", "pending")  # pending and rejected proposals never reach the agents
    p.seed("architecture", "rejected", rejection_reason="No")
    _run(p, "methodology")

    context = p.agents.context("methodology")
    assert set(context) == {"project", "analysis"}
    assert context["analysis"]["summary"] == "Adjusted by the leader"


def test_agents_only_see_project_inputs():
    p = pipeline()
    _run(p, "analysis")

    seen = p.agents.context("analysis")["project"]
    assert set(seen) == {"name", "description", "duration_weeks", "requested_methodology", "members"}
    assert seen["members"][0] == {"name": "Ana Gómez", "role": "Backend", "seniority": "senior", "hours_per_week": 30, "skills": []}


def test_sprints_receive_the_team_capacity():
    p = pipeline()
    for key in STAGE_KEYS[:-1]:
        p.seed(key, "approved")
    _run(p, "sprints")

    capacity = p.agents.context("sprints")["capacity"]
    # Ana: 30 h x 2 weeks / 4 h per point (senior) = 15; Leo: 20 x 2 / 6 (mid) = 6
    assert capacity == {
        "sprint_length_weeks": 2,
        "points_per_sprint": 21,
        "members": [{"name": "Ana Gómez", "points_per_sprint": 15}, {"name": "Leo Ruiz", "points_per_sprint": 6}],
    }
    sprints = p.proposals("sprints")[0].content
    assert {a["member_name"] for a in sprints["assignments"]} <= {"Ana Gómez", "Leo Ruiz"}


def test_auto_approve_runs_the_six_stages_back_to_back():
    p = pipeline(auto_approve=True)
    _run(p, "analysis")

    proposals = p.proposals()
    assert [pr.key for pr in proposals] == STAGE_KEYS
    assert all(pr.status == "approved" and pr.auto_approved and pr.rationale for pr in proposals)
    assert set(p.stored_project().plan) == set(STAGE_KEYS)
    assert p.agents.stages() == STAGE_KEYS
    assert p.bus.of_type("plan_completed")[0].project_id == p.project.id
    assert p.completed == [p.project.id]


def test_feedback_reaches_the_agent():
    p = pipeline()
    _run(p, "analysis", {"reason": "Too vague", "rejected_content": MOCK_PLAN["analysis"]})
    assert p.agents.context("analysis")["feedback"]["reason"] == "Too vague"


# ---------- Validation retry (US2, US3, edge case "wrong format") ----------


def test_an_output_that_breaks_a_rule_is_retried_once_with_the_issues():
    agents = ScriptedAgents({"methodology": [MOCK_PLAN["methodology"]]})  # scrumban, but the leader chose kanban
    p = pipeline(agents, requested_methodology="kanban")
    p.seed("analysis")
    _run(p, "methodology")

    assert p.agents.stages() == ["methodology", "methodology"]
    feedback = p.agents.context("methodology")["feedback"]
    assert "'kanban'" in feedback["reason"] and feedback["rejected_content"]["methodology"] == "scrumban"
    [proposal] = p.proposals("methodology")
    assert proposal.content["methodology"] == "kanban"


def test_an_invalid_schema_is_retried_once():
    agents = ScriptedAgents({"analysis": [{"summary": "missing everything else"}]})
    p = pipeline(agents)
    _run(p, "analysis")
    assert p.agents.stages() == ["analysis", "analysis"]
    assert p.proposals("analysis")[0].status == "pending"


# ---------- Failures (US5) ----------


def test_two_failures_leave_the_project_in_error():
    agents = ScriptedAgents({"backlog": [RuntimeError("503 from the model"), RuntimeError("timeout")]})
    p = pipeline(agents)
    _run(p, "backlog")

    assert p.stored_project().status == "error"
    assert p.proposals("backlog") == []
    [failed] = p.bus.of_type("plan_failed")
    assert failed.agent == "backlog"
    assert "503" not in failed.error and "Product owner" in failed.error  # safe to show


def test_a_rule_broken_twice_fails_with_the_issues():
    bad = {**MOCK_PLAN["methodology"], "alternatives": []}
    p = pipeline(ScriptedAgents({"methodology": [bad, bad]}))
    p.seed("analysis")
    _run(p, "methodology")

    assert p.stored_project().status == "error"
    assert "at least two discarded alternatives" in p.bus.of_type("plan_failed")[0].error
