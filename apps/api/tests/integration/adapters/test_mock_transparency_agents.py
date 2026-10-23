"""The mock transparency agents tell the demo project's story without an API key (spec 017, P2):
each demo file reads as its own evidence and the restaurant invoice is always flagged (SC-004)."""

import asyncio

from app.adapters.outbound.agents.mock.transparency_agents import MockTransparencyAgents

AGENTS = MockTransparencyAgents(delay_seconds=0)

CONTEXT = {
    "budget": {"contract_value": 180_000_000},
    "contract_period": {"start": "2026-08-03", "end": "2027-02-01"},
    "tasks": [
        {"id": 41, "title": "Comprar plántulas en el vivero", "sprint": "Vivero"},
        {"id": 42, "title": "Sembrar lote 1 (1 ha)", "sprint": "Siembra"},
    ],
}

PORTAL = {
    "lines": [
        {"id": "R1", "name": "Plántulas de mangle", "amount": 45_000_000, "spent": 32_400_000, "available": 12_600_000},
        {"id": "R2", "name": "Mano de obra local", "amount": 70_000_000, "spent": 18_000_000, "available": 52_000_000},
        {"id": "R3", "name": "Logística y transporte fluvial", "amount": 30_000_000, "spent": 0, "available": 30_000_000},
    ]
}


def _read(filename: str, context: dict | None = None) -> dict:
    reading = asyncio.run(AGENTS.read_evidence(CONTEXT if context is None else context, b"", "image/jpeg", filename))
    return reading.model_dump(mode="json")


def test_the_seedlings_invoice_is_the_default_reading():
    reading = _read("factura-vivero.pdf")
    assert (reading["kind"], reading["amount"], reading["budget_line_id"]) == ("invoice", 30_000_000, "R1")
    assert reading["supplier"] == "Vivero Ciénaga Viva"
    assert reading["task_id"] == 41
    assert reading["alerts"] == []


def test_the_restaurant_invoice_is_always_flagged():
    reading = _read("factura-restaurante.jpg")
    assert (reading["amount"], reading["budget_line_id"]) == (2_400_000, "R1")
    assert [alert["level"] for alert in reading["alerts"]] == ["medium"]
    assert reading["alerts"][0]["reason"].startswith("El concepto (alimentación) no corresponde")
    assert reading["task_id"] is None


def test_the_field_photo_has_no_amount_and_lands_on_its_task():
    reading = _read("foto-siembra.jpg")
    assert (reading["kind"], reading["amount"]) == ("field_photo", None)
    assert (reading["budget_line_id"], reading["task_id"]) == ("R2", 42)
    assert reading["date"] == "2026-09-15"


def test_the_filename_rule_ignores_case_and_path():
    assert _read("IMG_Foto_Siembra.JPG")["kind"] == "field_photo"
    assert _read("Factura Restaurante El Muelle.JPEG")["amount"] == 2_400_000


def test_the_task_is_null_when_the_board_has_no_matching_task():
    assert _read("foto-siembra.jpg", {"tasks": []})["task_id"] is None
    assert _read("factura-vivero.pdf", {})["task_id"] is None


def test_every_reading_has_a_citizen_summary_in_plain_language():
    for filename in ("factura-vivero.pdf", "factura-restaurante.jpg", "foto-siembra.jpg"):
        summary = _read(filename)["citizen_summary"]
        assert summary and len(summary) <= 200


def test_reading_the_same_file_twice_does_not_mutate_the_fixture():
    assert _read("foto-siembra.jpg")["task_id"] == 42
    assert _read("foto-siembra.jpg")["task_id"] == 42


def test_the_chat_answers_with_the_two_largest_lines_in_pesos():
    answer = asyncio.run(AGENTS.answer_citizen(PORTAL, "¿En qué se gastó la plata?")).answer
    assert "Plántulas de mangle, $32.400.000 de $45.000.000" in answer
    assert "Mano de obra local, $18.000.000 de $70.000.000" in answer
    assert "Logística" not in answer
    assert len(answer) <= 500


def test_the_chat_says_nothing_is_reported_yet_when_there_is_no_spending():
    lines = [{**line, "spent": 0} for line in PORTAL["lines"]]
    answer = asyncio.run(AGENTS.answer_citizen({"lines": lines}, "¿Cuánto se ha gastado?")).answer
    assert "Todavía no se ha reportado" in answer
