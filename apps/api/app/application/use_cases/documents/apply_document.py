"""An approved (or adjusted) `document` proposal becomes a document or a new version of it
(spec 006, US1 and US4). It's the `document` applier in spec 005's registry, so it runs in
the background with its own UnitOfWork, and a failure can be retried there.

The proposal key names the document ("epic_spec:EP-2"): the first approval creates it at
version 1, a later one (a regeneration) adds the next version; old versions are kept (FR-008).
Applying the same proposal twice (a retried application) adds nothing."""

from app.application.ports.event_bus import EventBus
from app.application.ports.unit_of_work import UnitOfWorkFactory
from app.domain.diagrams import check_mermaid
from app.domain.documents import DocumentVersion, document_from_proposal
from app.domain.errors import InvalidDiagram, ProposalNotFound
from app.domain.events import DocumentSaved, EventRef


class ApplyDocumentProposal:
    def __init__(self, uow_factory: UnitOfWorkFactory, bus: EventBus):
        self._uow_factory = uow_factory
        self._bus = bus

    async def execute(self, proposal_id: int) -> None:
        with self._uow_factory() as uow:
            proposal = uow.proposals.get(proposal_id)
            if proposal is None:
                raise ProposalNotFound(proposal_id)
            if proposal.kind != "document" or not proposal.decided:
                return
            built = document_from_proposal(proposal.project_id, proposal.key, proposal.final_content)
            if built.kind == "flow_diagram":
                # The proposal schema already checks it; this keeps a diagram that wouldn't render out for good.
                issues = check_mermaid(built.content)
                if issues:
                    raise InvalidDiagram(issues)

            current = uow.documents.find(proposal.project_id, proposal.key)
            if current is None:
                document = uow.documents.add(built)
            elif any(v.proposal_id == proposal_id for v in uow.documents.versions(current.id)):  # type: ignore[arg-type]
                return
            else:
                document = uow.documents.save(current.next_version(built.title, built.content))
            uow.documents.add_version(
                DocumentVersion(document_id=document.id, version=document.version, content=document.content, proposal_id=proposal_id)  # type: ignore[arg-type]
            )
            uow.commit()

        await self._bus.publish(
            DocumentSaved(
                project_id=document.project_id,
                document_id=document.id,  # type: ignore[arg-type]
                key=document.key,
                version=document.version,
                source="agent",
                summary=f"{document.title} is at version {document.version}",
                ref=EventRef(kind="document", id=document.id),  # type: ignore[arg-type]
            )
        )
