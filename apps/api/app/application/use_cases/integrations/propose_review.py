"""UC-11 · Propose a code review when a PR that closes project issues is opened (spec 007, US4).

Called by spec 008's webhook router on `pull_request.opened`, in the background. The
reviewer agent compares the diff with the tasks' acceptance criteria; the proposal
carries the suggested reviewers and the comment, and nothing reaches GitHub until it's
approved (ApplyReview)."""

from typing import Any

from app.application.ports.agents import PlanningAgents
from app.application.ports.code_host import CodeHostFactory
from app.application.ports.event_bus import EventBus
from app.application.ports.unit_of_work import UnitOfWork, UnitOfWorkFactory
from app.application.use_cases.integrations.propose_issues import AfterCreated
from app.domain.board import Task
from app.domain.events import EventRef, ProposalCreated
from app.domain.integrations import ExternalLink, ReviewToRequest, closing_refs, pick_reviewers, review_comment
from app.domain.plan import CODE_REVIEW_STAGE, CodeReview
from app.domain.proposals import Proposal

KIND, KEY = "github_action", "request_review"
# Bigger diffs are cut: the agent reviews the start and says it didn't review everything (FR-015).
MAX_DIFF_CHARS = 60_000


def _task_context(task: Task) -> dict[str, Any]:
    return task.model_dump(mode="json", include={"key", "title", "description", "acceptance_criteria", "type"})


def pending_reviews(uow: UnitOfWork, project_id: int) -> dict[int, int]:
    """Reviews per member requested through approved proposals whose PR is still open."""
    counts: dict[int, int] = {}
    for proposal in uow.proposals.list_by_project(project_id):
        if (proposal.kind, proposal.key) != (KIND, KEY) or not proposal.decided:
            continue
        content = ReviewToRequest.model_validate(proposal.final_content)
        links = uow.links.find(content.repository, content.pr_number, "pull_request")
        if any(link.state != "open" for link in links):
            continue  # merged or closed: nothing left to review
        for reviewer in content.reviewers:
            if reviewer.member_id is not None:
                counts[reviewer.member_id] = counts.get(reviewer.member_id, 0) + 1
    return counts


class ProposeReview:
    def __init__(
        self,
        uow_factory: UnitOfWorkFactory,
        bus: EventBus,
        agents: PlanningAgents,
        code_hosts: CodeHostFactory,
        after_created: AfterCreated | None = None,
    ):
        self._uow_factory = uow_factory
        self._bus = bus
        self._agents = agents
        self._code_hosts = code_hosts
        self._after_created = after_created

    async def execute(
        self, repository: str, pr_number: int, author: str, body: str | None, pr_url: str | None = None
    ) -> Proposal | None:
        """None when the repo isn't connected to a project or the PR closes no project issue (FR-018)."""
        with self._uow_factory() as uow:
            project = uow.projects.get_by_repository(repository)
            if project is None or project.id is None:
                return None
            tasks: list[Task] = []
            for number in closing_refs(body):
                for link in uow.links.find(repository, number, "issue"):
                    task = uow.tasks.get(link.task_id)
                    if task is not None and task.project_id == project.id and all(t.id != task.id for t in tasks):
                        tasks.append(task)
            if not tasks:
                return None
            load = pending_reviews(uow, project.id)
        repository = project.repository or repository

        diff = await self._code_hosts(project.github_token).get_pull_request_diff(repository, pr_number)
        truncated = len(diff) > MAX_DIFF_CHARS
        if truncated:
            diff = diff[:MAX_DIFF_CHARS] + f"\n[diff truncated: only the first {MAX_DIFF_CHARS} characters are included]"
        output = await self._agents.run_stage(CODE_REVIEW_STAGE, {"task": [_task_context(t) for t in tasks], "diff": diff})
        review = CodeReview.model_validate(output.model_dump())
        if truncated:
            review.reviewed_fully = False

        # The right role is the task's (its assignee's); without one, the author's.
        by_id = {m.id: m for m in project.members}
        assignee = next((by_id[t.assignee_id] for t in tasks if t.assignee_id in by_id), None)
        author_member = next((m for m in project.members if (m.github_username or "").lower() == author.lower()), None)
        role = assignee.role if assignee else author_member.role if author_member else None
        reviewers = pick_reviewers(project.members, author=author, role=role, pending_reviews=load)

        content = ReviewToRequest(
            repository=repository,
            pr_number=pr_number,
            pr_url=pr_url or f"https://github.com/{repository}/pull/{pr_number}",
            author=author,
            task_ids=[t.id or 0 for t in tasks],
            reviewers=reviewers,
            comment=review_comment(review),
            review=review,
        )
        who = "; ".join(f"@{r.github_username}: {r.reason}" for r in reviewers) or (
            "Nobody else has a GitHub username: add the reviewers before approving."
        )
        keys = ", ".join(t.key for t in tasks)
        with self._uow_factory() as uow:
            proposal = uow.proposals.add(
                Proposal(
                    project_id=project.id,
                    kind=KIND,
                    key=KEY,
                    agent=CODE_REVIEW_STAGE.title,
                    content=content.model_dump(mode="json"),
                    rationale=f"{review.rationale}\n\nReviewers: {who}",
                )
            )
            # Task ↔ PR links: spec 008 moves the tasks when the PR changes state.
            for task in tasks:
                if all(link.task_id != task.id for link in uow.links.find(repository, pr_number, "pull_request")):
                    uow.links.add(
                        ExternalLink(
                            project_id=project.id,
                            task_id=task.id or 0,
                            kind="pull_request",
                            repository=repository,
                            number=pr_number,
                            url=content.pr_url,
                        )
                    )
            uow.commit()
        await self._bus.publish(
            ProposalCreated(
                project_id=project.id,
                summary=f"Proposed a review of PR #{pr_number} ({keys}) by @{author}",
                ref=EventRef(kind="proposal", id=proposal.id or 0),
                proposal_id=proposal.id or 0,
                kind=KIND,
                key=KEY,
                agent=CODE_REVIEW_STAGE.title,
            )
        )
        if self._after_created is not None:
            await self._after_created(proposal.id or 0)
        return proposal
