"""Spec 015's API Contract: the invitation link, joining, leader and member permissions, and the team."""

import asyncio

import pytest
from sqlmodel import Session

from app.adapters.inbound.http.dependencies import open_uow
from app.adapters.outbound.agents.mock.data import MOCK_PLAN
from app.adapters.outbound.persistence.db import engine
from app.adapters.outbound.persistence.tables import DocumentTable, ProjectTable, ProposalTable
from app.application.use_cases.planning.apply_plan import ApplyPlan
from tests.api import as_new_user, invite_token, join, new_client, sign_up
from tests.fakes import RecordingEventBus

BODY = {"name": "Online store", "description": "Sell online.", "role": "Backend"}


def _error(response, status: int, code: str) -> dict:
    assert response.status_code == status, response.text
    assert response.json()["code"] == code
    return response.json()


def _project(client) -> dict:
    response = client.post("/api/projects", json=BODY)
    assert response.status_code == 201, response.text
    return response.json()


def _member(client, pid: int, name: str) -> dict:
    return next(m for m in client.get(f"/api/projects/{pid}").json()["members"] if m["name"] == name)


# ---------- US4: invitation and join ----------


def test_invitation_get_renew_disable(client):
    pid = _project(client)["id"]
    url = f"/api/projects/{pid}/invitation"
    current = client.get(url).json()
    assert current["active"] is True and current["token"]

    renewed = client.post(url)
    assert renewed.status_code == 200 and renewed.json()["token"] != current["token"]
    _error(client.get(f"/api/invitations/{current['token']}"), 404, "invitation_not_found")

    assert client.delete(url).status_code == 204
    assert client.get(url).json() == {"active": False, "token": None}
    _error(client.get(f"/api/invitations/{renewed.json()['token']}"), 404, "invitation_not_found")
    _error(client.get("/api/projects/9999/invitation"), 404, "project_not_found")


def test_preview_works_signed_out_and_shows_only_the_name_and_leaders(client, anonymous):
    pid = _project(client)["id"]
    token = invite_token(client, pid)
    assert anonymous.get(f"/api/invitations/{token}").json() == {"project_name": "Online store", "leaders": ["Ana"], "already_member": False}
    assert client.get(f"/api/invitations/{token}").json()["already_member"] is True


def test_join_flow(client, anonymous):
    pid = _project(client)["id"]
    token = invite_token(client, pid)

    # Not signed in: sign up first, then join
    _error(anonymous.post(f"/api/invitations/{token}/join"), 401, "not_authenticated")
    sign_up(anonymous, "Beto", role="Design", seniority="junior")
    joined = anonymous.post(f"/api/invitations/{token}/join")
    assert joined.status_code == 200 and joined.json() == {"project_id": pid, "joined": True}
    assert anonymous.post(f"/api/invitations/{token}/join").json() == {"project_id": pid, "joined": False}

    beto = _member(client, pid, "Beto")
    assert (beto["role"], beto["seniority"], beto["permission"]) == ("Design", "junior", "member")
    assert [p["permission"] for p in anonymous.get("/api/projects").json()] == ["member"]
    activity = client.get(f"/api/projects/{pid}/activity").json()
    assert activity[0]["type"] == "team_changed" and activity[0]["joined"] == ["Beto"]

    # No role in the profile: the body gives it, or it's a 422 on `role`
    carla = as_new_user(client, "Carla")
    body = _error(carla.post(f"/api/invitations/{token}/join"), 422, "validation_failed")
    assert body["errors"] == [{"field": "role", "message": "Required."}]
    assert join(carla, token, role="QA")["joined"]
    assert _member(client, pid, "Carla")["role"] == "QA"

    _error(carla.post("/api/invitations/nope/join"), 404, "invitation_not_found")


def test_same_name_joins_with_a_number(client):
    pid = _project(client)["id"]
    join(as_new_user(client, "Ana", role="QA"), invite_token(client, pid))
    assert [m["name"] for m in client.get(f"/api/projects/{pid}").json()["members"]] == ["Ana", "Ana 2"]


# ---------- US5: permissions ----------


