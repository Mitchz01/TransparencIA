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
        q = question.lower()
        if "falta" in q or "pendiente" in q or "sigue" in q:
            return CitizenAnswer(answer=_missing_answer(portal))
        if "hecho" in q or "hizo" in q or "avance" in q or "sembrado" in q:
            return CitizenAnswer(answer=_done_answer(portal))
        if "revisi" in q or "alerta" in q:
            return CitizenAnswer(answer=_alerts_answer(portal))
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


def _phase_tasks(portal: dict[str, Any], status: str) -> list[str]:
    return [t["title"] for s in portal.get("sprints") or [] for t in s.get("tasks") or [] if t.get("status") == status]


def _done_answer(portal: dict[str, Any]) -> str:
    done = _phase_tasks(portal, "done")
    if not done:
        return "Todavía no se ha reportado ninguna actividad terminada."
    recent = ", ".join(done[-3:])
    physical = (portal.get("summary") or {}).get("physical_pct")
    progress = f" El avance de las actividades va en {str(physical).replace('.', ',')} %." if physical is not None else ""
    return f"Se han terminado {len(done)} actividades; las más recientes son: {recent}.{progress}"


def _missing_answer(portal: dict[str, Any]) -> str:
    ongoing = _phase_tasks(portal, "in_progress")
    pending = _phase_tasks(portal, "pending")
    if not ongoing and not pending:
        return "No queda ninguna actividad por hacer en el plan publicado."
    now = f"Ahora está en curso: {', '.join(ongoing)}. " if ongoing else ""
    return f"{now}Faltan {len(pending)} actividades por empezar; las próximas son: {', '.join(pending[:3])}."


def _alerts_answer(portal: dict[str, Any]) -> str:
    alerts = portal.get("alerts") or []
    if not alerts:
        return "No hay alertas abiertas: ningún gasto ha sido marcado para revisión."
    first = alerts[0].get("reason", "")
    return f"Hay {len(alerts)} {'alerta' if len(alerts) == 1 else 'alertas'} para revisión. La primera dice: {first}"
