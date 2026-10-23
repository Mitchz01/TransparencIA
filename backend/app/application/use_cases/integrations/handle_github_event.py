"""UC-12 · The board moves forward with GitHub (spec 008, US1).

Two steps, because GitHub needs a fast answer:
- `receive` (in the request): each delivery is processed once (FR-003), and events of an
  unknown repo or that the board doesn't handle are ignored.
- `execute` (in the background, own UnitOfWork): finds the tasks through spec 007's links,
  skips the echo of the system's own writes (FR-015), applies `next_status` without a
  proposal, completes the checklist on merge (FR-005) and publishes the changes (FR-006).
  The shared `after_task_changed` handlers run next, like after a move on the board
  (spec 003): objective evaluation, issue sync. A `pull_request.opened` also goes to
  spec 007's ProposeReview (`on_pull_request_opened`)."""

import logging
from collections.abc import Awaitable, Callable, Sequence

from app.application.dto import WebhookReceipt
from app.application.ports.event_bus import EventBus
from app.application.ports.unit_of_work import UnitOfWork, UnitOfWorkFactory
from app.application.use_cases.board.common import TaskChangedHandler
from app.domain.board import ChecklistItem, Task, is_continuous, reorder
from app.domain.events import DomainEvent, EventRef, GithubEventIgnored, TaskStatusChanged, TaskUpdated
from app.domain.integrations import ExternalLink
from app.domain.project import Project
from app.domain.sync import (
    GithubEvent,
    IssueClosed,
    IssueReopened,
    PullRequestClosed,
    PullRequestEvent,
    PullRequestMerged,
    PullRequestOpened,
    WebhookDelivery,
    completes_checklist,
    next_status,
)

logger = logging.getLogger("agile")

PullRequestOpenedHandler = Callable[[PullRequestOpened], Awaitable[object]]

_WHAT = {
    "pull_request_opened": "PR #{n} opened",
    "pull_request_ready_for_review": "PR #{n} ready for review",
    "pull_request_merged": "PR #{n} merged",
    "pull_request_closed": "PR #{n} closed",
    "issue_closed": "issue #{n} closed",
    "issue_reopened": "issue #{n} reopened",
}


def describe(event: GithubEvent) -> str:
    return _WHAT[event.kind].format(n=event.number)


