"""Spec 003's API Contract: GET /board, PATCH /tasks/{id}, PUT /tasks/{id}/checklist, PUT /capacity;
spec 014's POST /projects/{id}/tasks."""

import asyncio

from sqlmodel import Session

from app.adapters.inbound.http.dependencies import open_uow
from app.adapters.outbound.agents.mock.data import MOCK_PLAN
from app.adapters.outbound.persistence.db import engine
from app.adapters.outbound.persistence.tables import ProjectTable
from app.application.use_cases.planning.apply_plan import ApplyPlan
from tests.fakes import RecordingEventBus
from tests.api import create_project

PROJECT = {
    "name": "Agile Planner",
    "description": "Plans the work.",
    "members": [
        {"name": "Ana", "role": "Backend", "seniority": "senior", "hours_per_week": 30},
        {"name": "Leo", "role": "Frontend", "hours_per_week": 20},
    ],
}
KANBAN = {**MOCK_PLAN, "methodology": {**MOCK_PLAN["methodology"], "methodology": "kanban"}}


def _create(client, **overrides) -> int:
    return create_project(client, {**PROJECT, **overrides})["id"]


def _with_board(client, plan=MOCK_PLAN) -> tuple[int, dict]:
    """Creates a project, stores the approved plan and runs ApplyPlan like spec 002 will.
    Returns the project id and its board."""
    pid = _create(client)
    with Session(engine) as session:
        row = session.get(ProjectTable, pid)
        row.plan = plan
        session.add(row)
        session.commit()
    asyncio.run(ApplyPlan(open_uow, RecordingEventBus()).execute(pid))
    return pid, client.get(f"/api/projects/{pid}/board").json()


def _task(board: dict, key: str) -> dict:
    return next(t for t in board["tasks"] if t["key"] == key)


def _patch(client, task_id: int, body):
    return client.patch(f"/api/tasks/{task_id}", json=body)


def _assert_error(response, status: int, code: str):
    assert response.status_code == status, response.json()
    assert response.json()["code"] == code


def _assert_validation(response, *fields: str):
    _assert_error(response, 422, "validation_failed")
    assert [e["field"] for e in response.json()["errors"]] == list(fields)


def _assert_not_json(client, method: str, url: str):
    response = client.request(method, url, content="{not json", headers={"Content-Type": "application/json"})
    _assert_error(response, 400, "malformed_request")
    response = client.request(method, url, content="x=1", headers={"Content-Type": "text/plain"})
    _assert_error(response, 400, "malformed_request")


# ---------- GET /api/projects/{id}/board ----------


def test_board_is_empty_until_the_plan_is_applied(client):
    pid = _create(client)
    response = client.get(f"/api/projects/{pid}/board")
    assert response.status_code == 200
    assert response.json() == {
        "project_id": pid,
        "continuous": False,
        "wip_limits": [],
        "capacity_override": None,
        "sprints": [],
        "objectives": [],
        "tasks": [],
    }


def test_board_of_unknown_project(client):
    _assert_error(client.get("/api/projects/999/board"), 404, "project_not_found")


def test_board_after_applying_the_plan(client):
    pid, board = _with_board(client)
    assert client.get(f"/api/projects/{pid}").json()["status"] == "ready"
    assert board["continuous"] is False
    assert board["wip_limits"] == [{"column": "in_progress", "limit": 3}, {"column": "review", "limit": 2}]
    sprint = board["sprints"][0]
    assert {k: sprint[k] for k in ("number", "name", "goal", "phase")} == {
        "number": 1, "name": "Sprint 1", "goal": "Base ready", "phase": "Foundations"
    }
    # Ana senior 30 h + Leo mid 20 h, 2-week sprints: 15 + 6 points
    assert sprint["load"] == {"points": 11, "capacity": 21, "overloaded": False}
    assert board["sprints"][1]["load"] == {"points": 23, "capacity": 21, "overloaded": True}
    assert [(o["sprint_id"], o["title"], o["done"]) for o in board["objectives"]] == [
        (s["id"], s["goal"], False) for s in board["sprints"]
    ]
    task = _task(board, "US-1")
    assert set(task) == {
        "id", "project_id", "sprint_id", "assignee_id", "key", "epic_key", "title", "description",
        "acceptance_criteria", "checklist", "type", "points", "priority", "status", "position", "missing_role",
        "issue",  # spec 007: null until the task is published
        "done_at",  # spec 017: null until the task is done
    }
    assert task["issue"] is None
    assert task["done_at"] is None
    assert (task["status"], task["assignee_id"], task["missing_role"]) == ("todo", None, "DevOps")
    assert task["checklist"] == [{"text": "Works on desktop and mobile", "done": False}, {"text": "Has basic tests", "done": False}]


