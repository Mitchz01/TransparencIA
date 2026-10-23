"""Toda decisión de un agente es una propuesta: nada se aplica sin aprobación
(manual o por auto_approve del proyecto)."""

from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.domain.errors import ProposalAlreadyResolved

ProposalKind = Literal["plan_stage", "document", "replan", "github_action"]
ProposalStatus = Literal["pending", "approved", "adjusted", "rejected"]


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Proposal(BaseModel):
    id: int | None = None
    project_id: int
    kind: ProposalKind
    key: str  # etapa o acción, ej: "methodology", "create_issue"
    agent: str  # quién lo propuso, ej: "Agile coach"
    content: dict[str, Any]  # salida del agente, con su esquema
    rationale: str = ""
    status: ProposalStatus = "pending"
    adjusted_content: dict[str, Any] | None = None
    auto_approved: bool = False
    created_at: datetime = Field(default_factory=_now)
    resolved_at: datetime | None = None

    @property
    def final_content(self) -> dict[str, Any]:
        return self.adjusted_content if self.status == "adjusted" else self.content

    def approve(self, *, auto: bool = False) -> None:
        self._resolve("approved")
        self.auto_approved = auto

    def adjust(self, content: dict[str, Any]) -> None:
        self._resolve("adjusted")
        self.adjusted_content = content

    def reject(self) -> None:
        self._resolve("rejected")

    def _resolve(self, status: ProposalStatus) -> None:
        if self.status != "pending":
            raise ProposalAlreadyResolved(self.id, self.status)
        self.status = status
        self.resolved_at = _now()
