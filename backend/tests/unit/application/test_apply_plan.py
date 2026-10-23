import asyncio

import pytest

from app.adapters.outbound.agents.mock.data import MOCK_PLAN
from app.application.use_cases.planning.apply_plan import ApplyPlan
from app.domain.errors import ProjectNotFound, ValidationFailed
from tests.fakes import InMemoryUnitOfWork, RecordingEventBus, project


def _setup(plan=MOCK_PLAN):
    uow = InMemoryUnitOfWork()
    saved = uow.projects.add(project(status="planning", plan=plan))
    uow.commit()
    return uow, saved


def test_builds_the_board_sets_ready_and_publishes():
    uow, saved = _setup()
    bus = RecordingEventBus()
    asyncio.run(ApplyPlan(uow.factory(), bus).execute(saved.id))

    with uow:
        assert uow.projects.get(saved.id).status == "ready"
        sprints = uow.sprints.list_by_project(saved.id)
        tasks = uow.tasks.list_by_project(saved.id)
        objectives = uow.objectives.list_by_project(saved.id)
    assert [s.number for s in sprints] == [1, 2, 3]
    assert [(o.sprint_id, o.title, o.done) for o in objectives] == [(s.id, s.goal, False) for s in sprints]
    assert len(tasks) == len(MOCK_PLAN["backlog"]["stories"])
    sprint_1 = [t.key for t in tasks if t.sprint_id == sprints[0].id]
    assert sorted(sprint_1) == ["US-1", "US-2", "US-3", "US-4"]
    # The mock team has Backend and Frontend: those stories get an owner, DevOps doesn't
    us1 = next(t for t in tasks if t.key == "US-1")
    us2 = next(t for t in tasks if t.key == "US-2")
    assert (us1.assignee_id, us1.missing_role) == (None, "DevOps")
    assert us2.assignee_id == saved.members[0].id

    [event] = bus.events
    assert event.type == "plan_applied" and event.project_id == saved.id
    assert (event.sprints, event.tasks, event.skipped_story_keys) == (3, 11, [])


def test_running_it_twice_creates_nothing_new():
    uow, saved = _setup()
    bus = RecordingEventBus()
    asyncio.run(ApplyPlan(uow.factory(), bus).execute(saved.id))
    asyncio.run(ApplyPlan(uow.factory(), bus).execute(saved.id))

    with uow:
        assert len(uow.sprints.list_by_project(saved.id)) == 3
        assert len(uow.tasks.list_by_project(saved.id)) == 11
        assert len(uow.objectives.list_by_project(saved.id)) == 3
    assert len(bus.of_type("plan_applied")) == 1


def test_skipped_story_keys_are_reported():
    sprints = {**MOCK_PLAN["sprints"], "sprints": [{**MOCK_PLAN["sprints"]["sprints"][0], "story_keys": ["US-1", "US-99"]}]}
    uow, saved = _setup({**MOCK_PLAN, "sprints": sprints})
    bus = RecordingEventBus()
    asyncio.run(ApplyPlan(uow.factory(), bus).execute(saved.id))
    [event] = bus.events
    assert event.skipped_story_keys == ["US-99"] and "US-99" in event.summary


def test_unknown_project_or_incomplete_plan():
    uow, saved = _setup({"methodology": MOCK_PLAN["methodology"]})
    with pytest.raises(ProjectNotFound):
        asyncio.run(ApplyPlan(uow.factory(), RecordingEventBus()).execute(999))
    with pytest.raises(ValidationFailed):
        asyncio.run(ApplyPlan(uow.factory(), RecordingEventBus()).execute(saved.id))
    with uow:
        assert uow.sprints.list_by_project(saved.id) == []


# ---------- Follow-ups (spec 007: propose publishing the new board as issues) ----------


def test_follow_ups_run_once_after_a_new_board():
    uow, saved = _setup()
    calls: list[int] = []

    async def follow_up(project_id: int) -> None:
        with uow:
            calls.append((project_id, len(uow.tasks.list_by_project(project_id))))

    apply = ApplyPlan(uow.factory(), RecordingEventBus(), [follow_up])
    asyncio.run(apply.execute(saved.id))
    asyncio.run(apply.execute(saved.id))  # the board already exists: no follow-up
    assert calls == [(saved.id, len(MOCK_PLAN["backlog"]["stories"]))]


def test_with_a_repo_connected_the_new_board_is_proposed_as_issues():
    from app.application.use_cases.integrations.propose_issues import ProposePendingIssues

    for repository, expected in (("acme/app", 1), (None, 0)):
        uow = InMemoryUnitOfWork()
        saved = uow.projects.add(project(status="planning", plan=MOCK_PLAN, repository=repository))
        uow.commit()
        bus = RecordingEventBus()
        asyncio.run(ApplyPlan(uow.factory(), bus, [ProposePendingIssues(uow.factory(), bus)]).execute(saved.id))

        with uow:
            proposals = uow.proposals.list_by_project(saved.id)
            tasks = uow.tasks.list_by_project(saved.id)
        assert len(proposals) == expected
        if expected:
            [proposal] = proposals
            assert (proposal.kind, proposal.key, proposal.status) == ("github_action", "create_issues", "pending")
            assert [t["task_id"] for t in proposal.content["tasks"]] == [t.id for t in tasks]
            assert [e.type for e in bus.events] == ["plan_applied", "proposal_created"]
