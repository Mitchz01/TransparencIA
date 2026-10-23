"""Spec 017 with Google ADK + Gemini (P2): one LlmAgent per call with output_schema; the evidence
file travels in the user message as bytes."""

from typing import Any

from app.domain.transparency import CitizenAnswer, EvidenceReading


class AdkTransparencyAgents:
    def __init__(self, model: str):
        self._model = model

    async def read_evidence(self, context: dict[str, Any], file: bytes, mime: str, filename: str) -> EvidenceReading:
        raise NotImplementedError

    async def answer_citizen(self, portal: dict[str, Any], question: str) -> CitizenAnswer:
        raise NotImplementedError