class HandleGithubEvent:
    def __init__(
        self,
        uow_factory: UnitOfWorkFactory,
        bus: EventBus,
        after_task_changed: Sequence[TaskChangedHandler] = (),
        on_pull_request_opened: PullRequestOpenedHandler | None = None,
    ):
        self._uow_factory = uow_factory
        self._bus = bus
        self._handlers = after_task_changed  # the shared list: handlers registered later still run
        self._on_pull_request_opened = on_pull_request_opened

    def receive(self, delivery_id: str, event_name: str, event: GithubEvent | None) -> WebhookReceipt:
        """Records the delivery and says whether `execute` should run."""
        with self._uow_factory() as uow:
            if uow.deliveries.seen(delivery_id):
                return WebhookReceipt(delivery_id=delivery_id, status="ignored", reason="duplicate")
            uow.deliveries.add(WebhookDelivery(delivery_id=delivery_id, event=event_name))
            project = uow.projects.get_by_repository(event.repository) if event is not None else None
            uow.commit()
        if event is None:
            return WebhookReceipt(delivery_id=delivery_id, status="ignored", reason="unhandled_event")
        if project is None:
            return WebhookReceipt(delivery_id=delivery_id, status="ignored", reason="unknown_repository")
        return WebhookReceipt(delivery_id=delivery_id, status="accepted")

    async def handle(self, delivery_id: str, event_name: str, event: GithubEvent | None) -> WebhookReceipt:
        """`receive` and, when accepted, `execute` right away (tests and the dev replay)."""
        receipt = self.receive(delivery_id, event_name, event)
        if receipt.status == "accepted" and event is not None:
            await self.execute(event)
        return receipt

    async def execute(self, event: GithubEvent) -> list[Task]:
        """Applies the event; returns the tasks it changed."""
        changed: list[tuple[Task, list[DomainEvent]]] = []
        ignored: list[GithubEventIgnored] = []
        with self._uow_factory() as uow:
            project = uow.projects.get_by_repository(event.repository)
            if project is None or project.id is None:
                return []
            if isinstance(event, IssueClosed) and uow.own_writes.consume_matching(event.repository, event.number, "issue_closed"):
                uow.commit()  # our own close (a discarded task, spec 007 FR-022): never progress
                return []

            tasks = self._linked_tasks(uow, project, event)
            if isinstance(event, IssueClosed) and event.reason == "not_planned":
                ignored = [self._not_planned(project, event, task) for task in tasks]
            else:
                changed = [(task, events) for task, events in (self._apply(uow, project, event, t) for t in tasks) if events]
            uow.commit()

        for event_ in ignored:
            await self._bus.publish(event_)
        for task, events in changed:
            for domain_event in events:
                await self._bus.publish(domain_event)
                for handler in list(self._handlers):
                    await handler(task, domain_event)
        if isinstance(event, PullRequestOpened) and self._on_pull_request_opened is not None:
            try:
                await self._on_pull_request_opened(event)
            except Exception:  # noqa: BLE001  a failed review proposal never undoes the sync
                logger.warning("Couldn't propose a review for PR #%s of %s", event.number, event.repository, exc_info=True)
        return [task for task, _ in changed]

    # ---------- Steps ----------

    def _linked_tasks(self, uow: UnitOfWork, project: Project, event: GithubEvent) -> list[Task]:
        """The project's tasks the event is about, updating the links' state on the way."""
        if isinstance(event, PullRequestEvent):
            issue_links = [link for n in event.closes for link in uow.links.find(event.repository, n, "issue")]
            pr_links = uow.links.find(event.repository, event.number, "pull_request")
            links = issue_links + pr_links
        else:
            links = uow.links.find(event.repository, event.number, "issue")
        links = [link for link in links if link.project_id == project.id]

        tasks: list[Task] = []
        for link in links:
            task = uow.tasks.get(link.task_id)
            if task is not None and all(t.id != task.id for t in tasks):
                tasks.append(task)

        if isinstance(event, IssueClosed | IssueReopened):
            state = "closed" if isinstance(event, IssueClosed) else "open"
            for link in links:
                uow.links.save(link.model_copy(update={"state": state}))
        else:
            self._track_pull_request(uow, project, event, tasks)  # type: ignore[arg-type]
        return tasks

    def _track_pull_request(self, uow: UnitOfWork, project: Project, event: PullRequestEvent, tasks: list[Task]) -> None:
        """Task ↔ PR links (shared with spec 007's ProposeReview), with the PR's state."""
        state = "merged" if isinstance(event, PullRequestMerged) else "closed" if isinstance(event, PullRequestClosed) else "open"
        existing = uow.links.find(event.repository, event.number, "pull_request")
        for link in existing:
            if link.state != state:
                uow.links.save(link.model_copy(update={"state": state}))
        url = event.url if isinstance(event, PullRequestOpened) and event.url else (
            f"https://github.com/{event.repository}/pull/{event.number}"
        )
        for task in tasks:
            if all(link.task_id != task.id for link in existing):
                uow.links.add(
                    ExternalLink(
                        project_id=project.id or 0,
                        task_id=task.id or 0,
                        kind="pull_request",
                        repository=event.repository,
                        number=event.number,
                        url=url,
                        state=state,
                    )
                )

    def _apply(self, uow: UnitOfWork, project: Project, event: GithubEvent, task: Task) -> tuple[Task, list[DomainEvent]]:
        """Saves the task's new checklist and status (without committing) and returns the events to publish."""
        events: list[DomainEvent] = []
        ref = EventRef(kind="task", id=task.id or 0)
        why = describe(event)
        if completes_checklist(event) and any(not item.done for item in task.checklist):
            checklist = [ChecklistItem(text=item.text, done=True) for item in task.checklist]
            task = uow.tasks.save(task.model_copy(update={"checklist": checklist}))
            events.append(
                TaskUpdated(
                    project_id=project.id,
                    actor="github",
                    summary=f"{task.key}'s checklist was completed ({why} on GitHub)",
                    ref=ref,
                    task_id=task.id or 0,
                    fields=["checklist"],
                )
            )
        status = next_status(task.status, event)
        if status is not None:
            tasks = uow.tasks.list_by_project(project.id or 0)
            for moved in reorder(tasks, task.id or 0, status, None, task.sprint_id, continuous=is_continuous(project)):
                uow.tasks.save(moved)
            task = uow.tasks.get(task.id or 0) or task
            events.append(
                TaskStatusChanged(
                    project_id=project.id,
                    actor="github",
                    summary=f"{task.key} moved to {status} ({why} on GitHub)",
                    ref=ref,
                    task_id=task.id or 0,
                    status=status,
                    sprint_id=task.sprint_id,
                    position=task.position,
                )
            )
        return task, events

    def _not_planned(self, project: Project, event: IssueClosed, task: Task) -> GithubEventIgnored:
        return GithubEventIgnored(
            project_id=project.id,
            summary=f"Issue #{event.number} of {task.key} was closed as not planned on GitHub: the task didn't change, decide what to do with it",
            ref=EventRef(kind="task", id=task.id or 0),
            repository=event.repository,
            number=event.number,
            task_id=task.id,
            reason="closed_not_planned",
        )
