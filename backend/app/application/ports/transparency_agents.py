from typing import Any, Protocol

from app.domain.transparency import CitizenAnswer, EvidenceReading


class TransparencyAgents(Protocol):
    """The AI of spec 017: it reads documents and explains, it never computes a number.
    Both methods raise AgentUnavailable on any failure."""

    async def read_evidence(self, context: dict[str, Any], file: bytes, mime: str, filename: str) -> EvidenceReading:
        """`context` = {"budget": Budget, "contract_period": {"start", "end"}, "tasks": [{"id", "title", "sprint"}]}."""
        ...

    async def answer_citizen(self, portal: dict[str, Any], question: str) -> CitizenAnswer:
        """`portal` is the public Portal as JSON: nothing private reaches the model."""
        ...
