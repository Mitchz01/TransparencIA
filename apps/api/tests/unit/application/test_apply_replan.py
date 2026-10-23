"""Spec 008, US2: ApplyReplan writes an approved replan's changes in one transaction,
skips and reports the stale ones, and runs the follow-ups."""

import pytest

from app.domain.errors import ProposalNotFound
from tests.fakes import FakeTaskRepository
from tests.unit.application.replan_fixtures import planned, run

STORY = {
    "key": "US-20", "epic_key": "EP-5", "title": "Export to CSV", "description": "Export the board.",
    "acceptance_criteria": ["Downloads a CSV", "Has every task"], "type": "feature", "points": 3,
    "priority": "medium", "role": "Backend",
}


def move(key, to_sprint, expected="todo"):
    return {"kind": "move", "task_key": key, "to_sprint": to_sprint, "expected_status": expected, "rationale": f"Move {key}."}


def reassign(key, member, expected="todo"):
    return {"kind": "reassign", "task_key": key, "to_member": member, "expected_status": expected, "rationale": f"Give {key}."}


def discard(key, expected="todo"):
    return {"kind": "discard", "task_key": key, "expected_status": expected, "rationale": f"Drop {key}: out of scope."}


def add(story=STORY, to_sprint=3):
    return {"kind": "add", "new_story": story, "to_sprint": to_sprint, "rationale": "A new client asked for it."}


def test_six_changes_are_applied_together():
    setup = planned()
    ana = setup.project.members[0]
    sprint_ids = {s.number: s.id for s in setup.sprints()}
    proposal = setup.add_replan(
        [move("US-4", 2), move("US-9", None), reassign("US-1", "ana gómez"), add(), discard("US-11"), reassign("US-3", "Ana Gómez")]
    )

    outcome = run(setup.apply_replan.execute(proposal.id))

    tasks = setup.tasks()
    assert (tasks["US-4"].sprint_id, tasks["US-4"].status) == (sprint_ids[2], "todo")
    assert tasks["US-4"].position == max(t.position for t in tasks.values() if t.sprint_id == sprint_ids[2] and t.status == "todo")
    assert (tasks["US-9"].sprint_id, tasks["US-9"].status) == (None, "backlog")
    assert (tasks["US-1"].assignee_id, tasks["US-1"].missing_role) == (ana.id, None)
    assert tasks["US-3"].assignee_id == ana.id
    added = tasks["US-20"]
    assert (added.sprint_id, added.status, added.assignee_id, added.points) == (sprint_ids[3], "todo", ana.id, 3)
    assert [i.text for i in added.checklist] == ["Downloads a CSV", "Has every task"]
    assert "US-11" not in tasks

    assert outcome.applied == ["US-4", "US-9", "US-1", "US-20", "US-11", "US-3"]
    assert outcome.added_task_ids == [added.id]
    assert [(d.key, d.rationale) for d in outcome.discarded_tasks] == [("US-11", "Drop US-11: out of scope.")]
    [event] = setup.bus.of_type("replan_applied")
    assert (event.proposal_id, event.applied, event.discarded) == (proposal.id, outcome.applied, [])
    with setup.uow:
        assert setup.uow.proposals.get(proposal.id).result == {"applied": outcome.applied, "discarded": []}
    assert setup.outcomes == [outcome]  # follow-ups get the outcome


def test_an_adjusted_proposal_applies_its_final_content():
    setup = planned()
    leo = setup.project.members[1]
    changes = [reassign("US-2", "Leo Ruiz"), reassign("US-5", "Leo Ruiz")]
    proposal = setup.add_replan(changes, status="adjusted", adjusted_content={"changes": changes[1:], "rationale": "Only US-5.", "reason": "x"})

    outcome = run(setup.apply_replan.execute(proposal.id))

    assert outcome.applied == ["US-5"]
    tasks = setup.tasks()
    assert tasks["US-5"].assignee_id == leo.id and tasks["US-2"].assignee_id != leo.id


def test_stale_changes_are_discarded_and_reported_the_rest_applied():
    setup = planned()
    ana, leo = setup.project.members
    setup.update_task("US-2", status="in_progress")  # moved after the proposal
    setup.update_task("US-3", status="done")  # done tasks never change
    with setup.uow:
        sprint_1 = setup.uow.sprints.list_by_project(setup.pid)[0]
        setup.uow.sprints.save(sprint_1.model_copy(update={"closed": True}))
        setup.uow.commit()
    proposal = setup.add_replan(
        [
            move("US-2", 2),
            reassign("US-3", "Ana Gómez"),
            move("US-5", 1),  # sprint 1 closed meanwhile
            reassign("US-6", "Sofía"),  # not on the team (anymore)
            discard("US-7"),
            move("US-7", 3),  # discarded by the change before
            add({**STORY, "key": "US-8"}),  # the key exists
            reassign("US-9", "Ana Gómez"),
        ]
    )

    outcome = run(setup.apply_replan.execute(proposal.id))

    assert outcome.applied == ["US-7", "US-9"]
    assert [(d.task_key, d.reason) for d in outcome.discarded_changes] == [
        ("US-2", "task changed since the proposal"),
        ("US-3", "task changed since the proposal"),
        ("US-5", "sprint 1 doesn't exist or is closed"),
        ("US-6", "Sofía isn't on the team"),
        ("US-7", "task no longer on the board"),
        ("US-8", "a task with key US-8 already exists"),
    ]
    tasks = setup.tasks()
    assert tasks["US-2"].status == "in_progress" and tasks["US-3"].assignee_id == leo.id
    assert tasks["US-9"].assignee_id == ana.id and "US-7" not in tasks
    [event] = setup.bus.of_type("replan_applied")
    assert [d.task_key for d in event.discarded] == ["US-2", "US-3", "US-5", "US-6", "US-7", "US-8"]
    assert "6 discarded because the board changed" in event.summary


def test_if_one_change_fails_none_is_applied(monkeypatch):
    setup = planned()
    proposal = setup.add_replan([reassign("US-2", "Leo Ruiz"), discard("US-11")])
    before = setup.tasks()

    def broken(self, task_id):
        raise RuntimeError("disk full")

    monkeypatch.setattr(FakeTaskRepository, "delete", broken)
    with pytest.raises(RuntimeError):
        run(setup.apply_replan.execute(proposal.id))

    assert setup.tasks() == before
    assert setup.bus.events == [] and setup.outcomes == []


def test_a_failing_follow_up_doesnt_undo_the_replan():
    setup = planned()

    async def broken(outcome):
        raise RuntimeError("GitHub down")

    setup.apply_replan._follow_ups.insert(0, broken)
    proposal = setup.add_replan([reassign("US-2", "Leo Ruiz")])
    run(setup.apply_replan.execute(proposal.id))
    assert setup.tasks()["US-2"].assignee_id == setup.project.members[1].id
    assert len(setup.outcomes) == 1  # the next follow-up still ran


def test_unknown_proposal():
    with pytest.raises(ProposalNotFound):
        run(planned().apply_replan.execute(999))