def test_kanban_board_is_continuous(client):
    _, board = _with_board(client, KANBAN)
    assert board["continuous"] is True
    assert len(board["sprints"]) == 3 and all(s["load"] is None for s in board["sprints"])


# ---------- PATCH /api/tasks/{id}: move ----------


def test_move_is_saved_and_published(client):
    pid, board = _with_board(client)
    task = _task(board, "US-3")

    response = _patch(client, task["id"], {"status": "in_progress", "position": 0})

    assert response.status_code == 200
    body = response.json()
    assert (body["task"]["status"], body["task"]["position"]) == ("in_progress", 0)
    assert body["warnings"] == [] and body["suggest_advance"] is False
    reloaded = client.get(f"/api/projects/{pid}/board").json()
    assert _task(reloaded, "US-3")["status"] == "in_progress"
    todo = sorted((t for t in reloaded["tasks"] if t["sprint_id"] == task["sprint_id"] and t["status"] == "todo"), key=lambda t: t["position"])
    assert [(t["key"], t["position"]) for t in todo] == [("US-1", 0), ("US-2", 1), ("US-4", 2)]
    activity = client.get(f"/api/projects/{pid}/activity").json()
    assert activity[0]["type"] == "task_status_changed" and activity[0]["task_id"] == task["id"]


def test_move_over_the_wip_limit_returns_a_warning(client):
    _, board = _with_board(client)
    for key in ("US-5", "US-6", "US-7"):
        _patch(client, _task(board, key)["id"], {"status": "in_progress"})
    response = _patch(client, _task(board, "US-8")["id"], {"status": "in_progress"})
    assert response.status_code == 200
    assert response.json()["task"]["status"] == "in_progress"
    assert {"code": "wip_limit_exceeded", "column": "in_progress", "limit": 3, "count": 4} in response.json()["warnings"]


def test_move_to_another_sprint_or_the_backlog(client):
    pid, board = _with_board(client)
    sprint_1, sprint_2 = board["sprints"][0]["id"], board["sprints"][1]["id"]
    task = _task(board, "US-3")
    _patch(client, task["id"], {"status": "review"})

    response = _patch(client, task["id"], {"sprint_id": sprint_2})

    assert response.status_code == 200
    body = response.json()
    assert (body["task"]["sprint_id"], body["task"]["status"]) == (sprint_2, "todo")
    assert body["warnings"] == [{"code": "sprint_overloaded", "sprint_id": sprint_2, "points": 26, "capacity": 21}]
    loads = {s["id"]: s["load"]["points"] for s in client.get(f"/api/projects/{pid}/board").json()["sprints"]}
    assert (loads[sprint_1], loads[sprint_2]) == (8, 26)

    body = _patch(client, task["id"], {"sprint_id": None}).json()
    assert (body["task"]["sprint_id"], body["task"]["status"]) == (None, "backlog")


def test_patch_unknown_task(client):
    _assert_error(_patch(client, 999, {"status": "done"}), 404, "task_not_found")


def test_patch_body_not_json(client):
    _, board = _with_board(client)
    _assert_not_json(client, "PATCH", f"/api/tasks/{_task(board, 'US-1')['id']}")


