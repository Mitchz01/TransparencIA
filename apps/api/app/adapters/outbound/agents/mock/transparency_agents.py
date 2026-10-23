"""Spec 017 without an API key (P2): fixed, realistic readings of the demo files, chosen by filename."""

import asyncio
from typing import Any

from app.domain.transparency import CitizenAnswer, EvidenceReading


class MockTransparencyAgents:
    def __init__(self, delay_seconds: float = 0.8):
        self._delay = delay_seconds

    async def read_evidence(self, context: dict[str, Any], file: bytes, mime: str, filename: str) -> EvidenceReading:
        await asyncio.sleep(self._delay)
        raise NotImplementedError

    async def answer_citizen(self, portal: dict[str, Any], question: str) -> CitizenAnswer:
        await asyncio.sleep(self._delay)
        raise NotImplementedError
