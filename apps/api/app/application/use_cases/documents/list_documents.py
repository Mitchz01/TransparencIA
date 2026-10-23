"""Browse the project's documents and their versions (spec 006, US1 and US4)."""

from app.application.dto import DocumentSummary, DocumentView
from app.application.ports.unit_of_work import UnitOfWork
from app.domain.documents import document_order
from app.domain.errors import DocumentNotFound, ProjectNotFound, VersionNotFound


class ListDocuments:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    def execute(self, project_id: int) -> list[DocumentSummary]:
        """General spec first, then epic specs by epic key, then diagrams; empty before the
        first document proposal is approved."""
        if self._uow.projects.get(project_id) is None:
            raise ProjectNotFound(project_id)
        documents = sorted(self._uow.documents.list_by_project(project_id), key=document_order)
        return [DocumentSummary.of(d) for d in documents]


class GetDocument:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    def execute(self, document_id: int, version: int | None = None) -> DocumentView:
        document = self._uow.documents.get(document_id)
        if document is None:
            raise DocumentNotFound(document_id)
        versions = self._uow.documents.versions(document_id)
        if version is None:
            return DocumentView.of(document, versions)
        shown = next((v for v in versions if v.version == version), None)
        if shown is None:
            raise VersionNotFound(document_id, version)
        return DocumentView.of(document, versions, shown)
