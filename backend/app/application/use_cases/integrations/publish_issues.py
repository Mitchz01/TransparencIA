"""UC-10 · Apply an approved `create_issues` proposal: one issue per task (spec 007, US2).

Registered in spec 005's applier registry. Each issue is saved as soon as it's created,
so a failure halfway keeps what was published (FR-011) and a retry (spec 005's
POST /proposals/{id}/apply) only publishes what's missing: a task never gets two issues
(FR-010). Failures make the application fail, so the proposal shows them and can be retried."""

from app.application.ports.code_host import CodeHostFactory
from app.application.ports.event_bus import EventBus
from app.application.ports.unit_of_work import UnitOfWorkFactory
from app.domain.errors import ProposalNotFound, RepositoryNotConnected
from app.domain.events import EventRef, FailedIssue, IssuesPublished, PublishedIssue
from app.domain.integrations import ExternalLink, IssuesToPublish, OwnWrite, issue_body, issue_labels


class IssuesNotPublished(Exception):
    """Some issues couldn't be created; the proposal's result lists which ones."""


class PublishIssues:
    def __init__(self, uow_factory: UnitOfWorkFactory, bus: EventBus, code_hosts: CodeHostFactory):
        self._uow_factory = uow_factory
        self._bus = bus
        self._code_hosts = code_hosts

    async def execute(self, proposal_id: int) -> None:
        with self._uow_factory() as uow:
            proposal = uow.proposals.get(proposal_id)
            if proposal is None:
                raise ProposalNotFound(proposal_id)
            project = uow.projects.get(proposal.project_id)
        if project is None or project.repository is None:
            raise RepositoryNotConnected(proposal.project_id)
        repository = project.repository  # the connected repo now, even if it changed since proposing
        host = self._code_hosts(project.github_token)
        usernames = {m.id: m.github_username for m in project.members}
        content = IssuesToPublish.model_validate(proposal.final_content)

        created: list[PublishedIssue] = []
        failed: list[FailedIssue] = []
        for item in content.tasks:
            with self._uow_factory() as uow:
                task = uow.tasks.get(item.task_id)
                link = uow.links.get_issue(item.task_id)
            if task is None or task.project_id != project.id:
                failed.append(FailedIssue(task_id=item.task_id, error="The task no longer exists."))
                continue
            if link is not None and not link.broken:
                continue  # already published, e.g. by a previous attempt
            username = usernames.get(task.assignee_id) if task.assignee_id is not None else None
            try:
                issue = await host.create_issue(
                    repository, task.title, issue_body(task), issue_labels(task), [username] if username else []
                )
            except Exception as error:  # noqa: BLE001  reported per task, the rest go on
                failed.append(FailedIssue(task_id=item.task_id, error=str(error) or error.__class__.__name__))
                continue
            with self._uow_factory() as uow:
                uow.links.add(
                    ExternalLink(
                        project_id=project.id or 0,
                        task_id=item.task_id,
                        kind="issue",
                        repository=repository,
                        number=issue.number,
                        url=issue.url,
                    )
                )
                uow.own_writes.add(OwnWrite(repository=repository, number=issue.number, action="issue_opened"))
                uow.commit()
            created.append(PublishedIssue(task_id=item.task_id, number=issue.number))

        with self._uow_factory() as uow:
            current = uow.proposals.get(proposal_id)
            if current is not None:
                previous = (current.result or {}).get("created", [])
                current.result = {
                    "created": previous + [c.model_dump() for c in created],
                    "failed": [f.model_dump() for f in failed],
                }
                uow.proposals.save(current)
                uow.commit()

        summary = f"Published {len(created)} issue(s) in {repository}"
        await self._bus.publish(
            IssuesPublished(
                project_id=project.id,
                summary=summary + (f"; {len(failed)} failed" if failed else "") + f" (proposal #{proposal_id})",
                ref=EventRef(kind="proposal", id=proposal_id),
                proposal_id=proposal_id,
                created=created,
                failed=failed,
            )
        )
        if failed:
            raise IssuesNotPublished(f"{len(failed)} issue(s) couldn't be created. Retry to publish them.")
