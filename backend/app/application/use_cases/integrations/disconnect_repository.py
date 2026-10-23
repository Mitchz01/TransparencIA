"""UC-09 · Disconnect the project's GitHub repo (spec 007, US1)."""

from app.application.ports.code_host import CodeHostFactory
from app.application.ports.event_bus import EventBus
from app.application.ports.unit_of_work import UnitOfWork
from app.application.use_cases.integrations.connect_repository import delete_webhook_best_effort
from app.domain.errors import ProjectNotFound, RepositoryNotConnected
from app.domain.events import EventRef, RepositoryDisconnected


class DisconnectRepository:
    def __init__(self, uow: UnitOfWork, bus: EventBus, code_hosts: CodeHostFactory):
        self._uow = uow
        self._bus = bus
        self._code_hosts = code_hosts

    async def execute(self, project_id: int) -> None:
        project = self._uow.projects.get(project_id)
        if project is None:
            raise ProjectNotFound(project_id)
        if project.repository is None:
            raise RepositoryNotConnected(project_id)
        repository = project.repository
        if project.webhook_id is not None:
            await delete_webhook_best_effort(self._code_hosts(project.github_token), repository, project.webhook_id)

        # The project token goes with the repo; issue links stay so cards keep their links.
        project.repository = None
        project.github_token = None
        project.webhook_id = None
        self._uow.projects.save(project)
        self._uow.commit()
        await self._bus.publish(
            RepositoryDisconnected(
                project_id=project_id,
                summary=f"Disconnected {repository}",
                ref=EventRef(kind="project", id=project_id),
                repository=repository,
            )
        )
