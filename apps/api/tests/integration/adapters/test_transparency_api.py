"""Every status row of spec 017's API Contract, with a stubbed evidence agent so P2's adapters
aren't needed. The citizen chat (POST .../ask) is covered by P2's AskCitizen tests."""

import datetime as dt

import pytest
from sqlmodel import Session

from app.adapters.inbound.http import dependencies as deps
from app.adapters.outbound.persistence.db import engine
from app.adapters.outbound.persistence.tables import TaskTable
from app.domain.transparency import AgentUnavailable, AlertDraft, EvidenceReading
from tests.api import as_new_user, create_project, invite_token, join

TODAY = dt.date(2026, 10, 23)
PROJECT = {
    "name": "Restauración de manglar en la Ciénaga Grande",
    "description": "Restauración de 5 ha de manglar. Contrato con Corpamag por $180.000.000, 6 meses.",
    "duration_weeks": 26,
    "members": [{"name": "Ana", "role": "Bióloga", "seniority": "senior", "hours_per_week": 30}],
}
BUDGET = {
    "contracting_entity": "Corpamag",
    "contractor": "Fundación Manglares Vivos",
    "contract_value": 180_000_000,
    "start_date": "2026-08-03",
    "lines": [
        {"id": "R1", "name": "Plántulas de mangle", "amount": 45_000_000},
        {"id": "R2", "name": "Mano de obra local", "amount": 70_000_000},
        {"id": "R3", "name": "Logística y transporte fluvial", "amount": 30_000_000},
        {"id": "R4", "name": "Monitoreo y talleres comunitarios", "amount": 35_000_000},
    ],
}
PDF = ("factura.pdf", b"%PDF-1.4 fake invoice", "application/pdf")


class StubAgents:
    """Stands in for the evidence agent: answers `reading`, or fails like Gemini would."""

    def __init__(self) -> None:
        self.reading = EvidenceReading(
            kind="invoice", amount=30_000_000, date=dt.date(2026, 8, 20), supplier="Vivero Ciénaga Viva",
            concept="20.000 plántulas de Rhizophora mangle", budget_line_id="R1", task_id=None,
            citizen_summary="Compra de 20.000 plántulas de mangle.", alerts=[],
        )
        self.fails = False
        self.contexts: list[dict] = []

    async def read_evidence(self, context, file, mime, filename):
        self.contexts.append(context)
        if self.fails:
            raise AgentUnavailable()
        return self.reading


@pytest.fixture
def agents(client):
    stub = StubAgents()
    client.app.state.transparency_agents = stub
    client.app.dependency_overrides[deps.today] = lambda: TODAY
    yield stub
    client.app.dependency_overrides.pop(deps.today, None)


@pytest.fixture
def pid(client, agents):
    return create_project(client, PROJECT)["id"]


@pytest.fixture
def budgeted(client, pid):
    assert client.put(f"/api/projects/{pid}/budget", json=BUDGET).status_code == 200
    return pid


def _error(response, status: int, code: str) -> dict:
    assert response.status_code == status, response.text
    assert response.json()["code"] == code
    return response.json()


def _task(pid: int, title: str, points: int = 5, done_on: dt.datetime | None = None) -> int:
    with Session(engine) as session:
        row = TaskTable(project_id=pid, key=f"T-{title[:3]}", title=title, points=points, status="done" if done_on else "todo", done_at=done_on)
        session.add(row)
        session.commit()
        return row.id


def _upload(client, pid: int, file=PDF):
    return client.post(f"/api/projects/{pid}/expenses", files={"file": file})


def _confirmation(**overrides) -> dict:
    body = {
        "kind": "invoice", "amount": 30_000_000, "date": "2026-08-20", "supplier": "Vivero Ciénaga Viva",
        "concept": "Plántulas", "budget_line_id": "R1", "task_id": None, "citizen_summary": "Compra de plántulas de mangle.",
    }
    return {**body, **overrides}


