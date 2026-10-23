"""The writer (spec 006) wired like dependencies.wire_documents, on the in-memory fakes, with
scriptable agents (never Gemini) and a project whose six plan stages are approved."""

import asyncio
from dataclasses import dataclass
from typing import Any

from app.adapters.outbound.agents.mock.data import MOCK_DOCUMENTS, MOCK_PLAN
from app.application.use_cases.documents.apply_document import ApplyDocumentProposal
from app.application.use_cases.planning.generate_documents import GenerateDocuments
from app.application.use_cases.proposals.apply_proposal import ApplierRegistry, ApplyProposal
from app.application.use_cases.proposals.auto_approve import AutoApprove
from app.domain.documents import Document
from app.domain.plan import PLANNING_STAGES
from app.domain.project import Project
from app.domain.proposals import Proposal
from tests.fakes import InMemoryUnitOfWork, RecordingEventBus, project
from tests.unit.application.planning_fixtures import ScriptedAgents

GENERAL = MOCK_DOCUMENTS["general_spec"]


@dataclass
class Writer:
    uow: InMemoryUnitOfWork
    bus: RecordingEventBus
    agents: ScriptedAgents
    generate: GenerateDocuments
    apply_document: ApplyDocumentProposal
    apply: ApplyProposal
    project: Project

    def run(self) -> None:
        asyncio.run(self.generate.execute(self.project.id))  # type: ignore[arg-type]

    def proposals(self, key: str | None = None) -> list[Proposal]:
        """The document proposals, oldest first."""
        with self.uow:
            rows = self.uow.proposals.list_by_project(self.project.id)  # type: ignore[arg-type]
        return [p for p in reversed(rows) if p.kind == "document" and (key is None or p.key == key)]

    def documents(self) -> list[Document]:
        with self.uow:
            return self.uow.documents.list_by_project(self.project.id)  # type: ignore[arg-type]

    def versions(self, document_id: int) -> list:
        with self.uow:
            return self.uow.documents.versions(document_id)

    def seed(self, kind: str, key: str, content: dict[str, Any], status: str = "approved", **fields: Any) -> Proposal:
        with self.uow:
            saved = self.uow.proposals.add(
                Proposal(
                    project_id=self.project.id,  # type: ignore[arg-type]
                    kind=kind,  # type: ignore[arg-type]
                    key=key,
                    agent="Agent",
                    content=content,
                    status=status,  # type: ignore[arg-type]
                    **fields,
                )
            )
            self.uow.commit()
        return saved

    def approve(self, proposal: Proposal, content: dict[str, Any] | None = None) -> None:
        """Decide like spec 005's API, then apply (in the request + spawned task)."""
        with self.uow:
            current = self.uow.proposals.get(proposal.id)  # type: ignore[arg-type]
            current.adjust(content) if content is not None else current.approve()
            self.uow.proposals.save(current)
            self.uow.commit()
        asyncio.run(self.apply.execute(proposal.id))  # type: ignore[arg-type]

    def reject(self, proposal: Proposal, reason: str = "Too long") -> None:
        with self.uow:
            current = self.uow.proposals.get(proposal.id)  # type: ignore[arg-type]
            current.reject(reason)
            self.uow.proposals.save(current)
            self.uow.commit()
        asyncio.run(self.apply.execute(proposal.id))  # type: ignore[arg-type]


def writer(agents: ScriptedAgents | None = None, plan: dict[str, Any] | None = None, **project_fields: Any) -> Writer:
    uow = InMemoryUnitOfWork()
    saved = uow.projects.add(project(**{"status": "ready", **project_fields}))
    uow.commit()
    bus = RecordingEventBus()
    agents = agents or ScriptedAgents()
    appliers = ApplierRegistry()
    apply = ApplyProposal(uow.factory(), bus, appliers)
    generate = GenerateDocuments(uow.factory(), agents, bus, AutoApprove(uow.factory(), bus, apply))
    apply_document = ApplyDocumentProposal(uow.factory(), bus)
    appliers.register("document", apply_document.execute)
    appliers.register("document", generate.on_proposal_resolved, on=("rejected",))
    w = Writer(uow, bus, agents, generate, apply_document, apply, saved)
    for stage in PLANNING_STAGES:
        w.seed("plan_stage", stage.key, (plan or {}).get(stage.key) or MOCK_PLAN[stage.key])
    return w
