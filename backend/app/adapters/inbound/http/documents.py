"""/api/projects/{id}/documents and /api/documents/{id} (spec 006, UC-08). Document proposals
are approved through spec 005's proposal API; regenerating sends a new one."""

from fastapi import APIRouter, Depends, Query

from app.adapters.inbound.http import dependencies as deps
from app.application.dto import DocumentSummary, DocumentView
from app.application.use_cases.documents.list_documents import GetDocument, ListDocuments

router = APIRouter(prefix="/api", tags=["documents"])


@router.get("/projects/{project_id}/documents", response_model=list[DocumentSummary])
def list_documents(project_id: int, use_case: ListDocuments = Depends(deps.get_list_documents)) -> list[DocumentSummary]:
    return use_case.execute(project_id)


@router.get("/documents/{document_id}", response_model=DocumentView)
def get_document(
    document_id: int,
    version: int | None = Query(None, ge=1),
    use_case: GetDocument = Depends(deps.get_get_document),
) -> DocumentView:
    return use_case.execute(document_id, version)