def _confirmed(client, pid: int, **overrides) -> dict:
    draft = _upload(client, pid).json()
    response = client.post(f"/api/projects/{pid}/expenses/{draft['id']}/confirm", json=_confirmation(**overrides))
    assert response.status_code == 200, response.text
    return response.json()


def _publish(client, pid: int) -> str:
    response = client.put(f"/api/projects/{pid}/publication", json={"public": True})
    assert response.status_code == 200, response.text
    return response.json()["public_url"].rsplit("/", 1)[1]


# ---------- Budget (US1) ----------


def test_budget_is_null_until_set_then_comes_back_with_its_end_date(client, pid):
    assert client.get(f"/api/projects/{pid}/budget").json() is None
    response = client.put(f"/api/projects/{pid}/budget", json=BUDGET)
    assert response.status_code == 200
    body = response.json()
    assert body["end_date"] == "2027-01-31" and body["contract_value"] == 180_000_000 and len(body["lines"]) == 4
    assert client.get(f"/api/projects/{pid}/budget").json() == body


def test_lines_that_dont_add_up_can_still_be_saved(client, pid):
    response = client.put(f"/api/projects/{pid}/budget", json={**BUDGET, "lines": BUDGET["lines"][:1]})
    assert response.status_code == 200
    assert client.get(f"/api/projects/{pid}/transparency").json()["summary"]["unallocated"] == 135_000_000


def test_budget_rejects_invalid_fields(client, pid):
    body = {**BUDGET, "contract_value": 0, "lines": [BUDGET["lines"][0], {**BUDGET["lines"][1], "id": "R1", "amount": -1}]}
    error = _error(client.put(f"/api/projects/{pid}/budget", json=body), 422, "validation_failed")
    assert {e["field"] for e in error["errors"]} == {"contract_value", "lines[1].id", "lines[1].amount"}


def test_only_a_leader_sets_the_budget_but_members_read_it(client, pid):
    leo = as_new_user(client, "Leo", role="Frontend")
    join(leo, invite_token(client, pid))
    client.put(f"/api/projects/{pid}/budget", json=BUDGET)
    _error(leo.put(f"/api/projects/{pid}/budget", json=BUDGET), 403, "forbidden")
    assert leo.get(f"/api/projects/{pid}/budget").status_code == 200


def test_budget_needs_a_session_and_membership(client, anonymous, pid):
    _error(anonymous.get(f"/api/projects/{pid}/budget"), 401, "not_authenticated")
    _error(as_new_user(client, "Eva").get(f"/api/projects/{pid}/budget"), 404, "project_not_found")


# ---------- Evidence into a draft (US2) ----------


def test_upload_needs_a_budget(client, pid):
    _error(_upload(client, pid), 409, "budget_missing")


def test_upload_creates_a_draft_and_sends_the_agent_the_budget_and_the_tasks(client, budgeted, agents):
    task = _task(budgeted, "Comprar plántulas")
    agents.reading = agents.reading.model_copy(update={"task_id": task, "alerts": [AlertDraft(level="medium", reason="Revisar el concepto.")]})
    response = _upload(client, budgeted)
    assert response.status_code == 201, response.text
    draft = response.json()
    assert draft["status"] == "draft" and draft["amount"] == 30_000_000 and draft["budget_line_id"] == "R1"
    assert draft["task_id"] == task and draft["task_title"] == "Comprar plántulas"
    assert draft["file_url"] == f"/api/files/{draft['file_id']}" and draft["mime"] == "application/pdf"
    assert [(a["level"], a["source"]) for a in draft["alerts"]] == [("medium", "ai")]
    context = agents.contexts[0]
    assert context["contract_period"] == {"start": dt.date(2026, 8, 3), "end": dt.date(2027, 1, 31)}
    assert context["tasks"] == [{"id": task, "title": "Comprar plántulas", "sprint": None}]
    assert [line.id for line in context["budget"].lines] == ["R1", "R2", "R3", "R4"]


def test_an_unknown_line_or_task_from_the_agent_is_cleared_with_a_low_alert(client, budgeted, agents):
    agents.reading = agents.reading.model_copy(update={"budget_line_id": "R9", "task_id": 4242})
    draft = _upload(client, budgeted).json()
    assert draft["budget_line_id"] is None and draft["task_id"] is None and draft["task_title"] is None
    assert [a["level"] for a in draft["alerts"]] == ["low", "low"]