@pytest.fixture
def team(client):
    """Ana leads a project with a board and a proposal; Beto is a member; Carla is outside."""
    pid = _project(client)["id"]
    beto = as_new_user(client, "Beto", role="Design")
    join(beto, invite_token(client, pid))
    with Session(engine) as session:
        row = session.get(ProjectTable, pid)
        row.plan = MOCK_PLAN
        session.add(row)
        proposal = ProposalTable(project_id=pid, kind="replan", key="replan", agent="Scrum master", rationale="r", content={})
        document = DocumentTable(project_id=pid, key="general_spec", kind="general_spec", title="Spec", content="# Spec")
        session.add(proposal)
        session.add(document)
        session.commit()
        proposal_id, document_id = proposal.id, document.id
    asyncio.run(ApplyPlan(open_uow, RecordingEventBus()).execute(pid))
    board = client.get(f"/api/projects/{pid}/board").json()
    carla = as_new_user(client, "Carla", role="QA")
    return {
        "pid": pid,
        "beto": beto,
        "carla": carla,
        "task": board["tasks"][0],
        "sprint": board["sprints"][0],
        "proposal_id": proposal_id,
        "document_id": document_id,
        "beto_id": _member(client, pid, "Beto")["id"],
        "ana_id": _member(client, pid, "Ana")["id"],
    }


def test_a_member_sees_everything_and_works_on_the_board(team):
    beto, pid, task = team["beto"], team["pid"], team["task"]
    for url in [
        f"/api/projects/{pid}",
        f"/api/projects/{pid}/plan",
        f"/api/projects/{pid}/board",
        f"/api/projects/{pid}/activity",
        f"/api/projects/{pid}/proposals",
        f"/api/proposals/{team['proposal_id']}",
        f"/api/projects/{pid}/documents",
        f"/api/documents/{team['document_id']}",
    ]:
        assert beto.get(url).status_code == 200, url

    assert beto.patch(f"/api/tasks/{task['id']}", json={"status": "in_progress"}).status_code == 200
    assert beto.put(f"/api/tasks/{task['id']}/checklist", json={"items": [{"text": "Write it", "done": True}]}).status_code == 200
    assert beto.post(f"/api/projects/{pid}/tasks", json={"title": "Fix the footer"}).status_code == 201
    assert beto.put(f"/api/documents/{team['document_id']}", json={"content": "# Edited", "base_version": 1}).status_code == 200


def _manage_routes(team) -> list[tuple[str, str, dict | None]]:
    pid = team["pid"]
    return [
        ("patch", f"/api/projects/{pid}", {"name": "X"}),
        ("put", f"/api/projects/{pid}/capacity", {"points_per_sprint": 10}),
        ("post", f"/api/projects/{pid}/planning", None),
        ("post", f"/api/projects/{pid}/planning/stages/analysis/retry", None),
        ("post", f"/api/projects/{pid}/replan", {"reason": "Because"}),
        ("post", f"/api/sprints/{team['sprint']['id']}/close", None),
        ("post", f"/api/proposals/{team['proposal_id']}/approve", None),
        ("post", f"/api/proposals/{team['proposal_id']}/adjust", {"content": {}}),
        ("post", f"/api/proposals/{team['proposal_id']}/reject", {"reason": "No"}),
        ("post", f"/api/proposals/{team['proposal_id']}/apply", None),
        ("post", f"/api/projects/{pid}/proposals/approve", {"ids": [team["proposal_id"]]}),
        ("put", f"/api/projects/{pid}/repository", {"repository": "acme/shop"}),
        ("delete", f"/api/projects/{pid}/repository", None),
        ("post", f"/api/projects/{pid}/issues/propose", None),
        ("put", f"/api/members/{team['beto_id']}/github-username", {"github_username": "beto"}),
        ("post", f"/api/documents/{team['document_id']}/regenerate", {"instructions": "More"}),
        ("patch", f"/api/projects/{pid}/members/{team['ana_id']}", {"role": "QA"}),
        ("get", f"/api/projects/{pid}/invitation", None),
        ("post", f"/api/projects/{pid}/invitation", None),
        ("delete", f"/api/projects/{pid}/invitation", None),
    ]


def _call(client, method: str, url: str, body: dict | None):
    if body is None:
        return getattr(client, method)(url)
    return client.request(method.upper(), url, json=body)


def test_a_member_gets_403_on_every_leader_action_and_nothing_changes(client, team):
    before = client.get(f"/api/projects/{team['pid']}").json()
    for method, url, body in _manage_routes(team):
        response = _call(team["beto"], method, url, body)
        assert response.status_code == 403 and response.json()["code"] == "forbidden", (method, url, response.text)
    assert client.get(f"/api/projects/{team['pid']}").json() == before


