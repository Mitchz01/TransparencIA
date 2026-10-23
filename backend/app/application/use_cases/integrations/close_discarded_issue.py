"""Close the issue of a discarded task as "not planned" (spec 007, FR-022).

Called by spec 008's ApplyReplan for each discarded task, and when the leader deletes a
task. The close is recorded as an OwnWrite, so the webhook event it causes never marks
the task as done (FR-023). A GitHub failure is logged and reported as False."""

import logging

from app.application.ports.code_host import CodeHostFactory
from app.application.ports.event_bus import EventBus
from app.application.ports.unit_of_work import UnitOfWorkFactory
from app.domain.events import EventRef, IssueClosed
from app.domain.integrations import OwnWrite

logger = logging.getLogger("agile")


def close_comment(task_key: str, reason: str) -> str:
    return f"Closed as not planned by Agile Planner: task {task_key} was discarded.\n\nReason: {reason.strip() or 'not given'}"


class CloseDiscardedIssue:
    def __init__(self, uow_factory: UnitOfWorkFactory, bus: EventBus, code_hosts: CodeHostFactory):
        self._uow_factory = uow_factory
        self._bus = bus
        self._code_hosts = code_hosts

    async def execute(self, task_id: int, reason: str) -> bool:
        """True if the issue was closed (or found deleted and marked broken)."""
        with self._uow_factory() as uow:
            link = uow.links.get_issue(task_id)
            task = uow.tasks.get(task_id)  # None when the task was deleted
            project = uow.projects.get(link.project_id) if link else None
        if link is None or link.broken or link.state != "open" or project is None or project.repository is None:
            return False
        task_key = task.key if task else f"#{task_id}"
        try:
            exists = await self._code_hosts(project.github_token).close_issue(
                link.repository, link.number, "not_planned", close_comment(task_key, reason)
            )
        except Exception:  # noqa: BLE001
            logger.warning("Couldn't close issue #%s of task %s", link.number, task_id, exc_info=True)
            return False

        with self._uow_factory() as uow:
            if exists:
                uow.links.save(link.model_copy(update={"state": "closed"}))
                uow.own_writes.add(OwnWrite(repository=link.repository, number=link.number, action="issue_closed"))
            else:
                uow.links.save(link.model_copy(update={"broken": True}))
            uow.commit()
        if not exists:
            logger.info("Issue #%s of task %s was already deleted on GitHub", link.number, task_id)
            return True
        await self._bus.publish(
            IssueClosed(
                project_id=project.id,
                summary=f"Closed issue #{link.number} of {task_key} as not planned: {reason.strip() or 'discarded'}",
                ref=EventRef(kind="task", id=task_id),
                task_id=task_id,
                number=link.number,
                reason=reason,
            )
        )
        return True
