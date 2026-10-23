"""The leader asks the writer to rewrite a document with instructions (spec 006, US4, FR-009).

Runs in the request: it checks the document can be regenerated and claims it, so a second
request gets 409 regeneration_in_progress. The router then spawns GenerateDocuments.regenerate,
whose result arrives as a `document` proposal; approving it adds the next version."""

from app.application.dto import DocumentRun
from app.application.ports.unit_of_work import UnitOfWork
from app.application.use_cases.planning.generate_documents import GenerateDocuments
from app.domain.documents import INSTRUCTIONS_MAX, document_content
from app.domain.errors import DocumentNotFound, RegenerationInProgress, ValidationFailed


class RegenerateDocument:
    def __init__(self, uow: UnitOfWork, generate: GenerateDocuments):
        self._uow = uow
        self._generate = generate

    def execute(self, document_id: int, instructions: str) -> DocumentRun:
        document = self._uow.documents.get(document_id)
        if document is None:
            raise DocumentNotFound(document_id)
        clean = instructions.strip()
        if not clean:
            raise ValidationFailed.single("instructions", "Required.")
        if len(clean) > INSTRUCTIONS_MAX:
            raise ValidationFailed.single("instructions", f"Max {INSTRUCTIONS_MAX} characters.")

        proposals = self._uow.proposals.list_by_project(document.project_id)
        pending = any(p.kind == "document" and p.key == document.key and p.status == "pending" for p in proposals)
        # A pending proposal of this document already waits for the leader: a second one would compete with it.
        if pending or not self._generate.claim(document.project_id, document.key):
            raise RegenerationInProgress(document_id)
        return DocumentRun(
            project_id=document.project_id,
            document_id=document_id,
            key=document.key,
            # Spec 002's feedback shape: the agent rewrites what it's given, following the reason.
            feedback={"reason": clean, "rejected_content": document_content(document)},
        )
