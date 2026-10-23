"""UC-09 · Connect or replace the project's GitHub repo (spec 007, US1)."""

import logging
from collections.abc import Awaitable, Callable, Sequence

from app.application.dto import Connection
from app.application.ports.code_host import CodeHost, CodeHostFactory
from app.application.ports.event_bus import EventBus
from app.application.ports.unit_of_work import UnitOfWork
from app.domain.errors import ProjectNotFound, RepositoryNotAccessible
from app.domain.events import EventRef, RepositoryConnected
from app.domain.integrations import validate_repository

logger = logging.getLogger("agile")

# Runs after a repo is connected, with the project id (ProposeIssues.propose_pending).
ConnectedHandler = Callable[[int], Awaitable[None]]


async def delete_webhook_best_effort(host: CodeHost, repository: str, hook_id: int) -> None:
    """Best effort: a webhook left behind only sends events nobody listens to."""
    try:
        await host.delete_webhook(repository, hook_id)
    except Exception:  # noqa: BLE001
        logger.warning("Couldn't delete webhook %s of %s", hook_id, repository, exc_info=True)


class ConnectRepository:
    def __init__(
        self,
        uow: UnitOfWork,
        bus: EventBus,
        code_hosts: CodeHostFactory,
        webhook_url: str | None,
        webhook_secret: str = "",
        on_connected: Sequence[ConnectedHandler] = (),
    ):
        self._uow = uow
        self._bus = bus
        self._code_hosts = code_hosts
        self._webhook_url = webhook_url  # None = no public URL: connect without a webhook
        self._webhook_secret = webhook_secret
        self._handlers = list(on_connected)

    async def execute(self, project_id: int, repository: str, token: str | None = None) -> Connection:
        """`token`: None keeps the project's token, "" deletes it, anything else replaces it."""
        project = self._uow.projects.get(project_id)
        if project is None:
            raise ProjectNotFound(project_id)
        repository = validate_repository(repository)
        new_token = project.github_token if token is None else (token or None)
        host = self._code_hosts(new_token)

        # Nothing is saved unless the repo is reachable with every permission we need (FR-002).
        access = await host.check_access(repository)
        reason = access.problem(needs_webhook=self._webhook_url is not None)
        if reason is not None:
            raise RepositoryNotAccessible(repository, reason)

        old_repository, old_hook = project.repository, project.webhook_id
        old_host = self._code_hosts(project.github_token)
        same_repository = old_repository is not None and old_repository.lower() == repository.lower()
        if same_repository and old_hook is not None:
            await delete_webhook_best_effort(old_host, old_repository, old_hook)  # type: ignore[arg-type]

        hook_id = None
        if self._webhook_url is not None:
            hook_id = await host.register_webhook(repository, self._webhook_url, self._webhook_secret)

        project.repository = repository
        project.github_token = new_token
        project.webhook_id = hook_id
        saved = self._uow.projects.save(project)
        self._uow.commit()

        # Replacing unsubscribes from the old repo (FR-003); its issue links are kept.
        replaced = old_repository if old_repository is not None and not same_repository else None
        if replaced is not None and old_hook is not None:
            await delete_webhook_best_effort(old_host, replaced, old_hook)

        connection = Connection(
            repository=repository,
            has_token=saved.has_token,
            mode=host.mode,
            webhook_registered=hook_id is not None,
            replaced=replaced,
        )
        await self._bus.publish(
            RepositoryConnected(
                project_id=project_id,
                summary=f"Connected {repository}" + (f" (replaces {replaced})" if replaced else ""),
                ref=EventRef(kind="project", id=project_id),
                repository=repository,
                replaced=replaced,
                mode=connection.mode,
                webhook_registered=connection.webhook_registered,
            )
        )
        for handler in self._handlers:
            await handler(project_id)
        return connection
