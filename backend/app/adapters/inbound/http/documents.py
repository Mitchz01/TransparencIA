"""/api/projects/{id}/documents and /api/documents/{id} (spec 006, UC-08). Document proposals
are approved through spec 005's proposal API; regenerating sends a new one."""

from fastapi import APIRouter, Depends, Query, status

from app.adapters.inbound.http import dependencies as deps
from app.adapters.inbound.http.background import spawn
from app.application.dto import (
    DocumentEdit,
    DocumentRegenerate,
    DocumentSummary,
    DocumentView,
    RegenerationAccepted,
)
from app.application.use_cases.documents.edit_document import EditDocument
from app.application.use_cases.documents.list_documents import GetDocument, ListDocuments
from app.application.use_cases.documents.regenerate_document import RegenerateDocument
from app.application.use_cases.planning.generate_documents import GenerateDocuments

router = APIRouter(prefix="/api", tags=["documents"])


@router.get("/projects/{project_id}/documents", response_model=list[DocumentSummary], dependencies=[Depends(deps.allow("view"))])
def list_documents(project_id: int, use_case: ListDocuments = Depends(deps.get_list_documents)) -> list[DocumentSummary]:
    return use_case.execute(project_id)


@router.get("/documents/{document_id}", response_model=DocumentView, dependencies=[Depends(deps.allow("view", "document"))])
def get_document(
    document_id: int,
    version: int | None = Query(None, ge=1),
    use_case: GetDocument = Depends(deps.get_get_document),
) -> DocumentView:
    return use_case.execute(document_id, version)


@router.post("/documents/{document_id}/regenerate", status_code=status.HTTP_202_ACCEPTED, response_model=RegenerationAccepted, dependencies=[Depends(deps.allow("manage", "document"))])
async def regenerate_document(
    document_id: int,
    body: DocumentRegenerate,
    use_case: RegenerateDocument = Depends(deps.get_regenerate_document),
    generate: GenerateDocuments = Depends(deps.get_generate_documents),
) -> RegenerationAccepted:
    run = use_case.execute(document_id, body.instructions)
    spawn(generate.regenerate(run.project_id, run.key, run.feedback))  # agents never run inside the request
    return RegenerationAccepted(document_id=document_id)


@router.put("/documents/{document_id}", response_model=DocumentView, dependencies=[Depends(deps.allow("work", "document"))])
async def edit_document(
    document_id: int, body: DocumentEdit, use_case: EditDocument = Depends(deps.get_edit_document)
) -> DocumentView:
    return await use_case.execute(document_id, body.content, body.base_version)
