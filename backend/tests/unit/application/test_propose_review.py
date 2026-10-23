import asyncio
from typing import Any

import pytest
from pydantic import BaseModel

from app.adapters.outbound.agents.mock.data import MOCK_CODE_REVIEW
from app.application.use_cases.integrations.apply_review import ApplyReview
from app.application.use_cases.integrations.propose_review import MAX_DIFF_CHARS, ProposeReview
from app.application.use_cases.proposals.apply_proposal import ApplierRegistry, ApplyProposal
from app.application.use_cases.proposals.auto_approve import AutoApprove
from app.domain.board import Task
from app.domain.errors import RepositoryNotConnected
from app.domain.integrations import ExternalLink
from app.domain.plan import PlanningStage
from app.domain.project import Member
from tests.fakes import CodeHosts, InMemoryUnitOfWork, RecordingEventBus, project

run = asyncio.run
REPO = "acme/app"


class ReviewerAgent:
    """PlanningAgents double: records the context and returns the sample review."""

    def __init__(self) -> None:
        self.calls: list[tuple[str, dict[str, Any]]] = []

    async def run_stage(self, stage: PlanningStage, context: dict[str, Any]) -> BaseModel:
        self.calls.append((stage.key, context))
        return stage.schema.model_validate(MOCK_CODE_REVIEW)


def _setup(**fields):
    uow = InMemoryUnitOfWork()
    team = [
        Member(name="Ana", role="Backend", github_username="ana"),
        Member(name="Bruno", role="Backend", github_username="bruno"),
        Member(name="Carla", role="Backend", github_username="carla"),
        Member(name="Leo", role="Frontend", github_username="leo"),
    ]
    saved = uow.projects.add(project(repository=REPO, github_token="ghp", members=team, **fields))
    task = uow.tasks.add(
        Task(project_id=saved.id, key="US-4", title="Load members", acceptance_criteria=["Works on mobile"], assignee_id=saved.members[0].id)
    )
    uow.links.add(ExternalLink(project_id=saved.id, task_id=task.id, kind="issue", repository=REPO, number=12, url="u12"))
    uow.commit()
    return uow, saved, task, RecordingEventBus(), CodeHosts(), ReviewerAgent()


def _propose(uow, bus, hosts, agent, body="Closes #12", author="ana", after_created=None):
    return run(ProposeReview(uow.factory(), bus, agent, hosts, after_created).execute(REPO, 30, author, body))


def _approve(uow, proposal_id, content=None):
    with uow.factory()() as unit:
        proposal = unit.proposals.get(proposal_id)
        proposal.adjust(content) if content is not None else proposal.approve()
        unit.proposals.save(proposal)
        unit.commit()


# ---------- ProposeReview ----------


def test_pr_without_project_issues_proposes_nothing():
    uow, _, _, bus, hosts, agent = _setup()
    assert _propose(uow, bus, hosts, agent, body="Implements the login, refs #12") is None
    assert _propose(uow, bus, hosts, agent, body="Closes #99") is None  # not a project issue
    assert run(ProposeReview(uow.factory(), bus, agent, hosts).execute("acme/unknown", 30, "ana", "Closes #12")) is None
    assert agent.calls == [] and hosts.host.calls == [] and bus.events == []


def test_proposal_with_reviewers_and_the_agent_comment():
    uow, saved, task, bus, hosts, agent = _setup()
    hosts.host.diffs[30] = "diff --git a/members.py b/members.py\n+def load(): ...\n"
    proposal = _propose(uow, bus, hosts, agent, body="This closes #12.")

    assert (proposal.kind, proposal.key, proposal.agent, proposal.status) == ("github_action", "request_review", "Code reviewer", "pending")
    content = proposal.content
    assert (content["repository"], content["pr_number"], content["author"], content["task_ids"]) == (REPO, 30, "ana", [task.id])
    assert content["pr_url"] == f"https://github.com/{REPO}/pull/30"
    # Ana (Backend) opened it: a Backend reviewer, never her; ties go by name.
    assert [r["github_username"] for r in content["reviewers"]] == ["bruno"]
    assert content["reviewers"][0]["reason"].startswith("Backend like the task")
    assert "| Has basic tests | Met |" in content["comment"]
    assert content["review"]["reviewed_fully"] is True
    assert "@bruno" in proposal.rationale

    [(stage, context)] = agent.calls
    assert stage == "code_review" and context["diff"] == hosts.host.diffs[30]
    assert context["task"] == [{"key": "US-4", "title": "Load members", "description": "", "acceptance_criteria": ["Works on mobile"], "type": "feature"}]
    assert hosts.tokens == ["ghp"]
    uow.rollback()
    [pr_link] = uow.links.list_by_project(saved.id, "pull_request")
    assert (pr_link.task_id, pr_link.number, pr_link.state) == (task.id, 30, "open")
    [event] = bus.events
    assert (event.type, event.key, event.proposal_id) == ("proposal_created", "request_review", proposal.id)
    assert event.summary == "Proposed a review of PR #30 (US-4) by @ana"


