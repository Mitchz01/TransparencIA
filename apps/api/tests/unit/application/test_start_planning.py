"""StartPlanning: start, resume after an error, one run per project (spec 002, US1 and US5)."""

import asyncio

import pytest

from app.application.use_cases.planning.start_planning import StartPlanning
from app.domain.errors import PlanningAlreadyRunning, PlanningNotStartable, ProjectNotFound
from tests.unit.application.planning_fixtures import ScriptedAgents, pipeline


def _start(p, project_id: int | None = None):
    with p.uow.factory()() as uow:
        return StartPlanning(uow).execute(project_id or p.project.id)


def test_starts_a_draft_project_at_the_first_stage():
    p = pipeline(status="draft")
    run = _start(p)
    assert (run.project_id, run.stage, run.run, run.feedback) == (p.project.id, "analysis", True, None)
    assert p.stored_project().status == "planning"


@pytest.mark.parametrize(("status", "error"), [("planning", PlanningAlreadyRunning), ("ready", PlanningNotStartable)])
def test_only_from_draft_or_error(status, error):
    p = pipeline(status=status)
    with pytest.raises(error):
        _start(p)
    assert p.stored_project().status == status


def test_unknown_project():
    with pytest.raises(ProjectNotFound):
        _start(pipeline(), 999)


def test_a_stage_waiting_for_the_leader_isnt_run_again():
    p = pipeline(status="error")
    p.seed("analysis", "pending")
    run = _start(p)
    assert (run.stage, run.run) == ("analysis", False)


def test_a_failed_redo_resumes_with_the_rejection_reason():
    p = pipeline(status="error")
    p.seed("analysis")
    p.seed("methodology", "rejected", rejection_reason="Use Kanban")
    run = _start(p)
    assert (run.stage, run.feedback["reason"]) == ("methodology", "Use Kanban")


def test_retry_after_a_failure_only_reruns_the_failed_stage():
    agents = ScriptedAgents({"backlog": [RuntimeError("down"), RuntimeError("down")]})
    p = pipeline(agents, status="draft", auto_approve=True)
    run = _start(p)
    asyncio.run(p.run_step.execute(run.project_id, run.stage))

    assert p.stored_project().status == "error"
    assert p.agents.stages() == ["analysis", "methodology", "architecture", "roadmap", "backlog", "backlog"]

    run = _start(p)
    assert run.stage == "backlog"
    asyncio.run(p.run_step.execute(run.project_id, run.stage))

    # Analysis to roadmap aren't generated again (SC-005)
    assert p.agents.stages()[6:] == ["backlog", "sprints"]
    assert [pr.key for pr in p.proposals()] == ["analysis", "methodology", "architecture", "roadmap", "backlog", "sprints"]
    assert p.completed == [p.project.id]
