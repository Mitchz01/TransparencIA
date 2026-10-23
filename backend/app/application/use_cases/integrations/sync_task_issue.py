"""Keep a published task's issue in sync with the task (spec 007, FR-021).

No proposal: publishing was already approved, the issue mirrors the task, and the change
was made by a person (or an approved replan). Meant as an `after_task_changed` handler of
spec 003's UpdateTask. A GitHub failure never fails the board edit: it's logged and the
next edit syncs again."""

import logging

from app.application.ports.code_host import CodeHostFactory
from app.application.ports.event_bus import EventBus
from app.application.ports.unit_of_work import UnitOfWorkFactory
from app.domain.events import EventRef, IssueUpdated
from app.domain.integrations import OwnWrite, issue_body, issue_labels

logger = logging.getLogger("agile")


class SyncTaskIssue:
    def __init__(self, uow_factory: UnitOfWorkFactory, bus: EventBus, code_hosts: CodeHostFactory):
        self._uow_factory = uow_factory
        self._bus = bus
        self._code_hosts = code_hosts

    async def execute(self, task_id: int) -> bool:
        """True if the issue was updated (or found deleted and marked broken)."""
        with self._uow_factory() as uow:
            task = uow.tasks.get(task_id)
            link = uow.links.get_issue(task_id)
            project = uow.projects.get(task.project_id) if task else None
        if task is None or link is None or link.broken or project is None or project.repository is None:
            return False  # not published, or the repo was disconnected: nothing is sent to GitHub
        if link.repository.lower() != project.repository.lower():
            return False  # the issue lives in a previous repo: it keeps its link but isn't managed anymore

        assignee = next((m for m in project.members if m.id == task.assignee_id), None)
        assignees = [assignee.github_username] if assignee and assignee.github_username else []
        try:
            exists = await self._code_hosts(project.github_token).update_issue(
                link.repository, link.number, task.title, issue_body(task), issue_labels(task), assignees
            )
        except Exception:  # noqa: BLE001
            logger.warning("Couldn't sync issue #%s of task %s", link.number, task_id, exc_info=True)
            return False

        with self._uow_factory() as uow:
            if exists:
                uow.own_writes.add(OwnWrite(repository=link.repository, number=link.number, action="issue_edited"))
            else:
                uow.links.save(link.model_copy(update={"broken": True}))  # deleted on GitHub: can be published again
            uow.commit()
        summary = (
            f"Updated issue #{link.number} with the changes to {task.key}"
            if exists
            else f"Issue #{link.number} of {task.key} was deleted on GitHub: the link is broken"
        )
        await self._bus.publish(
            IssueUpdated(
                project_id=project.id,
                summary=summary,
                ref=EventRef(kind="task", id=task_id),
                task_id=task_id,
                number=link.number,
                broken=not exists,
            )
        )
        return True