def test_reviewers_with_the_fewest_pending_reviews():
    uow, _, _, bus, hosts, agent = _setup()
    first = _propose(uow, bus, hosts, agent)
    _approve(uow, first.id)  # Bruno now has one pending review (PR #30 still open)
    uow.rollback()
    second = run(ProposeReview(uow.factory(), bus, agent, hosts).execute(REPO, 31, "ana", "Fixes #12"))
    assert [r["github_username"] for r in second.content["reviewers"]] == ["carla"]

    # Once PR #30 is merged, Bruno's review isn't pending anymore.
    uow.rollback()
    for link in uow.links.find(REPO, 30, "pull_request"):
        uow.links.save(link.model_copy(update={"state": "merged"}))
    uow.commit()
    third = run(ProposeReview(uow.factory(), bus, agent, hosts).execute(REPO, 32, "ana", "Fixes #12"))
    assert [r["github_username"] for r in third.content["reviewers"]] == ["bruno"]


def test_nobody_else_with_a_username_means_no_reviewers():
    uow, saved, _, bus, hosts, agent = _setup()
    alone = uow.projects.get(saved.id)
    for member in alone.members[1:]:
        member.github_username = None
    uow.projects.save(alone)
    uow.commit()
    proposal = _propose(uow, bus, hosts, agent)
    assert proposal.content["reviewers"] == []
    assert "add the reviewers before approving" in proposal.rationale


def test_big_diff_is_truncated_and_marked_as_not_fully_reviewed():
    uow, _, _, bus, hosts, agent = _setup()
    hosts.host.diffs[30] = "+" * (MAX_DIFF_CHARS + 10)
    proposal = _propose(uow, bus, hosts, agent)
    sent = agent.calls[0][1]["diff"]
    assert sent.startswith("+" * MAX_DIFF_CHARS) and "[diff truncated" in sent and len(sent) < MAX_DIFF_CHARS + 200
    assert proposal.content["review"]["reviewed_fully"] is False
    assert "too big to review entirely" in proposal.content["comment"]


# ---------- ApplyReview ----------


def test_approval_requests_reviews_and_posts_the_marked_comment():
    uow, saved, _, bus, hosts, agent = _setup()
    proposal = _propose(uow, bus, hosts, agent)
    adjusted = {**proposal.content, "reviewers": [{"github_username": "carla"}, {"github_username": "leo"}], "comment": "Looks good."}
    _approve(uow, proposal.id, adjusted)  # the leader changes the reviewers and the comment (FR-016)

    run(ApplyReview(uow.factory(), bus, hosts).execute(proposal.id))
    assert hosts.host.called("request_review") == [{"repository": REPO, "number": 30, "reviewers": ["carla", "leo"]}]
    [comment] = hosts.host.called("comment_on_pull_request")
    assert comment["number"] == 30 and comment["body"].startswith("Looks good.")
    assert comment["body"].endswith(f"_Generated by the Agile Planner code reviewer agent and approved in proposal #{proposal.id}._")
    uow.rollback()
    assert [(w.number, w.action) for w in uow.own_writes.all()] == [(30, "review_requested"), (30, "commented")]
    event = bus.of_type("review_requested")[0]
    assert event.reviewers == ["carla", "leo"] and event.proposal_id == proposal.id
    assert event.summary == f"Requested reviews from @carla, @leo and posted the agent's review on PR #30 (proposal #{proposal.id})"


def test_without_reviewers_only_the_comment_is_posted():
    uow, _, _, bus, hosts, agent = _setup()
    proposal = _propose(uow, bus, hosts, agent)
    _approve(uow, proposal.id, {**proposal.content, "reviewers": []})
    run(ApplyReview(uow.factory(), bus, hosts).execute(proposal.id))
    assert hosts.host.called("request_review") == [] and len(hosts.host.called("comment_on_pull_request")) == 1


def test_retry_after_a_failed_comment_doesnt_request_reviews_twice():
    uow, _, _, bus, hosts, agent = _setup()
    proposal = _propose(uow, bus, hosts, agent)
    _approve(uow, proposal.id)
    real_comment = hosts.host.comment_on_pull_request

    async def down(*args) -> None:
        raise RuntimeError("GitHub didn't answer")

    hosts.host.comment_on_pull_request = down  # type: ignore[method-assign]
    with pytest.raises(RuntimeError):
        run(ApplyReview(uow.factory(), bus, hosts).execute(proposal.id))
    hosts.host.comment_on_pull_request = real_comment  # type: ignore[method-assign]
    run(ApplyReview(uow.factory(), bus, hosts).execute(proposal.id))
    assert len(hosts.host.called("request_review")) == 1 and len(hosts.host.called("comment_on_pull_request")) == 1


def test_disconnected_repo_fails_the_application():
    uow, saved, _, bus, hosts, agent = _setup()
    proposal = _propose(uow, bus, hosts, agent)
    _approve(uow, proposal.id)
    uow.rollback()
    uow.projects.save(uow.projects.get(saved.id).model_copy(update={"repository": "acme/other"}))
    uow.commit()
    with pytest.raises(RepositoryNotConnected):
        run(ApplyReview(uow.factory(), bus, hosts).execute(proposal.id))
    assert hosts.host.called("comment_on_pull_request") == []


def test_auto_approve_applies_the_review_through_the_registry():
    uow, _, _, bus, hosts, agent = _setup(auto_approve=True)
    registry = ApplierRegistry()
    registry.register("github_action", ApplyReview(uow.factory(), bus, hosts).execute, key="request_review")
    auto = AutoApprove(uow.factory(), bus, ApplyProposal(uow.factory(), bus, registry))
    proposal = _propose(uow, bus, hosts, agent, after_created=auto.after_created)
    stored = uow.factory()().proposals.get(proposal.id)
    assert stored.auto_approved and not stored.apply_failed
    assert len(hosts.host.called("comment_on_pull_request")) == 1
