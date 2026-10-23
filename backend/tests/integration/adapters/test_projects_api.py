"""Every status row of spec 001's API Contract."""

BODY = {
    "name": "Agile Planner",
    "description": "Jira-like tool where AI agents plan the work.",
    "members": [
        {"name": "Ana Gómez", "role": "Backend", "seniority": "senior", "hours_per_week": 30, "skills": ["python"]},
        {"name": "Leo Ruiz", "role": "Frontend"},
    ],
}


def _create(client, **overrides):
    response = client.post("/api/projects", json={**BODY, **overrides})
    assert response.status_code == 201, response.text
    return response.json()


def test_create_returns_201_with_location_and_defaults(client):
    response = client.post("/api/projects", json=BODY)
    assert response.status_code == 201
    project = response.json()
    assert response.headers["Location"] == f"/api/projects/{project['id']}"
    assert project["status"] == "draft" and project["requested_methodology"] == "auto" and project["plan"] is None
    assert project["duration_weeks"] == 8 and project["auto_approve"] is False
    leo = project["members"][1]
    assert (leo["seniority"], leo["hours_per_week"], leo["skills"]) == ("mid", 20, [])
    assert project["created_at"].endswith("Z") or project["created_at"].endswith("+00:00")


def test_create_422_lists_every_failing_field(client):
    body = {
        "name": " ",
        "description": "x",
        "duration_weeks": 0,
        "requested_methodology": "waterfall",
        "members": [{"name": "Ana", "role": "Dev"}, {"name": "ana", "hours_per_week": 70}],
    }
    response = client.post("/api/projects", json=body)
    assert response.status_code == 422
    error = response.json()
    assert error["code"] == "validation_failed" and error["detail"]
    fields = {e["field"]: e["message"] for e in error["errors"]}
    # Schema errors come first (types, enums, required fields); domain rules only run on a readable body.
    assert fields == {
        "requested_methodology": "Must be one of: auto, scrum, kanban, scrumban, xp, shape_up.",
        "members[1].role": "Required.",
    }

    response = client.post("/api/projects", json={**BODY, "name": " ", "duration_weeks": 0, "members": []})
    fields = {e["field"]: e["message"] for e in response.json()["errors"]}
    assert fields == {
        "name": "Required.",
        "duration_weeks": "Must be between 1 and 52.",
        "members": "The team needs at least one member.",
    }
    assert client.get("/api/projects").json() == []


def test_400_when_the_body_isnt_json(client):
    response = client.post("/api/projects", content=b"{not json", headers={"Content-Type": "application/json"})
    assert response.status_code == 400 and response.json()["code"] == "malformed_request"

    response = client.post("/api/projects", content=b"name=x", headers={"Content-Type": "application/x-www-form-urlencoded"})
    assert response.status_code == 400 and response.json()["code"] == "malformed_request"


def test_list_and_get(client):
    first = _create(client, name="First")
    second = _create(client, name="Second")
    summaries = client.get("/api/projects").json()
    assert [s["id"] for s in summaries] == [second["id"], first["id"]]
    assert set(summaries[0]) == {"id", "name", "status", "duration_weeks", "member_count", "created_at"}

    assert client.get(f"/api/projects/{first['id']}").json() == first
    missing = client.get("/api/projects/9999")
    assert missing.status_code == 404 and missing.json()["code"] == "project_not_found"


def test_patch_edits_the_team(client):
    project = _create(client)
    ana = project["members"][0]
    response = client.patch(
        f"/api/projects/{project['id']}",
        json={"description": "New", "members": [{"id": ana["id"], "hours_per_week": 25}, {"name": "Sofía Paz", "role": "QA"}]},
    )
    assert response.status_code == 200, response.text
    edited = response.json()
    assert edited["description"] == "New" and edited["name"] == project["name"]
    assert [(m["name"], m["hours_per_week"]) for m in edited["members"]] == [("Ana Gómez", 25), ("Sofía Paz", 20)]
    assert client.get(f"/api/projects/{project['id']}").json() == edited


def test_patch_errors(client):
    project = _create(client)
    url = f"/api/projects/{project['id']}"

    empty = client.patch(url, json={})
    assert empty.status_code == 422 and empty.json()["errors"] == [{"field": "", "message": "No fields to update."}]

    unknown = client.patch(url, json={"members": [{"id": 9999, "name": "X", "role": "Y"}]})
    assert unknown.status_code == 422 and {"field": "members[0].id", "message": "Unknown member."} in unknown.json()["errors"]

    assert client.patch("/api/projects/9999", json={"name": "X"}).json()["code"] == "project_not_found"
    assert client.patch(url, content=b"{", headers={"Content-Type": "application/json"}).status_code == 400
    assert client.get(url).json() == project  # nothing was saved


def test_patch_methodology_locked(client, monkeypatch):
    from app.adapters.outbound.persistence.db import engine
    from sqlmodel import Session

    from app.adapters.outbound.persistence.tables import ProjectTable

    project = _create(client)
    with Session(engine) as session:
        row = session.get(ProjectTable, project["id"])
        row.status = "planning"
        session.add(row)
        session.commit()

    response = client.patch(f"/api/projects/{project['id']}", json={"requested_methodology": "kanban"})
    assert response.status_code == 409 and response.json()["code"] == "methodology_locked"
