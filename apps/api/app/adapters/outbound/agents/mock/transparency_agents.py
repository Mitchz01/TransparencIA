"""Spec 017 without an API key (P2): fixed, realistic readings of the demo files, chosen by filename."""

import asyncio
import copy
from typing import Any

from app.adapters.outbound.agents.mock import transparency_data as fixtures
from app.domain.transparency import CitizenAnswer, EvidenceReading, cop


class MockTransparencyAgents:
    """Returns the demo project's evidence after a delay, so the whole flow (upload → draft →
    confirm → portal) can be shown without an API key.

    The reading is fitted to the context like a real agent would: the task comes from the board's
    own tasks, so the draft works with whatever ids the seed created. The citizen chat answers from
    the portal's budget lines, so its numbers match the screen the citizen is looking at."""

    def __init__(self, delay_seconds: float = 0.8):
        self._delay = delay_seconds

    async def read_evidence(self, context: dict[str, Any], file: bytes, mime: str, filename: str) -> EvidenceReading:
        await asyncio.sleep(self._delay)
        reading = copy.deepcopy(_pick(filename))
        reading["task_id"] = _task_id(context, reading.pop("task_match"))
        return EvidenceReading.model_validate(reading)

    async def answer_citizen(self, portal: dict[str, Any], question: str) -> CitizenAnswer:
        await asyncio.sleep(self._delay)
        return CitizenAnswer(answer=_spending_answer(portal))


def _pick(filename: str) -> dict[str, Any]:
    name = (filename or "").lower()
    for keyword, reading in fixtures.BY_FILENAME:
        if keyword in name:
            return reading
    return fixtures.DEFAULT_READING


def _task_id(context: dict[str, Any], title_match: str | None) -> int | None:
    """The task whose title contains `title_match`, among the ones the use case passed in."""
    if not title_match:
        return None
    for task in context.get("tasks") or []:
        if title_match in (task.get("title") or "").lower():
            return task.get("id")
    return None


def _spending_answer(portal: dict[str, Any]) -> str:
    """Where the money went, from the two budget lines with the most spent."""
    lines = sorted(portal.get("lines") or [], key=lambda line: line.get("spent") or 0, reverse=True)
    top = [line for line in lines[:2] if (line.get("spent") or 0) > 0]
    if not top:
        return "Todavía no se ha reportado ningún gasto en este proyecto."
    detail = " y en ".join(f"{line['name']}, {cop(line['spent'])} de {cop(line['amount'])}" for line in top)
    return (
        f"Según lo publicado, lo ejecutado hasta hoy está sobre todo en {detail}. "
        "Cada gasto tiene su documento de respaldo en la sección de evidencias."
    )
