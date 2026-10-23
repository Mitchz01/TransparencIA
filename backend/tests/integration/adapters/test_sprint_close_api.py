"""Spec 008's API Contract: POST /api/sprints/{id}/close and the automatic replans (US4);
spec 003's 409 sprint_closed on PATCH /api/tasks/{id}, now that sprints can close."""

import asyncio
import time

from sqlmodel import Session

from app.adapters.inbound.http.dependencies import open_uow
from app.adapters.outbound.agents.mock.data import MOCK_PLAN
from app.adapters.outbound.persistence.db import engine
from app.adapters.outbound.persistence.tables import ProjectTable
from app.application.use_cases.planning.apply_plan import ApplyPlan
from tests.fakes import RecordingEventBus

PROJECT = {
    "name": "Agile Planner",
    "description": "Plans the work.",
    "auto_approve": True,  # automatic replans wait for the leader anyway (FR-016)
    "members": [{"name": "Ana", "role": "Backend"}, {"name": "Leo", "role": "Frontend"}],
}


def _ready(client) -> tuple[int, dict]:
    pid = client.post("/api/projects", json=PROJECT).json()["id"]
    with Session(engine) as session:
        row = session.get(ProjectTable, pid)
        row.plan = MOCK_PLAN
        session.add(row)
        session.commit()
    asyncio.run(ApplyPlan(open_uow, RecordingEventBus()).execute(pid))
    return pid, client.get(f"/api/projects/{pid}/board").json()


def _wait_for(check, attempts: int = 200):
    for _ in range(attempts):
        value = check()
        if value:
            return value
        time.sleep(0.01)
    raise AssertionError("background work didn't finish")


def _replans(client, pid: int) -> list[dict]:
    return [p for p in client.get(f"/api/projects/{pid}/proposals").json() if p["kind"] == "replan"]


def _assert_error(response, status: int, code: str):
    assert response.status_code == status, response.text
    assert response.json()["code"] == code


def test_closing_with_pending_tasks_proposes_an_automatic_replan(client):
    pid, board = _ready(client)
    sprint = board["sprints"][0]
    us2 = next(t for t in board["tasks"] if t["key"] == "US-2")
    client.patch(f"/api/tasks/{us2['id']}", json={"status": "done"})

    response = client.post(f"/api/sprints/{sprint['id']}/close")

    assert response.status_code == 200
    body = response.json()
    assert body["pending_task_keys"] == ["US-1", "US-3", "US-4"] and body["replan_proposed"] is True
    assert body["sprint"]["id"] == sprint["id"] and body["sprint"]["closed"] is True
    assert body["sprint"]["end_date"] == sprint["end_date"] and sprint["end_date"] is not None
    [replan] = _wait_for(lambda: _replans(client, pid))
    assert (replan["status"], replan["origin"], replan["auto_approved"]) == ("pending", "automatic", False)
    assert "US-1, US-3, US-4" in replan["content"]["reason"]
    activity = client.get(f"/api/projects/{pid}/activity").json()
    assert any(e["type"] == "sprint_closed" and e["pending_task_keys"] == ["US-1", "US-3", "US-4"] for e in activity)
    board = client.get(f"/api/projects/{pid}/board").json()
    assert board["sprints"][0]["closed"] is True


def test_closing_a_finished_sprint_proposes_nothing(client):
    pid, board = _ready(client)
    sprint = board["sprints"][2]
    for task in [t for t in board["tasks"] if t["sprint_id"] == sprint["id"]]:
        client.patch(f"/api/tasks/{task['id']}", json={"status": "done"})
    body = client.post(f"/api/sprints/{sprint['id']}/close").json()
    assert (body["pending_task_keys"], body["replan_proposed"]) == ([], False)
    time.sleep(0.05)
    assert _replans(client, pid) == []


def test_unknown_sprint(client):
    _assert_error(client.post("/api/sprints/999/close"), 404, "sprint_not_found")


def test_already_closed(client):
    _, board = _ready(client)
    sprint_id = board["sprints"][0]["id"]
    assert client.post(f"/api/sprints/{sprint_id}/close").status_code == 200
    _assert_error(client.post(f"/api/sprints/{sprint_id}/close"), 409, "sprint_already_closed")


def test_moving_a_task_into_a_closed_sprint_is_a_conflict(client):
    _, board = _ready(client)
    closed, open_ = board["sprints"][0], board["sprints"][1]
    assert client.post(f"/api/sprints/{closed['id']}/close").status_code == 200
    task = next(t for t in board["tasks"] if t["sprint_id"] == open_["id"])

    _assert_error(client.patch(f"/api/tasks/{task['id']}", json={"sprint_id": closed["id"]}), 409, "sprint_closed")
    _assert_error(
        client.patch(f"/api/tasks/{task['id']}", json={"sprint_id": closed["id"], "title": "Edited"}), 409, "sprint_closed"
    )
    assert next(t for t in client.get(f"/api/projects/{board['project_id']}/board").json()["tasks"] if t["id"] == task["id"]) == task

    # Work already in the closed sprint can still move between columns
    pending = next(t for t in board["tasks"] if t["sprint_id"] == closed["id"])
    assert client.patch(f"/api/tasks/{pending['id']}", json={"status": "done"}).status_code == 200


def test_a_team_change_with_an_applied_plan_proposes_an_automatic_replan(client):
    pid, _ = _ready(client)
    ana, leo = client.get(f"/api/projects/{pid}").json()["members"]
    # Renaming (or changing skills) doesn't matter for the plan; `members` is the whole new team
    renamed = [{"id": ana["id"], "name": "Ana Gómez", "skills": ["Python"]}, {"id": leo["id"]}]
    assert client.patch(f"/api/projects/{pid}", json={"members": renamed}).status_code == 200
    time.sleep(0.05)
    assert _replans(client, pid) == []

    response = client.patch(f"/api/projects/{pid}", json={"members": [{"id": ana["id"]}, {"name": "Sofía", "role": "QA"}]})
    assert response.status_code == 200
    [replan] = _wait_for(lambda: _replans(client, pid))
    assert replan["origin"] == "automatic" and replan["status"] == "pending"
    assert replan["content"]["reason"] == "The team changed: Sofía joined; Leo left."


def test_a_team_change_before_the_plan_is_applied_proposes_nothing(client):
    pid = client.post("/api/projects", json=PROJECT).json()["id"]
    leo_less = [{"id": client.get(f"/api/projects/{pid}").json()["members"][0]["id"]}]
    assert client.patch(f"/api/projects/{pid}", json={"members": leo_less}).status_code == 200
    time.sleep(0.05)
    assert _replans(client, pid) == []