def test_an_outsider_gets_404_everywhere(team):
    carla, pid = team["carla"], team["pid"]
    for method, url, body in _manage_routes(team) + [
        ("get", f"/api/projects/{pid}/board", None),
        ("get", f"/api/projects/{pid}/events", None),
        ("patch", f"/api/tasks/{team['task']['id']}", {"status": "done"}),
        ("get", f"/api/documents/{team['document_id']}", None),
        ("delete", f"/api/projects/{pid}/members/{team['beto_id']}", None),
    ]:
        response = _call(carla, method, url, body)
        assert response.status_code == 404 and response.json()["code"].endswith("_not_found"), (method, url, response.text)
    assert _call(carla, "get", f"/api/tasks/{team['task']['id']}", None).status_code in (404, 405)


# ---------- US6: manage the team ----------


def test_leader_edits_and_promotes_a_member(client, team):
    pid, beto_id = team["pid"], team["beto_id"]
    url = f"/api/projects/{pid}/members/{beto_id}"
    response = client.patch(url, json={"role": "Frontend", "hours_per_week": 30})
    assert response.status_code == 200, response.text
    beto = next(m for m in response.json()["members"] if m["id"] == beto_id)
    assert (beto["role"], beto["hours_per_week"]) == ("Frontend", 30)
    assert team["beto"].get("/api/me").json()["role"] == "Design"  # the profile doesn't change

    assert client.patch(url, json={"permission": "leader"}).status_code == 200
    assert team["beto"].patch(f"/api/projects/{pid}", json={"name": "Renamed"}).status_code == 200

    body = _error(client.patch(url, json={"hours_per_week": 0, "name": "Ana"}), 422, "validation_failed")
    assert {e["field"] for e in body["errors"]} == {"hours_per_week", "name"}
    _error(client.patch(url, json={}), 422, "validation_failed")
    _error(client.patch(f"/api/projects/{pid}/members/9999", json={"role": "QA"}), 404, "member_not_found")


def test_last_leader(client, team):
    pid, ana_id = team["pid"], team["ana_id"]
    _error(client.patch(f"/api/projects/{pid}/members/{ana_id}", json={"permission": "member"}), 409, "last_leader")
    _error(client.delete(f"/api/projects/{pid}/members/{ana_id}"), 409, "last_leader")


def test_remove_and_leave(client, team):
    pid, beto, beto_id = team["pid"], team["beto"], team["beto_id"]
    task = team["task"]
    assert client.patch(f"/api/tasks/{task['id']}", json={"assignee_id": beto_id, "status": "in_progress"}).status_code == 200

    # A member can't remove others, only leave
    _error(beto.delete(f"/api/projects/{pid}/members/{team['ana_id']}"), 403, "forbidden")
    assert beto.delete(f"/api/projects/{pid}/members/{beto_id}").status_code == 204
    assert beto.get("/api/projects").json() == []
    _error(beto.get(f"/api/projects/{pid}"), 404, "project_not_found")
    board = client.get(f"/api/projects/{pid}/board").json()
    assert next(t for t in board["tasks"] if t["id"] == task["id"])["assignee_id"] is None
    # With the plan applied a replan starts too (spec 008), so look for the newest team change
    team_changes = [e for e in client.get(f"/api/projects/{pid}/activity").json() if e["type"] == "team_changed"]
    assert team_changes[0]["left"] == ["Beto"]

    # The leader removes someone who joined again with the same link
    join(beto, invite_token(client, pid))
    again = _member(client, pid, "Beto")
    assert client.delete(f"/api/projects/{pid}/members/{again['id']}").status_code == 204


def test_profile_name_follows_into_projects(client, team):
    pid = team["pid"]
    assert team["beto"].patch("/api/me", json={"name": "Roberto"}).status_code == 200
    assert "Roberto" in [m["name"] for m in client.get(f"/api/projects/{pid}").json()["members"]]


def test_two_browsers_of_the_same_person(client):
    pid = _project(client)["id"]
    me = client.get("/api/me").json()
    other = new_client(client)
    assert other.post("/api/auth/signin", json={"email": me["email"], "password": "secret-123"}).status_code == 200
    assert other.get(f"/api/projects/{pid}").status_code == 200
