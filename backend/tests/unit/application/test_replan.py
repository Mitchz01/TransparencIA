"""Spec 008, US2: Replan builds the context, runs the agent with one retry, supersedes the
pending replan and creates a `replan` proposal that only leader replans auto-approve."""

import pytest

from app.domain.errors import PlanNotApplied, ProjectNotFound, ValidationFailed
from tests.unit.application.planning_fixtures import ScriptedAgents
from tests.unit.application.replan_fixtures import planned, run


def test_context_has_plan_team_board_velocity_and_reason():
    setup = planned()
    leo = setup.project.members[1]
    setup.update_task("US-2", status="done")
    with setup.uow:
        sprint_1 = setup.uow.sprints.list_by_project(setup.pid)[0]
        setup.uow.sprints.save(sprint_1.model_copy(update={"closed": True}))
        setup.uow.commit()

    proposal = run(setup.replan.request(setup.pid, "  Leo leaves next week.  "))

    context = setup.agents.context("replan")
    assert context["reason"] == "Leo leaves next week."
    assert [m["name"] for m in context["project"]["members"]] == ["Ana Gómez", "Leo Ruiz"]
    assert set(context["plan"]) == {"methodology", "roadmap"}
    sprints = context["board"]["sprints"]
    assert [(s["number"], s["closed"]) for s in sprints] == [(1, True), (2, False), (3, False)]
    us2 = next(t for t in context["board"]["tasks"] if t["key"] == "US-2")
    assert (us2["status"], us2["sprint"], us2["assignee"], us2["points"]) == ("done", 1, "Ana Gómez", 3)
    us3 = next(t for t in context["board"]["tasks"] if t["key"] == "US-3")
    assert us3["assignee"] == leo.name
    assert context["velocity"]["done_points_per_closed_sprint"] == [3]
    assert context["velocity"]["average"] == 3.0 and context["velocity"]["points_per_sprint"] > 0

    assert (proposal.kind, proposal.key, proposal.status, proposal.origin) == ("replan", "replan", "pending", "leader")
    assert proposal.content["reason"] == "Leo leaves next week."
    assert proposal.content["changes"] and proposal.rationale == proposal.content["rationale"]
    assert [e.type for e in setup.bus.events] == ["agent_started", "agent_finished", "proposal_created"]


def test_invalid_output_is_retried_once_with_the_issues_as_feedback():
    touches_done = {"changes": [{"kind": "discard", "task_key": "US-2", "expected_status": "done", "rationale": "x"}], "rationale": "r"}
    setup = planned(ScriptedAgents({"replan": [touches_done]}))
    setup.update_task("US-2", status="done")

    proposal = run(setup.replan.request(setup.pid, "We're behind."))

    assert setup.agents.stages() == ["replan", "replan"]
    feedback = setup.agents.context("replan", 1)["feedback"]
    assert "US-2 is done" in feedback["reason"] and feedback["rejected_content"]["changes"][0]["task_key"] == "US-2"
    assert proposal is not None and all(c["task_key"] != "US-2" for c in proposal.content["changes"])


def test_two_failures_publish_replan_failed_and_leave_no_proposal():
    setup = planned(ScriptedAgents({"replan": [RuntimeError("down"), {"changes": "nope"}]}))
    assert run(setup.replan.request(setup.pid, "We're behind.")) is None
    assert setup.replans() == []
    failed = setup.bus.of_type("replan_failed")
    assert failed and "didn't return a valid result" in failed[0].error
    assert setup.stored_project().status == "ready"  # the board and the project are untouched


def test_a_new_request_supersedes_the_pending_replan_with_both_reasons():
    setup = planned()
    first = run(setup.replan.request(setup.pid, "Leo left."))

    prepared = setup.replan.prepare(setup.pid, "A new client came in.")
    assert (prepared.supersedes, prepared.reason) == (first.id, "Leo left.\nA new client came in.")
    second = run(setup.replan.execute(prepared))

    old, new = setup.replans()
    assert (old.id, old.status) == (first.id, "discarded")
    assert (new.id, new.status, new.content["reason"]) == (second.id, "pending", "Leo left.\nA new client came in.")
    assert setup.agents.context("replan", 1)["reason"] == "Leo left.\nA new client came in."
    resolved = setup.bus.of_type("proposal_resolved")
    assert [(e.proposal_id, e.status, e.actor) for e in resolved] == [(first.id, "discarded", "system")]
    # Only one pending replan per project (FR-014)
    assert [p.status for p in setup.replans()].count("pending") == 1


def test_leader_replans_follow_auto_approve():
    setup = planned(auto_approve=True)
    proposal = run(setup.replan.request(setup.pid, "Leo left."))
    [stored] = setup.replans()
    assert (stored.id, stored.status, stored.auto_approved) == (proposal.id, "approved", True)
    assert setup.outcomes and setup.outcomes[0].proposal_id == proposal.id  # ApplyReplan ran


def test_automatic_replans_never_auto_approve():
    setup = planned(auto_approve=True)
    run(setup.replan.request(setup.pid, "Sprint 1 closed with pending work.", origin="automatic"))
    [stored] = setup.replans()
    assert (stored.status, stored.origin) == ("pending", "automatic")
    assert setup.outcomes == []


def test_prepare_checks_project_reason_and_applied_plan():
    setup = planned()
    with pytest.raises(ProjectNotFound):
        setup.replan.prepare(999, "x")
    for reason in ("", "   ", "x" * 1001):
        with pytest.raises(ValidationFailed) as error:
            setup.replan.prepare(setup.pid, reason)
        assert error.value.errors[0].field == "reason"
    with setup.uow:
        setup.uow.projects.save(setup.stored_project().model_copy(update={"status": "planning"}))
        setup.uow.commit()
    with pytest.raises(PlanNotApplied):
        setup.replan.prepare(setup.pid, "Leo left.")
