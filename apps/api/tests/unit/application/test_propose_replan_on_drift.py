"""Spec 008, US4: closing a sprint with pending work, or a relevant team change, proposes
an automatic replan that always waits for the leader."""

import pytest

from app.application.use_cases.board.close_sprint import CloseSprint
from app.application.use_cases.planning.propose_replan_on_drift import ProposeReplanOnDrift, team_drift_reason
from app.domain.errors import SprintAlreadyClosed, SprintNotFound
from app.domain.events import MemberChangeInfo, TeamChanged
from tests.unit.application.replan_fixtures import planned, run


async def _ignore(event) -> None:
    pass


def _close(setup, number: int, handlers=()):
    sprint = next(s for s in setup.sprints() if s.number == number)
    with setup.uow:
        return run(CloseSprint(setup.uow, setup.bus, handlers).execute(sprint.id)), sprint


def _team(joined=(), left=(), changed=()):
    return TeamChanged(project_id=1, joined=list(joined), left=list(left), changed=list(changed))


# ---------- CloseSprint ----------


def test_closing_a_sprint_reports_its_pending_tasks_and_calls_the_handlers():
    setup = planned()
    setup.update_task("US-2", status="done")
    received = []

    async def handler(event):
        received.append(event)

    result, sprint = _close(setup, 1, [handler])

    assert result.sprint.closed and result.sprint.id == sprint.id
    assert result.pending_task_keys == ["US-1", "US-3", "US-4"]
    assert result.replan_proposed is True
    assert next(s for s in setup.sprints() if s.number == 1).closed
    [event] = setup.bus.of_type("sprint_closed")
    assert (event.sprint_id, event.pending_task_keys) == (sprint.id, ["US-1", "US-3", "US-4"])
    assert "3 unfinished task(s): US-1, US-3, US-4" in event.summary
    assert [e.sprint_id for e in received] == [sprint.id]


def test_closing_a_finished_sprint_proposes_nothing():
    setup = planned()
    for key in ("US-10", "US-11"):
        setup.update_task(key, status="done")
    result, _ = _close(setup, 3, [_ignore])
    assert (result.pending_task_keys, result.replan_proposed) == ([], False)


def test_unknown_or_already_closed_sprint():
    setup = planned()
    with setup.uow, pytest.raises(SprintNotFound):
        run(CloseSprint(setup.uow, setup.bus).execute(999))
    _close(setup, 1)
    with pytest.raises(SprintAlreadyClosed):
        _close(setup, 1)


# ---------- ProposeReplanOnDrift ----------


def test_a_sprint_closed_with_pending_tasks_proposes_an_automatic_replan_naming_them():
    setup = planned(auto_approve=True)
    drift = ProposeReplanOnDrift(setup.uow.factory(), setup.replan)
    setup.update_task("US-2", status="done")
    _, sprint = _close(setup, 1)
    [event] = setup.bus.of_type("sprint_closed")

    proposal = run(drift.on_sprint_closed(event))

    assert proposal.content["reason"] == "Sprint 1 was closed with 3 unfinished task(s): US-1, US-3, US-4."
    [stored] = setup.replans()
    assert (stored.status, stored.origin, stored.auto_approved) == ("pending", "automatic", False)  # FR-016
    # The mock agent moves the closed sprint's pending tasks to the next open sprint
    moved = {c["task_key"] for c in stored.content["changes"] if c["kind"] == "move"}
    assert moved == {"US-1", "US-3", "US-4"}


def test_a_finished_sprint_proposes_nothing():
    setup = planned()
    drift = ProposeReplanOnDrift(setup.uow.factory(), setup.replan)
    for key in ("US-10", "US-11"):
        setup.update_task(key, status="done")
    _close(setup, 3)
    assert run(drift.on_sprint_closed(setup.bus.of_type("sprint_closed")[0])) is None
    assert setup.replans() == []


@pytest.mark.parametrize(
    ("event", "reason"),
    [
        (_team(joined=["Sofía"]), "The team changed: Sofía joined."),
        (_team(left=["Leo Ruiz"]), "The team changed: Leo Ruiz left."),
        (_team(changed=[MemberChangeInfo(member_id=1, name="Ana", fields=["role"])]), "The team changed: Ana changed (role)."),
        (
            _team(changed=[MemberChangeInfo(member_id=1, name="Ana", fields=["name", "seniority", "hours_per_week", "skills"])]),
            "The team changed: Ana changed (seniority, hours per week).",
        ),
    ],
)
def test_relevant_team_changes_propose_an_automatic_replan(event, reason):
    setup = planned(auto_approve=True)
    drift = ProposeReplanOnDrift(setup.uow.factory(), setup.replan)
    proposal = run(drift.on_team_changed(event.model_copy(update={"project_id": setup.pid})))
    assert proposal.content["reason"] == reason
    [stored] = setup.replans()
    assert (stored.status, stored.origin) == ("pending", "automatic")


def test_renames_and_skills_dont_propose_anything():
    setup = planned()
    drift = ProposeReplanOnDrift(setup.uow.factory(), setup.replan)
    event = _team(changed=[MemberChangeInfo(member_id=1, name="Ana", fields=["name", "skills"])])
    assert team_drift_reason(event) is None
    assert run(drift.on_team_changed(event.model_copy(update={"project_id": setup.pid}))) is None
    assert setup.replans() == [] and setup.agents.calls == []


def test_without_an_applied_plan_there_is_nothing_to_replan():
    setup = planned()
    with setup.uow:
        setup.uow.projects.save(setup.stored_project().model_copy(update={"status": "planning"}))
        setup.uow.commit()
    drift = ProposeReplanOnDrift(setup.uow.factory(), setup.replan)
    assert run(drift.on_team_changed(_team(left=["Leo Ruiz"]).model_copy(update={"project_id": setup.pid}))) is None
    assert setup.replans() == []


def test_a_long_list_of_pending_tasks_is_cut_to_the_reason_limit():
    setup = planned()
    drift = ProposeReplanOnDrift(setup.uow.factory(), setup.replan)
    _, sprint = _close(setup, 1)
    event = setup.bus.of_type("sprint_closed")[0].model_copy(update={"pending_task_keys": [f"US-{i}" for i in range(400)]})
    proposal = run(drift.on_sprint_closed(event))
    assert len(proposal.content["reason"]) == 1000 and proposal.content["reason"].endswith("…")


