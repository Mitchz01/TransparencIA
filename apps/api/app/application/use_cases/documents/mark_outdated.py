"""Flag the project's documents as outdated after its plan changed (spec 006, FR-011).

Spec 008 calls it after a replan is applied. The documents aren't rewritten by themselves:
the UI offers to regenerate them, and a new version (approved regeneration or the leader's
edit) clears the flag. Background-safe: it opens its own UnitOfWork."""

from app.application.ports.event_bus import EventBus
from app.application.ports.unit_of_work import UnitOfWorkFactory
from app.domain.events import DocumentsOutdated, EventRef


class MarkDocumentsOutdated:
    def __init__(self, uow_factory: UnitOfWorkFactory, bus: EventBus):
        self._uow_factory = uow_factory
        self._bus = bus

    async def execute(self, project_id: int) -> list[int]:
        """The ids of the documents flagged now (the ones already outdated aren't repeated)."""
        with self._uow_factory() as uow:
            flagged = [d for d in uow.documents.list_by_project(project_id) if not d.outdated]
            for document in flagged:
                uow.documents.save(document.model_copy(update={"outdated": True}))
            uow.commit()
        ids: list[int] = [d.id for d in flagged]  # type: ignore[misc]
        if ids:
            await self._bus.publish(
                DocumentsOutdated(
                    project_id=project_id,
                    document_ids=ids,
                    summary=f"The plan changed: {len(ids)} documents are outdated",
                    ref=EventRef(kind="project", id=project_id),
                )
            )
        return ids
