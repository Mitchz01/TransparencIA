"""AdvancePlanning (spec 005's plan_stage applier) and RetryStage (spec 002, US1 and US4)."""

import asyncio

import pytest

from app.adapters.outbound.agents.mock.data import MOCK_PLAN
from app.application.use_cases.planning.retry_stage import RetryStage
from app.domain.errors import ProjectNotFound, StageNotFound, StageNotRetryable
from app.domain.plan import PLANNING_STAGES
from tests.unit.application.planning_fixtures import pipeline

STAGE_KEYS = [stage.key for stage in PLANNING_STAGES]


def _resolved(p, proposal) -> None:
    asyncio.run(p.advance.on_proposal_resolved(proposal.id))


# ---------- Approved or adjusted (US1) ----------


def test_approved_stage_is_stored_and_the_next_one_runs():
    p = pipeline()
    approved = p.seed("analysis")
    _resolved(p, approved)

    assert p.stored_project().plan == {"analysis": MOCK_PLAN["analysis"]}
    assert p.agents.stages() == ["methodology"]
    assert p.proposals("methodology")[0].status == "pending"


def test_the_next_stage_uses_the_adjusted_version():
    p = pipeline()
    for key in ("analysis", "methodology"):
        p.seed(key)
    adjusted = {**MOCK_PLAN["architecture"], "style": "Serverless"}
    proposal = p.seed("architecture", "adjusted", adjusted_content=adjusted)
    _resolved(p, proposal)

    assert p.stored_project().plan["architecture"]["style"] == "Serverless"
    assert p.agents.context("roadmap")["architecture"]["style"] == "Serverless"


def test_last_stage_completes_the_plan_and_calls_the_handlers():
    p = pipeline()
    for key in STAGE_KEYS[:-1]:
        p.seed(key)
    _resolved(p, p.seed("sprints"))

    assert p.agents.calls == []
    [completed] = p.bus.of_type("plan_completed")
    assert completed.project_id == p.project.id
    assert p.completed == [p.project.id]
    assert set(p.stored_project().plan) == {"sprints"}  # only what this call stored; the others went through earlier calls


def test_nothing_happens_outside_planning():
    p = pipeline(status="ready")
    _resolved(p, p.seed("analysis"))
    assert p.agents.calls == [] and p.bus.events == [] and p.stored_project().plan is None


def test_other_kinds_are_ignored():
    p = pipeline()
    with p.uow:
        other = p.uow.proposals.add(p.seed("analysis").model_copy(update={"id": None, "kind": "document"}))
        p.uow.commit()
    _resolved(p, other)
    assert p.agents.calls == []


# ---------- Rejected (US4) ----------


def test_rejection_redoes_the_stage_with_the_reason():
    p = pipeline()
    for key in ("analysis", "methodology", "architecture"):
        p.seed(key)
    rejected = p.seed("roadmap", "rejected", rejection_reason="It's 4 weeks, not 8")
    _resolved(p, rejected)

    assert p.agents.stages() == ["roadmap"]
    assert p.agents.context("roadmap")["feedback"] == {"reason": "It's 4 weeks, not 8", "rejected_content": MOCK_PLAN["roadmap"]}
    old, new = p.proposals("roadmap")
    assert (old.status, old.rejection_reason) == ("rejected", "It's 4 weeks, not 8")
    assert new.status == "pending"
    assert "roadmap" not in (p.stored_project().plan or {})


def test_third_consecutive_rejection_waits_for_the_leader():
    p = pipeline()
    p.seed("roadmap", "rejected", rejection_reason="1")
    p.seed("roadmap", "rejected", rejection_reason="2")
    third = p.seed("roadmap", "rejected", rejection_reason="3")
    _resolved(p, third)

    assert p.agents.calls == []
    [waiting] = p.bus.of_type("stage_needs_leader")
    assert (waiting.stage, waiting.rejections) == ("roadmap", 3)


def test_an_approval_resets_the_count():
    p = pipeline()
    p.seed("roadmap", "rejected", rejection_reason="1")
    p.seed("roadmap", "rejected", rejection_reason="2")
    p.seed("roadmap", "approved")
    _resolved(p, p.seed("roadmap", "rejected", rejection_reason="again"))

    assert p.agents.stages() == ["roadmap"]
    assert p.bus.of_type("stage_needs_leader") == []


# ---------- RetryStage (US4) ----------


def _retry(p, key: str):
    with p.uow.factory()() as uow:
        return RetryStage(uow).execute(p.project.id, key)


def test_retry_a_capped_stage_with_the_last_reason():
    p = pipeline()
    for reason in ("1", "2", "3"):
        p.seed("roadmap", "rejected", rejection_reason=reason)
    run = _retry(p, "roadmap")
    assert (run.stage, run.run, run.feedback["reason"]) == ("roadmap", True, "3")


@pytest.mark.parametrize(
    "statuses",
    [[], ["pending"], ["approved"], ["rejected"], ["rejected", "rejected"]],
)
def test_only_a_capped_stage_can_be_retried(statuses):
    p = pipeline()
    for status in statuses:
        p.seed("roadmap", status, rejection_reason="No" if status == "rejected" else None)
    with pytest.raises(StageNotRetryable):
        _retry(p, "roadmap")


def test_retry_unknown_stage_or_project():
    p = pipeline()
    with pytest.raises(StageNotFound):
        _retry(p, "design")
    with p.uow.factory()() as uow, pytest.raises(ProjectNotFound):
        RetryStage(uow).execute(999, "roadmap")