def test_patch_validation_saves_nothing(client):
    pid, board = _with_board(client)
    task = _task(board, "US-1")
    other = _create(client)
    other_member = client.get(f"/api/projects/{other}").json()["members"][0]["id"]

    _assert_validation(_patch(client, task["id"], {}), "")
    _assert_validation(_patch(client, task["id"], {"status": "blocked"}), "status")
    _assert_validation(_patch(client, task["id"], {"priority": "urgent"}), "priority")
    _assert_validation(_patch(client, task["id"], {"position": -1}), "position")
    _assert_validation(_patch(client, task["id"], {"points": 101}), "points")
    _assert_validation(_patch(client, task["id"], {"points": 2.5}), "points")
    _assert_validation(_patch(client, task["id"], {"title": " "}), "title")
    _assert_validation(_patch(client, task["id"], {"title": "x" * 201}), "title")
    _assert_validation(_patch(client, task["id"], {"sprint_id": 99999}), "sprint_id")
    _assert_validation(_patch(client, task["id"], {"assignee_id": other_member}), "assignee_id")
    _assert_validation(_patch(client, task["id"], {"status": "done", "title": ""}), "title")

    assert _task(client.get(f"/api/projects/{pid}/board").json(), "US-1") == task


# ---------- POST /api/projects/{id}/tasks (spec 014) ----------


def test_create_task_at_the_end_of_its_column(client):
    pid, board = _with_board(client)
    sprint = board["sprints"][0]
    todo = [t for t in board["tasks"] if t["sprint_id"] == sprint["id"] and t["status"] == "todo"]
    highest = max(int(t["key"].removeprefix("US-")) for t in board["tasks"])

    response = client.post(f"/api/projects/{pid}/tasks", json={"title": "Fix checkout copy", "sprint_id": sprint["id"], "priority": "high"})

    assert response.status_code == 201, response.json()
    body = response.json()
    task = body["task"]
    assert response.headers["Location"] == f"/api/tasks/{task['id']}"
    assert (task["key"], task["title"], task["status"], task["position"], task["priority"], task["points"]) == (
        f"US-{highest + 1}", "Fix checkout copy", "todo", len(todo), "high", 1,
    )
    assert body["suggest_advance"] is False
    assert _task(client.get(f"/api/projects/{pid}/board").json(), task["key"])["id"] == task["id"]
    event = client.get(f"/api/projects/{pid}/activity").json()[0]
    assert (event["type"], event["task_id"], event["key"], event["summary"]) == ("task_created", task["id"], task["key"], f"{task['key']} created")


def test_create_task_errors(client):
    pid, board = _with_board(client)
    url = f"/api/projects/{pid}/tasks"
    _assert_validation(client.post(url, json={}), "title")
    _assert_validation(client.post(url, json={"title": "x" * 201}), "title")
    _assert_validation(client.post(url, json={"title": "Ok", "status": "blocked"}), "status")
    _assert_validation(client.post(url, json={"title": "Ok", "points": 101, "sprint_id": 99999}), "points", "sprint_id")
    _assert_validation(client.post(url, json={"title": "Ok", "epic_key": "E" * 21}), "epic_key")
    _assert_not_json(client, "POST", url)
    _assert_error(client.post("/api/projects/99999/tasks", json={"title": "Ok"}), 404, "project_not_found")
    assert len(client.get(f"/api/projects/{pid}/board").json()["tasks"]) == len(board["tasks"])

    sprint = board["sprints"][0]
    assert client.post(f"/api/sprints/{sprint['id']}/close").status_code == 200
    _assert_error(client.post(url, json={"title": "Late", "sprint_id": sprint["id"]}), 409, "sprint_closed")


# ---------- PATCH /api/tasks/{id}: edit ----------


def test_edit_is_saved_and_published(client):
    pid, board = _with_board(client)
    task = _task(board, "US-1")  # missing role "DevOps"
    ana = client.get(f"/api/projects/{pid}").json()["members"][0]["id"]
    body = {"title": "Set up repo, CI and CD", "description": "…", "points": 5, "priority": "low", "assignee_id": ana}

    response = _patch(client, task["id"], body)

    assert response.status_code == 200
    saved = response.json()["task"]
    assert {k: saved[k] for k in body} == body
    assert saved["missing_role"] is None
    assert _task(client.get(f"/api/projects/{pid}/board").json(), "US-1") == saved
    activity = client.get(f"/api/projects/{pid}/activity").json()
    assert activity[0]["type"] == "task_updated" and activity[0]["task_id"] == task["id"]


