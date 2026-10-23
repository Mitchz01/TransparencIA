"""The leader edits a document by hand (spec 006, US4). It isn't an agent decision, so there's
no proposal: the edit is saved directly as the next version (source "leader") and clears
`outdated`. `base_version` is the version the leader edited; if someone saved a newer one in
between, the edit is refused with 409 version_conflict instead of overwriting it."""

from app.application.dto import DocumentView
from app.application.ports.event_bus import EventBus
from app.application.ports.unit_of_work import UnitOfWork
from app.domain.diagrams import check_mermaid
from app.domain.documents import CONTENT_MAX, DocumentVersion
from app.domain.errors import DocumentNotFound, InvalidDiagram, ValidationFailed, VersionConflict
from app.domain.events import DocumentSaved, EventRef


class EditDocument:
    def __init__(self, uow: UnitOfWork, bus: EventBus):
        self._uow = uow
        self._bus = bus

    async def execute(self, document_id: int, content: str, base_version: int) -> DocumentView:
        document = self._uow.documents.get(document_id)
        if document is None:
            raise DocumentNotFound(document_id)
        if not content.strip():
            raise ValidationFailed.single("content", "Required.")
        if len(content) > CONTENT_MAX:
            raise ValidationFailed.single("content", f"Max {CONTENT_MAX} characters.")
        if document.kind == "flow_diagram":
            issues = check_mermaid(content)
            if issues:
                raise InvalidDiagram(issues)
        if base_version != document.version:
            raise VersionConflict(document_id, base_version, document.version)

        saved = self._uow.documents.save(document.next_version(document.title, content))
        self._uow.documents.add_version(
            DocumentVersion(document_id=document_id, version=saved.version, content=content, source="leader")
        )
        versions = self._uow.documents.versions(document_id)
        self._uow.commit()
        await self._bus.publish(
            DocumentSaved(
                project_id=saved.project_id,
                actor="person",
                document_id=document_id,
                key=saved.key,
                version=saved.version,
                source="leader",
                summary=f"The leader edited {saved.title} (version {saved.version})",
                ref=EventRef(kind="document", id=document_id),
            )
        )
        return DocumentView.of(saved, versions)
