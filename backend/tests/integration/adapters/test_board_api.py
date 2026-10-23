"""Spec 003's API Contract: GET /board, PATCH /tasks/{id}, PUT /tasks/{id}/checklist, PUT /capacity."""

PROJECT = {
    "name": "Agile Planner",
    "description": "Plans the work.",
    "members": [
        {"name": "Ana", "role": "Backend", "seniority": "senior", "hours_per_week": 30},
        {"name": "Leo", "role": "Frontend", "hours_per_week": 20},
    ],
}


def _create(client, **overrides) -> int:
    return client.post("/api/projects", json={**PROJECT, **overrides}).json()["id"]


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
    response = client.get("/api/projects/999/board")
    assert response.status_code == 404
    assert response.json()["code"] == "project_not_found"