@pytest.mark.parametrize(
    "file", [("nota.txt", b"hola", "text/plain"), ("doc.docx", b"x", "application/vnd.openxmlformats"), ("vacio.pdf", b"", "application/pdf")]
)
def test_upload_rejects_other_types_and_empty_files(client, budgeted, file):
    _error(_upload(client, budgeted, file), 422, "unsupported_file")


def test_upload_rejects_files_over_10_mb_and_a_missing_file(client, budgeted):
    _error(_upload(client, budgeted, ("grande.pdf", b"0" * (10 * 1024 * 1024 + 1), "application/pdf")), 422, "unsupported_file")
    _error(client.post(f"/api/projects/{budgeted}/expenses", data={"other": "x"}, files={"other": ("a.pdf", b"x", "application/pdf")}), 422, "unsupported_file")


def test_a_failing_agent_saves_nothing(client, budgeted, agents):
    agents.fails = True
    _error(_upload(client, budgeted), 502, "agent_unavailable")
    assert client.get(f"/api/projects/{budgeted}/transparency").json()["drafts"] == []


def test_a_member_may_upload_and_an_outsider_may_not(client, budgeted):
    leo = as_new_user(client, "Leo", role="Frontend")
    join(leo, invite_token(client, budgeted))
    assert _upload(leo, budgeted).status_code == 201
    _error(_upload(as_new_user(client, "Eva"), budgeted), 404, "project_not_found")


# ---------- Confirm and discard (US2) ----------


def test_confirm_makes_it_count_and_adds_the_rule_alerts(client, budgeted):
    task = _task(budgeted, "Comprar plántulas")
    draft = _upload(client, budgeted).json()
    response = client.post(
        f"/api/projects/{budgeted}/expenses/{draft['id']}/confirm", json=_confirmation(amount=50_000_000, date="2026-07-01", task_id=task)
    )
    assert response.status_code == 200, response.text
    confirmed = response.json()
    assert confirmed["status"] == "confirmed" and confirmed["task_title"] == "Comprar plántulas"
    assert {(a["level"], a["source"]) for a in confirmed["alerts"]} == {("high", "rule"), ("medium", "rule")}
    portal = client.get(f"/api/projects/{budgeted}/transparency").json()
    assert portal["drafts"] == [] and [e["id"] for e in portal["expenses"]] == [draft["id"]]
    assert portal["summary"]["spent"] == 50_000_000 and portal["summary"]["light"] == "red"


def test_confirm_status_rows(client, budgeted):
    draft = _upload(client, budgeted).json()
    url = f"/api/projects/{budgeted}/expenses/{draft['id']}/confirm"
    _error(client.post(f"/api/projects/{budgeted}/expenses/999/confirm", json=_confirmation()), 404, "expense_not_found")
    error = _error(client.post(url, json=_confirmation(budget_line_id="R9", citizen_summary="")), 422, "validation_failed")
    assert {e["field"] for e in error["errors"]} == {"budget_line_id", "citizen_summary"}
    assert client.post(url, json=_confirmation()).status_code == 200
    _error(client.post(url, json=_confirmation()), 409, "expense_not_draft")


def test_discard_drafts_only(client, budgeted):
    draft = _upload(client, budgeted).json()
    assert client.delete(f"/api/projects/{budgeted}/expenses/{draft['id']}").status_code == 204
    _error(client.delete(f"/api/projects/{budgeted}/expenses/{draft['id']}"), 404, "expense_not_found")
    confirmed = _confirmed(client, budgeted)
    _error(client.delete(f"/api/projects/{budgeted}/expenses/{confirmed['id']}"), 409, "expense_not_draft")


