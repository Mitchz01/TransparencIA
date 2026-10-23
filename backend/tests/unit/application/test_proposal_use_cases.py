import asyncio

import pytest

from app.adapters.outbound.agents.mock.data import MOCK_PLAN
from app.application.use_cases.proposals.apply_proposal import ApplierRegistry, ApplyProposal, RetryApply
from app.application.use_cases.proposals.approve_many import ApproveProposals
from app.application.use_cases.proposals.auto_approve import AutoApprove
from app.application.use_cases.proposals.list_proposals import GetProposal, ListProposals
from app.application.use_cases.proposals.resolve_proposal import AdjustProposal, ApproveProposal, RejectProposal
from app.domain.errors import ProjectNotFound, ProposalAlreadyResolved, ProposalNotFound, ProposalNotRetryable, ValidationFailed
from app.domain.proposals import Proposal
from tests.fakes import InMemoryUnitOfWork, RecordingEventBus, project

run = asyncio.run


def _setup(auto_approve: bool = False):
    uow = InMemoryUnitOfWork()
    saved = uow.projects.add(project(auto_approve=auto_approve))
    uow.commit()
    return uow, saved.id


def _add(uow, project_id, key="methodology", **overrides) -> Proposal:
    data = {"project_id": project_id, "kind": "plan_stage", "key": key, "agent": "Agile coach", "content": MOCK_PLAN[key]}
    proposal = uow.proposals.add(Proposal(**{**data, **overrides}))
    uow.commit()
    return proposal


class Calls:
    def __init__(self, fail: bool = False):
        self.ids: list[int] = []
        self.fail = fail

    async def __call__(self, proposal_id: int) -> None:
        self.ids.append(proposal_id)
        if self.fail:
            raise RuntimeError("board failed")


# ---------- US1 ----------


def test_list_newest_first_and_filtered():
    uow, pid = _setup()
    first = _add(uow, pid, "analysis", status="approved")
    second = _add(uow, pid, "methodology")
    assert [p.id for p in ListProposals(uow).execute(pid)] == [second.id, first.id]
    assert [p.id for p in ListProposals(uow).execute(pid, "pending")] == [second.id]
    with pytest.raises(ProjectNotFound):
        ListProposals(uow).execute(99)
    with pytest.raises(ProposalNotFound):
        GetProposal(uow).execute(99)


# ---------- US2: decide ----------


def test_approve_saves_and_publishes():
    uow, pid = _setup()
    proposal = _add(uow, pid)
    bus = RecordingEventBus()
    result = run(ApproveProposal(uow, bus).execute(proposal.id))
    assert result.status == "approved" and result.resolved_at is not None
    [event] = bus.events
    assert (event.type, event.status, event.auto, event.actor) == ("proposal_resolved", "approved", False, "person")
    with pytest.raises(ProposalAlreadyResolved):
        run(ApproveProposal(uow, bus).execute(proposal.id))


def test_adjust_validates_against_the_schema():
    uow, pid = _setup()
    proposal = _add(uow, pid)
    bus = RecordingEventBus()
    with pytest.raises(ValidationFailed) as info:
        run(AdjustProposal(uow, bus).execute(proposal.id, {**MOCK_PLAN["methodology"], "methodology": "waterfall"}))
    assert info.value.errors[0].field == "content.methodology"
    assert uow.proposals.get(proposal.id).status == "pending" and bus.events == []

    edited = {**MOCK_PLAN["methodology"], "sprint_length_weeks": 1}
    result = run(AdjustProposal(uow, bus).execute(proposal.id, edited))
    assert result.status == "adjusted" and result.final_content["sprint_length_weeks"] == 1
    assert result.content == MOCK_PLAN["methodology"]  # the agent's version is kept


def test_simultaneous_decisions_second_one_loses():
    uow, pid = _setup()
    proposal = _add(uow, pid)
    late = InMemoryUnitOfWork(uow.store)
    late.__enter__()
    run(ApproveProposal(uow, RecordingEventBus()).execute(proposal.id))
    with pytest.raises(ProposalAlreadyResolved):
        late.proposals.save_if_status(late.proposals.get(proposal.id).model_copy(update={"status": "rejected"}), "pending")


# ---------- US2: apply ----------


def test_apply_calls_the_registered_step():
    uow, pid = _setup()
    proposal = _add(uow, pid, status="approved")
    registry = ApplierRegistry()
    plan_stage, review = Calls(), Calls()
    registry.register("plan_stage", plan_stage, on=("decided", "rejected"))
    registry.register("github_action", review, key="request_review")
    run(ApplyProposal(uow.factory(), RecordingEventBus(), registry).execute(proposal.id))
    assert plan_stage.ids == [proposal.id] and review.ids == []