def test_edit_and_move_in_one_request(client):
    pid, board = _with_board(client)
    task = _task(board, "US-2")
    response = _patch(client, task["id"], {"priority": "low", "status": "in_progress", "assignee_id": None})
    assert response.status_code == 200
    saved = response.json()["task"]
    assert (saved["priority"], saved["status"], saved["assignee_id"]) == ("low", "in_progress", None)
    types = [e["type"] for e in client.get(f"/api/projects/{pid}/activity").json()[:2]]
    assert types == ["task_status_changed", "task_updated"]  # newest first


# ---------- PUT /api/tasks/{id}/checklist ----------


def test_replace_checklist(client):
    pid, board = _with_board(client)
    task = _task(board, "US-1")
    items = [{"text": "Form validates fields", "done": True}, {"text": "Has tests", "done": False}]

    response = client.put(f"/api/tasks/{task['id']}/checklist", json={"items": items})

    assert response.status_code == 200
    assert response.json() == {"task": {**task, "checklist": items}, "warnings": [], "suggest_advance": False}
    assert _task(client.get(f"/api/projects/{pid}/board").json(), "US-1")["checklist"] == items
    assert client.get(f"/api/projects/{pid}/activity").json()[0]["type"] == "task_updated"


def test_complete_checklist_in_progress_suggests_advancing(client):
    _, board = _with_board(client)
    task = _task(board, "US-1")
    _patch(client, task["id"], {"status": "in_progress"})
    response = client.put(f"/api/tasks/{task['id']}/checklist", json={"items": [{"text": "Done", "done": True}]})
    assert response.json()["suggest_advance"] is True
    assert response.json()["task"]["status"] == "in_progress"


def test_checklist_errors(client):
    pid, board = _with_board(client)
    task = _task(board, "US-1")
    url = f"/api/tasks/{task['id']}/checklist"

    _assert_not_json(client, "PUT", url)
    _assert_error(client.put("/api/tasks/999/checklist", json={"items": []}), 404, "task_not_found")
    _assert_validation(client.put(url, json={}), "items")
    _assert_validation(client.put(url, json={"items": [{"text": "ok"}, {"text": ""}, {"text": "x" * 301}]}), "items[1].text", "items[2].text")
    _assert_validation(client.put(url, json={"items": [{"text": f"step {i}"} for i in range(51)]}), "items")

    assert _task(client.get(f"/api/projects/{pid}/board").json(), "US-1") == task


# ---------- PUT /api/projects/{id}/capacity ----------


def test_set_and_clear_the_capacity_override(client):
    pid, board = _with_board(client)
    ids = [s["id"] for s in board["sprints"]]

    response = client.put(f"/api/projects/{pid}/capacity", json={"points_per_sprint": 20})

    assert response.status_code == 200
    assert response.json() == {
        "capacity_override": 20,
        "sprints": [
            {"id": ids[0], "load": {"points": 11, "capacity": 20, "overloaded": False}},
            {"id": ids[1], "load": {"points": 23, "capacity": 20, "overloaded": True}},
            {"id": ids[2], "load": {"points": 13, "capacity": 20, "overloaded": False}},
        ],
    }
    assert client.get(f"/api/projects/{pid}/board").json()["capacity_override"] == 20

    response = client.put(f"/api/projects/{pid}/capacity", json={"points_per_sprint": None})
    assert response.status_code == 200
    assert response.json()["capacity_override"] is None
    assert response.json()["sprints"][0]["load"]["capacity"] == 21


def test_capacity_errors(client):
    pid, _ = _with_board(client)
    url = f"/api/projects/{pid}/capacity"

    _assert_not_json(client, "PUT", url)
    _assert_error(client.put("/api/projects/999/capacity", json={"points_per_sprint": 20}), 404, "project_not_found")
    kanban, _ = _with_board(client, KANBAN)
    _assert_error(client.put(f"/api/projects/{kanban}/capacity", json={"points_per_sprint": 20}), 409, "capacity_not_applicable")
    for bad in ({}, {"points_per_sprint": 0}, {"points_per_sprint": 501}, {"points_per_sprint": 2.5}, {"points_per_sprint": "a"}):
        _assert_validation(client.put(url, json=bad), "points_per_sprint")

    assert client.get(f"/api/projects/{pid}/board").json()["capacity_override"] is None
