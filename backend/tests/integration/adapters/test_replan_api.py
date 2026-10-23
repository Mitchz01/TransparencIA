"""Spec 008's API Contract: POST /api/projects/{id}/replan, and a replan approved and
adjusted through spec 005's proposal API (ApplyReplan and its follow-ups). Mock agents
and FakeCodeHost only."""

import asyncio
import time

from sqlmodel import Session

from app.adapters.inbound.http.dependencies import open_uow
from app.adapters.outbound.agents.mock.data import MOCK_PLAN
from app.adapters.outbound.persistence.db import engine
from app.adapters.outbound.persistence.tables import ProjectTable
from app.application.use_cases.planning.apply_plan import ApplyPlan
from tests.fakes import RecordingEventBus

REPO = "acme/agile-app"
PROJECT = {
    "name": "Agile Planner",
    "description": "Plans the work.",
    "members": [
        {"name": "Ana", "role": "Backend", "seniority": "senior", "hours_per_week": 30},
        {"name": "Leo", "role": "Frontend", "hours_per_week": 20},
    ],
}


def _ready(client) -> int:
    pid = client.post("/api/projects", json=PROJECT).json()["id"]
    with Session(engine) as session:
        row = session.get(ProjectTable, pid)
        row.plan = MOCK_PLAN
        session.add(row)
        session.commit()
    asyncio.run(ApplyPlan(open_uow, RecordingEventBus()).execute(pid))
    return pid


def _replan(client, pid: int, reason="Leo leaves next week."):
    return client.post(f"/api/projects/{pid}/replan", json={"reason": reason})


def _wait_for(check, attempts: int = 200):
    for _ in range(attempts):
        value = check()
        if value:
            return value
        time.sleep(0.01)
    raise AssertionError("background work didn't finish")


def _replans(client, pid: int) -> list[dict]:
    return [p for p in client.get(f"/api/projects/{pid}/proposals").json() if p["kind"] == "replan"]


def _pending_replan(client, pid: int) -> dict:
    return _wait_for(lambda: next((p for p in _replans(client, pid) if p["status"] == "pending"), None))


def _board(client, pid: int) -> dict[str, dict]:
    return {t["key"]: t for t in client.get(f"/api/projects/{pid}/board").json()["tasks"]}


def _assert_error(response, status: int, code: str):
    assert response.status_code == status, response.text
    assert response.json()["code"] == code


# ---------- 202 ----------


def test_replan_is_accepted_and_arrives_as_a_proposal(client):
    pid = _ready(client)
    response = _replan(client, pid)
    assert response.status_code == 202
    assert response.json() == {"project_id": pid, "status": "replanning", "supersedes": None}

    proposal = _pending_replan(client, pid)
    assert (proposal["key"], proposal["origin"], proposal["agent"]) == ("replan", "leader", "Scrum master")
    assert proposal["content"]["reason"] == "Leo leaves next week."
    # US-1 (DevOps) has no owner on this team: the mock agent reassigns it
    assert any(c["kind"] == "reassign" and c["task_key"] == "US-1" for c in proposal["content"]["changes"])


def test_a_second_request_supersedes_the_pending_one(client):
    pid = _ready(client)
    _replan(client, pid)
    first = _pending_replan(client, pid)

    response = _replan(client, pid, "A new client came in.")
    assert response.status_code == 202
    assert response.json()["supersedes"] == first["id"]
    _wait_for(lambda: any(p["status"] == "discarded" for p in _replans(client, pid)))
    pending = _pending_replan(client, pid)
    assert pending["content"]["reason"] == "Leo leaves next week.\nA new client came in."
    assert [p["status"] for p in _replans(client, pid)].count("pending") == 1


# ---------- Errors ----------


def test_body_that_isnt_json_is_malformed(client):
    pid = _ready(client)
    response = client.post(f"/api/projects/{pid}/replan", content="reason", headers={"Content-Type": "application/json"})
    _assert_error(response, 400, "malformed_request")


def test_unknown_project(client):
    _assert_error(_replan(client, 999), 404, "project_not_found")


def test_plan_not_applied(client):
    pid = client.post("/api/projects", json=PROJECT).json()["id"]
    _assert_error(_replan(client, pid), 409, "plan_not_applied")


def test_reason_missing_empty_or_too_long(client):
    pid = _ready(client)
    for body in ({}, {"reason": None}, {"reason": "   "}, {"reason": "x" * 1001}):
        response = client.post(f"/api/projects/{pid}/replan", json=body)
        _assert_error(response, 422, "validation_failed")
        assert [e["field"] for e in response.json()["errors"]] == ["reason"]
    assert _replans(client, pid) == []


# ---------- Approving it (spec 005 → ApplyReplan) ----------


def test_approving_applies_the_changes_and_runs_the_github_follow_ups(client):
    pid = _ready(client)
    assert client.put(f"/api/projects/{pid}/repository", json={"repository": REPO}).status_code == 200
    # Connecting proposed publishing the board (spec 007, FR-006): approve it, so every task has an issue
    [publish] = client.get(f"/api/projects/{pid}/proposals").json()
    assert client.post(f"/api/proposals/{publish['id']}/approve").status_code == 200
    issue_of_us11 = _wait_for(lambda: _board(client, pid)["US-11"]["issue"])["number"]
    _replan(client, pid)
    proposal = _pending_replan(client, pid)
    story = {
        "key": "US-20", "epic_key": "EP-5", "title": "Export to CSV", "description": "x", "acceptance_criteria": ["CSV"],
        "type": "feature", "points": 3, "priority": "low", "role": "Backend",
    }
    content = {
        "reason": proposal["content"]["reason"],
        "rationale": "Adapted.",
        "changes": [
            {"kind": "reassign", "task_key": "US-1", "to_member": "Ana", "expected_status": "todo", "rationale": "Ana can."},
            {"kind": "add", "new_story": story, "to_sprint": 3, "rationale": "New client."},
            {"kind": "discard", "task_key": "US-11", "expected_status": "todo", "rationale": "Out of scope."},
        ],
    }

    assert client.post(f"/api/proposals/{proposal['id']}/adjust", json={"content": content}).status_code == 200

    _wait_for(lambda: "US-20" in _board(client, pid))
    board = _board(client, pid)
    assert "US-11" not in board and board["US-1"]["assignee_id"] is not None
    github = client.app.state.code_host_factory(None)
    [closed] = _wait_for(lambda: github.called("close_issue"))
    assert (closed["number"], closed["reason"]) == (issue_of_us11, "not_planned") and "US-11" in closed["comment"]
    pending_issues = _wait_for(
        lambda: [
            p for p in client.get(f"/api/projects/{pid}/proposals").json()
            if p["key"] == "create_issues" and p["status"] == "pending"
        ]
    )
    assert [t["task_id"] for t in pending_issues[0]["content"]["tasks"]] == [board["US-20"]["id"]]
    activity = client.get(f"/api/projects/{pid}/activity").json()
    applied = next(e for e in activity if e["type"] == "replan_applied")
    assert applied["applied"] == ["US-1", "US-20", "US-11"] and applied["discarded"] == []
