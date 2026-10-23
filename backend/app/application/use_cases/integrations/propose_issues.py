"""UC-10 · Propose publishing the tasks without an issue (spec 007, US2, FR-006).

Runs at three moments: when the repo is connected (if the board exists), as a follow-up
of spec 003's ApplyPlan / spec 008's ApplyReplan, and when the leader asks for it."""

from collections.abc import Awaitable, Callable

from app.application.ports.event_bus import EventBus
from app.application.ports.unit_of_work import UnitOfWork, UnitOfWorkFactory
from app.domain.board import Task
from app.domain.errors import NothingToPublish, ProjectNotFound, PublicationPending, RepositoryNotConnected
from app.domain.events import EventRef, ProposalCreated
from app.domain.integrations import IssuesToPublish, IssueToPublish
from app.domain.proposals import Proposal

AGENT = "GitHub integration"
KIND, KEY = "github_action", "create_issues"

# Spec 005's AutoApprove.after_created (or a wrapper that runs it in the background).
AfterCreated = Callable[[int], Awaitable[object]]


def unpublished_tasks(uow: UnitOfWork, project_id: int) -> list[Task]:
    """Tasks without an issue, or whose issue was deleted on GitHub (broken link).
    Tasks linked to an issue of a previous repo keep it (spec 007, edge cases)."""
    tasks = []
    for task in uow.tasks.list_by_project(project_id):
        link = uow.links.get_issue(task.id or 0)
        if link is None or link.broken:
            tasks.append(task)
    return tasks


class ProposeIssues:
    def __init__(self, uow: UnitOfWork, bus: EventBus, after_created: AfterCreated | None = None):
        self._uow = uow
        self._bus = bus
        self._after_created = after_created

    async def execute(self, project_id: int) -> Proposal:
        project = self._uow.projects.get(project_id)
        if project is None:
            raise ProjectNotFound(project_id)
        if project.repository is None:
            raise RepositoryNotConnected(project_id)
        pending = next(
            (p for p in self._uow.proposals.list_by_project(project_id) if (p.kind, p.key, p.status) == (KIND, KEY, "pending")),
            None,
        )
        if pending is not None:
            raise PublicationPending(pending.id)
        tasks = unpublished_tasks(self._uow, project_id)
        if not tasks:
            raise NothingToPublish()

        content = IssuesToPublish(
            repository=project.repository,
            tasks=[IssueToPublish(task_id=t.id or 0, key=t.key, title=t.title) for t in tasks],
        )
        proposal = self._uow.proposals.add(
            Proposal(
                project_id=project_id,
                kind=KIND,
                key=KEY,
                agent=AGENT,
                content=content.model_dump(mode="json"),
                rationale=f"{len(tasks)} board task(s) don't have an issue in {project.repository} yet.",
            )
        )
        self._uow.commit()
        await self._bus.publish(
            ProposalCreated(
                project_id=project_id,
                actor="system",
                summary=f"Proposed publishing {len(tasks)} task(s) as issues in {project.repository}",
                ref=EventRef(kind="proposal", id=proposal.id or 0),
                proposal_id=proposal.id or 0,
                kind=KIND,
                key=KEY,
                agent=AGENT,
            )
        )
        if self._after_created is not None:
            await self._after_created(proposal.id or 0)
        return proposal

    async def propose_pending(self, project_id: int) -> None:
        """ConnectRepository handler (and ApplyPlan follow-up): proposes only when there's
        something to publish; an empty board or a pending proposal is fine."""
        try:
            await self.execute(project_id)
        except (NothingToPublish, PublicationPending, RepositoryNotConnected):
            pass


class ProposePendingIssues:
    """Spec 003's ApplyPlan follow-up: once the board is built, propose publishing its tasks
    if the project has a repo connected. ApplyPlan runs in the background, so this opens its
    own UnitOfWork."""

    def __init__(self, uow_factory: UnitOfWorkFactory, bus: EventBus, after_created: AfterCreated | None = None):
        self._uow_factory = uow_factory
        self._bus = bus
        self._after_created = after_created

    async def __call__(self, project_id: int) -> None:
        with self._uow_factory() as uow:
            await ProposeIssues(uow, self._bus, self._after_created).propose_pending(project_id)
