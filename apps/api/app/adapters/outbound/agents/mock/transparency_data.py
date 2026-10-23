"""Fixtures of spec 017's mock agents (P2): the demo project's evidence (specs/017-transparency-portal/team/README.md)."""

import datetime as dt
from typing import Any

# One fixture per demo file: the EvidenceReading a real agent returns for it, except `task_id`.
# `task_match` is looked up (lowercased, as a substring) in the board's task titles at read time,
# so the draft points at the seed's real ids instead of hardcoded ones.

SEEDLINGS_INVOICE: dict[str, Any] = {
    "kind": "invoice",
    "amount": 30_000_000,
    "date": dt.date(2026, 8, 20),
    "supplier": "Vivero Ciénaga Viva",
    "concept": "20.000 plántulas de Rhizophora mangle",
    "budget_line_id": "R1",
    "task_match": "plántulas",
    "citizen_summary": "Se compraron 20.000 plántulas de mangle rojo para la siembra de las 5 hectáreas.",
    "alerts": [],
}

RESTAURANT_INVOICE: dict[str, Any] = {
    "kind": "invoice",
    "amount": 2_400_000,
    "date": dt.date(2026, 10, 2),
    "supplier": "Restaurante El Muelle",
    "concept": "Almuerzos para el equipo de campo",
    "budget_line_id": "R1",
    "task_match": None,
    "citizen_summary": "Se pagaron almuerzos del equipo de campo, cobrados al rubro de plántulas de mangle.",
    "alerts": [
        {
            "level": "medium",
            "reason": "El concepto (alimentación) no corresponde al rubro Plántulas de mangle. Requiere revisión.",
        }
    ],
}

PLANTING_PHOTO: dict[str, Any] = {
    "kind": "field_photo",
    "amount": None,
    "date": dt.date(2026, 9, 15),
    "supplier": None,
    "concept": "Siembra de la primera hectárea de mangle",
    "budget_line_id": "R2",
    "task_match": "sembrar",
    "citizen_summary": "Foto de la siembra de la primera hectárea de mangle en la Ciénaga Grande.",
    "alerts": [],
}

# Filename (lowercased) → fixture; the first match wins and anything else reads as the invoice.
BY_FILENAME: tuple[tuple[str, dict[str, Any]], ...] = (
    ("restaurante", RESTAURANT_INVOICE),
    ("foto", PLANTING_PHOTO),
)
DEFAULT_READING = SEEDLINGS_INVOICE
