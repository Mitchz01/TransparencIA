"""Every status row of spec 001's API Contract, as changed by spec 015 (the team comes from accounts)."""

from tests.api import as_new_user, create_project

BODY = {"name": "Agile Planner", "description": "Jira-like tool where AI agents plan the work."}


def _create(client, **overrides):
    response = client.post("/api/projects", json={**BODY, "role": "Backend", **overrides})
    assert response.status_code == 201, response.text
    return response.json()


def test_create_returns_201_with_location_defaults_and_its_creator_as_leader(client):
    client.patch("/api/me", json={"role": "Backend", "seniority": "senior", "hours_per_week": 30, "skills": ["python"]})
    response = client.post("/api/projects", json=BODY)
    assert response.status_code == 201
    project = response.json()
    assert response.headers["Location"] == f"/api/projects/{project['id']}"
    assert project["status"] == "draft" and project["requested_methodology"] == "auto" and project["plan"] is None
    assert project["duration_weeks"] == 8 and project["auto_approve"] is False
    [ana] = project["members"]
    me = client.get("/api/me").json()
    assert (ana["name"], ana["role"], ana["seniority"], ana["hours_per_week"], ana["skills"]) == ("Ana", "Backend", "senior", 30, ["python"])
    assert ana["account_id"] == me["id"] and ana["permission"] == "leader"
    assert "invite_token" not in project  # only leaders read it, from GET /invitation
    assert project["created_at"].endswith("Z") or project["created_at"].endswith("+00:00")


def test_create_422_lists_every_failing_field(client):
    response = client.post("/api/projects", json={"name": " ", "description": "x", "duration_weeks": 0, "requested_methodology": "waterfall"})
    assert response.status_code == 422
    error = response.json()
    assert error["code"] == "validation_failed" and error["detail"]
    # Schema errors come first (types, enums, required fields); domain rules only run on a readable body.
    assert {e["field"]: e["message"] for e in error["errors"]} == {
        "requested_methodology": "Must be one of: auto, scrum, kanban, scrumban, xp, shape_up."
    }

    # Ana's profile has no role yet, so the project needs one
    no_role = client.post("/api/projects", json=BODY)
    assert no_role.status_code == 422 and no_role.json()["errors"] == [{"field": "role", "message": "Required."}]

    response = client.post("/api/projects", json={**BODY, "role": "Backend", "name": " ", "duration_weeks": 0})
    fields = {e["field"]: e["message"] for e in response.json()["errors"]}
    assert fields == {"name": "Required.", "duration_weeks": "Must be between 1 and 52."}
    assert client.get("/api/projects").json() == []


def test_400_when_the_body_isnt_json(client):
    response = client.post("/api/projects", content=b"{not json", headers={"Content-Type": "application/json"})
    assert response.status_code == 400 and response.json()["code"] == "malformed_request"

    response = client.post("/api/projects", content=b"name=x", headers={"Content-Type": "application/x-www-form-urlencoded"})
    assert response.status_code == 400 and response.json()["code"] == "malformed_request"


def test_list_and_get_only_my_projects(client):
    first = _create(client, name="First")
    second = _create(client, name="Second")
    summaries = client.get("/api/projects").json()
    assert [s["id"] for s in summaries] == [second["id"], first["id"]]
    assert set(summaries[0]) == {"id", "name", "status", "duration_weeks", "member_count", "created_at", "permission"}
    assert summaries[0]["permission"] == "leader"

    assert client.get(f"/api/projects/{first['id']}").json() == first
    missing = client.get("/api/projects/9999")
    assert missing.status_code == 404 and missing.json()["code"] == "project_not_found"

    leo = as_new_user(client, "Leo", role="Frontend")
    assert leo.get("/api/projects").json() == []
    outsider = leo.get(f"/api/projects/{first['id']}")
    assert outsider.status_code == 404 and outsider.json()["code"] == "project_not_found"


def test_patch_edits_the_project_not_the_team(client):
    project = create_project(client, {**BODY, "members": [{"name": "Ana", "role": "Backend"}, {"name": "Leo", "role": "QA"}]})
    response = client.patch(f"/api/projects/{project['id']}", json={"description": "New", "members": []})
    assert response.status_code == 200, response.text
    edited = response.json()
    assert edited["description"] == "New" and edited["name"] == project["name"] and edited["members"] == project["members"]
    assert client.get(f"/api/projects/{project['id']}").json() == edited


def test_patch_errors(client):
    project = _create(client)
    url = f"/api/projects/{project['id']}"

    empty = client.patch(url, json={})
    assert empty.status_code == 422 and empty.json()["errors"] == [{"field": "", "message": "No fields to update."}]
    assert client.patch("/api/projects/9999", json={"name": "X"}).json()["code"] == "project_not_found"
    assert client.patch(url, content=b"{", headers={"Content-Type": "application/json"}).status_code == 400
    assert client.get(url).json() == project  # nothing was saved


def test_patch_methodology_locked(client):
    from sqlmodel import Session

    from app.adapters.outbound.persistence.db import engine
    from app.adapters.outbound.persistence.tables import ProjectTable

    project = _create(client)
    with Session(engine) as session:
        row = session.get(ProjectTable, project["id"])
        row.status = "planning"
        session.add(row)
        session.commit()

    response = client.patch(f"/api/projects/{project['id']}", json={"requested_methodology": "kanban"})
    assert response.status_code == 409 and response.json()["code"] == "methodology_locked"