def test_an_expense_of_another_project_is_not_found(client, budgeted):
    other = create_project(client, {**PROJECT, "name": "Otro proyecto"})["id"]
    draft = _upload(client, budgeted).json()
    _error(client.delete(f"/api/projects/{other}/expenses/{draft['id']}"), 404, "expense_not_found")
    _error(client.post(f"/api/projects/{other}/expenses/{draft['id']}/confirm", json=_confirmation()), 404, "expense_not_found")


# ---------- The team's view and the public portal (US3) ----------


def test_team_view_needs_a_budget(client, pid):
    _error(client.get(f"/api/projects/{pid}/transparency"), 409, "budget_missing")


def test_team_view_has_the_numbers_and_the_drafts_apart(client, budgeted):
    _task(budgeted, "Sembrar lote 1", 5, dt.datetime(2026, 9, 15, tzinfo=dt.timezone.utc))
    _task(budgeted, "Sembrar lote 2", 15)
    _confirmed(client, budgeted)
    draft = _upload(client, budgeted).json()
    portal = client.get(f"/api/projects/{budgeted}/transparency").json()
    assert portal["public"] is False and portal["public_url"] is None
    assert [d["id"] for d in portal["drafts"]] == [draft["id"]] and len(portal["expenses"]) == 1
    assert portal["project"]["contracting_entity"] == "Corpamag" and portal["project"]["end_date"] == "2027-01-31"
    summary = portal["summary"]
    assert (summary["spent"], summary["spent_pct"], summary["physical_pct"]) == (30_000_000, 16.7, 25.0)
    assert [(line["id"], line["spent"], line["available"]) for line in portal["lines"]][0] == ("R1", 30_000_000, 15_000_000)
    assert portal["timeline"][0]["week_start"] == "2026-08-03" and portal["timeline"][-1]["week_start"] == "2026-10-19"
    assert any(week["tasks_done"] == [{"id": 1, "title": "Sembrar lote 1"}] for week in portal["timeline"])


def test_publish_needs_a_budget_and_a_leader(client, pid):
    _error(client.put(f"/api/projects/{pid}/publication", json={"public": True}), 409, "budget_missing")
    leo = as_new_user(client, "Leo", role="Frontend")
    join(leo, invite_token(client, pid))
    _error(leo.put(f"/api/projects/{pid}/publication", json={"public": True}), 403, "forbidden")


def test_the_link_is_hard_to_guess_and_survives_unpublishing(client, budgeted):
    first = client.put(f"/api/projects/{budgeted}/publication", json={"public": True}).json()
    slug = first["public_url"].rsplit("/", 1)[1]
    assert first["public"] is True and first["public_url"] == f"/p/{slug}" and len(slug) >= 8
    assert client.put(f"/api/projects/{budgeted}/publication", json={"public": False}).json()["public"] is False
    assert client.put(f"/api/projects/{budgeted}/publication", json={"public": True}).json()["public_url"] == first["public_url"]
    other = create_project(client, {**PROJECT, "name": "Otro"})["id"]
    client.put(f"/api/projects/{other}/budget", json=BUDGET)
    assert _publish(client, other) != slug


def test_anyone_reads_the_published_portal_without_drafts_or_private_data(client, anonymous, budgeted):
    _confirmed(client, budgeted)
    _upload(client, budgeted)
    slug = _publish(client, budgeted)
    response = anonymous.get(f"/api/public/projects/{slug}")
    assert response.status_code == 200, response.text
    portal = response.json()
    assert "drafts" not in portal and len(portal["expenses"]) == 1 and portal["public_url"] == f"/p/{slug}"
    assert portal["expenses"][0]["file_url"].startswith("/api/files/")
    text = response.text
    assert "@team.dev" not in text and "hours_per_week" not in text and "members" not in portal


def test_unknown_and_unpublished_links_are_not_found(client, anonymous, budgeted):
    _error(anonymous.get("/api/public/projects/nope"), 404, "project_not_found")
    slug = _publish(client, budgeted)
    client.put(f"/api/projects/{budgeted}/publication", json={"public": False})
    _error(anonymous.get(f"/api/public/projects/{slug}"), 404, "project_not_found")
    client.put(f"/api/projects/{budgeted}/publication", json={"public": True})
    assert anonymous.get(f"/api/public/projects/{slug}").status_code == 200