def test_failed_apply_is_flagged_published_and_retryable():
    uow, pid = _setup()
    proposal = _add(uow, pid, status="approved")
    registry = ApplierRegistry()
    registry.register("plan_stage", Calls(fail=True))
    bus = RecordingEventBus()
    run(ApplyProposal(uow.factory(), bus, registry).execute(proposal.id))

    stored = InMemoryUnitOfWork(uow.store).proposals.get(proposal.id)
    assert stored.status == "approved" and stored.apply_failed and stored.apply_error == "board failed"
    assert [e.type for e in bus.events] == ["proposal_apply_failed"]

    assert RetryApply(uow.factory()).execute(proposal.id).id == proposal.id
    registry.register("plan_stage", Calls())
    run(ApplyProposal(uow.factory(), bus, registry).execute(proposal.id))
    assert not InMemoryUnitOfWork(uow.store).proposals.get(proposal.id).apply_failed
    with pytest.raises(ProposalNotRetryable):
        RetryApply(uow.factory()).execute(proposal.id)


def test_missing_applier_fails_decisions_but_not_rejections():
    uow, pid = _setup()
    approved = _add(uow, pid, status="approved")
    rejected = _add(uow, pid, "roadmap", status="rejected", rejection_reason="No")
    bus = RecordingEventBus()
    run(ApplyProposal(uow.factory(), bus, ApplierRegistry()).execute(approved.id))
    run(ApplyProposal(uow.factory(), bus, ApplierRegistry()).execute(rejected.id))
    store = InMemoryUnitOfWork(uow.store)
    assert store.proposals.get(approved.id).apply_failed
    assert not store.proposals.get(rejected.id).apply_failed


# ---------- US4 ----------


def test_reject_with_reason_and_capped_adjust():
    uow, pid = _setup()
    bus = RecordingEventBus()
    with pytest.raises(ValidationFailed):
        run(RejectProposal(uow, bus).execute(_add(uow, pid, "roadmap").id, " "))

    for _ in range(2):
        run(RejectProposal(uow, bus).execute(uow.proposals.list_by_project(pid)[0].id, "Too long"))
        _add(uow, pid, "roadmap")
    last = uow.proposals.list_by_project(pid)[0]
    with pytest.raises(ProposalAlreadyResolved):
        # only 2 rejections so far: a rejected proposal can't be adjusted yet
        run(AdjustProposal(uow, bus).execute(uow.proposals.list_by_project(pid)[1].id, MOCK_PLAN["roadmap"]))
    run(RejectProposal(uow, bus).execute(last.id, "Still too long"))
    assert bus.events[-1].reason == "Still too long"

    result = run(AdjustProposal(uow, bus).execute(last.id, MOCK_PLAN["roadmap"]))
    assert result.status == "adjusted"


# ---------- US5 ----------


def test_auto_approve_rule():
    uow, pid = _setup(auto_approve=True)
    registry = ApplierRegistry()
    calls = Calls()
    registry.register("plan_stage", calls)
    registry.register("replan", calls)
    bus = RecordingEventBus()
    apply = ApplyProposal(uow.factory(), bus, registry)
    auto = AutoApprove(uow.factory(), bus, apply)

    stage = _add(uow, pid, "analysis")
    assert run(auto.after_created(stage.id))
    stored = InMemoryUnitOfWork(uow.store).proposals.get(stage.id)
    assert stored.status == "approved" and stored.auto_approved and calls.ids == [stage.id]
    assert bus.events[0].auto and bus.events[0].actor == "system"

    drift = _add(uow, pid, "analysis", kind="replan", origin="automatic")
    assert not run(auto.after_created(drift.id))
    assert InMemoryUnitOfWork(uow.store).proposals.get(drift.id).status == "pending"


def test_auto_approve_off_does_nothing():
    uow, pid = _setup(auto_approve=False)
    bus = RecordingEventBus()
    auto = AutoApprove(uow.factory(), bus, ApplyProposal(uow.factory(), bus, ApplierRegistry()))
    assert not run(auto.after_created(_add(uow, pid).id)) and bus.events == []


# ---------- US7 ----------


def test_bulk_approve_each_on_its_own():
    uow, pid = _setup()
    other_uow_pid = uow.projects.add(project(name="Other"))
    uow.commit()
    a, b = _add(uow, pid, "analysis"), _add(uow, pid, "architecture")
    done = _add(uow, pid, "roadmap", status="approved")
    foreign = _add(uow, other_uow_pid.id, "backlog")
    results = run(ApproveProposals(uow.factory(), RecordingEventBus()).execute(pid, [a.id, b.id, done.id, foreign.id]))
    assert [(r.id, r.ok) for r in results] == [(a.id, True), (b.id, True), (done.id, False), (foreign.id, False)]
    assert results[2].error["code"] == "proposal_already_resolved"
    assert results[3].error["code"] == "proposal_not_found"
    with pytest.raises(ValidationFailed):
        run(ApproveProposals(uow.factory(), RecordingEventBus()).execute(pid, []))