def test_the_question_is_validated_before_anything_else(client, anonymous, budgeted):
    slug = _publish(client, budgeted)
    for question in ("", "x" * 301):
        _error(anonymous.post(f"/api/public/projects/{slug}/ask", json={"question": question}), 422, "validation_failed")


# ---------- Answering alerts (US5) ----------


def _alerted(client, pid: int) -> dict:
    return _confirmed(client, pid, amount=50_000_000)["alerts"][0]


def test_the_leader_answers_and_the_alert_stays_and_still_counts(client, anonymous, budgeted):
    alert = _alerted(client, budgeted)
    slug = _publish(client, budgeted)
    response = client.post(f"/api/projects/{budgeted}/alerts/{alert['id']}/answer", json={"answer": "  Se reclasificó a logística.  "})
    assert response.status_code == 200, response.text
    answered = response.json()
    assert answered["answer"] == "Se reclasificó a logística." and answered["answered_at"] and answered["level"] == "high"
    public = anonymous.get(f"/api/public/projects/{slug}").json()
    assert [(a["id"], a["answer"]) for a in public["alerts"]] == [(alert["id"], "Se reclasificó a logística.")]
    assert public["summary"]["light"] == "red"


def test_answer_status_rows(client, budgeted):
    alert = _alerted(client, budgeted)
    url = f"/api/projects/{budgeted}/alerts/{alert['id']}/answer"
    _error(client.post(f"/api/projects/{budgeted}/alerts/999/answer", json={"answer": "x"}), 404, "alert_not_found")
    _error(client.post(url, json={"answer": "   "}), 422, "validation_failed")
    _error(client.post(url, json={"answer": "x" * 501}), 422, "validation_failed")
    other = create_project(client, {**PROJECT, "name": "Otro"})["id"]
    _error(client.post(f"/api/projects/{other}/alerts/{alert['id']}/answer", json={"answer": "x"}), 404, "alert_not_found")


def test_a_member_cannot_answer_and_a_draft_alert_cannot_be_answered(client, budgeted, agents):
    alert = _alerted(client, budgeted)
    leo = as_new_user(client, "Leo", role="Frontend")
    join(leo, invite_token(client, budgeted))
    _error(leo.post(f"/api/projects/{budgeted}/alerts/{alert['id']}/answer", json={"answer": "x"}), 403, "forbidden")
    agents.reading = agents.reading.model_copy(update={"alerts": [AlertDraft(level="medium", reason="Revisar.")]})
    draft_alert = _upload(client, budgeted).json()["alerts"][0]
    _error(client.post(f"/api/projects/{budgeted}/alerts/{draft_alert['id']}/answer", json={"answer": "x"}), 404, "alert_not_found")


# ---------- Files (US2, US3) ----------


def test_members_read_any_file_of_their_project(client, budgeted):
    draft = _upload(client, budgeted).json()
    response = client.get(draft["file_url"])
    assert response.status_code == 200 and response.content == PDF[1]
    assert response.headers["content-type"] == "application/pdf" and response.headers["x-content-type-options"] == "nosniff"


def test_the_public_only_reads_the_evidence_of_a_published_portal(client, anonymous, budgeted):
    draft = _upload(client, budgeted).json()
    confirmed = _confirmed(client, budgeted)
    _error(anonymous.get(draft["file_url"]), 404, "file_not_found")  # a draft
    _error(anonymous.get(confirmed["file_url"]), 404, "file_not_found")  # not published yet
    _publish(client, budgeted)
    assert anonymous.get(confirmed["file_url"]).content == PDF[1]
    _error(anonymous.get(draft["file_url"]), 404, "file_not_found")
    _error(as_new_user(client, "Eva").get(draft["file_url"]), 404, "file_not_found")  # signed in, not a member
    _error(client.get("/api/files/999"), 404, "file_not_found")
    client.put(f"/api/projects/{budgeted}/publication", json={"public": False})
    _error(anonymous.get(confirmed["file_url"]), 404, "file_not_found")
