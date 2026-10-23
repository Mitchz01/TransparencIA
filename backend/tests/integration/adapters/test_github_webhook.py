"""Spec 008's API Contract: POST /webhooks/github, end to end with recorded payloads
(tests/fixtures/github) and FakeCodeHost. Nothing here calls GitHub or Gemini."""

import asyncio
import json
import time
from pathlib import Path

from sqlmodel import Session

from app.adapters.inbound.http.dependencies import open_uow
from app.adapters.inbound.webhooks.github import signature
from app.adapters.outbound.agents.mock.data import MOCK_PLAN
from app.adapters.outbound.persistence.db import engine
from app.adapters.outbound.persistence.tables import ExternalLinkTable, ProjectTable
from app.application.use_cases.planning.apply_plan import ApplyPlan
from tests.fakes import RecordingEventBus

FIXTURES = Path(__file__).resolve().parents[2] / "fixtures" / "github"
SECRET = "test-webhook-secret"  # conftest.py
REPO = "acme/agile-app"  # the fixtures' repository
PROJECT = {
    "name": "Agile Planner",
    "description": "Plans the work.",
    "members": [{"name": "Ana", "role": "Backend"}, {"name": "Leo", "role": "Frontend"}],
}


def fixture(name: str) -> bytes:
    return (FIXTURES / f"{name}.json").read_bytes()


def post(client, body: bytes, event: str | None = "pull_request", delivery: str | None = "d-1", sig: str | None = "valid"):
    headers = {"Content-Type": "application/json"}
    if sig is not None:
        headers["X-Hub-Signature-256"] = signature(SECRET, body) if sig == "valid" else sig
    if event is not None:
        headers["X-GitHub-Event"] = event
    if delivery is not None:
        headers["X-GitHub-Delivery"] = delivery
    return client.post("/webhooks/github", content=body, headers=headers)


def _board(client) -> tuple[int, dict]:
    """A connected project with its board; US-2 is linked to issue #12 (the fixtures' issue)."""
    pid = client.post("/api/projects", json=PROJECT).json()["id"]
    with Session(engine) as session:
        row = session.get(ProjectTable, pid)
        row.plan = MOCK_PLAN
        session.add(row)
        session.commit()
    asyncio.run(ApplyPlan(open_uow, RecordingEventBus()).execute(pid))
    assert client.put(f"/api/projects/{pid}/repository", json={"repository": REPO}).status_code == 200
    task = next(t for t in client.get(f"/api/projects/{pid}/board").json()["tasks"] if t["key"] == "US-2")
    with Session(engine) as session:
        session.add(
            ExternalLinkTable(
                project_id=pid, task_id=task["id"], kind="issue", repository=REPO, number=12,
                url=f"https://github.com/{REPO}/issues/12",
            )
        )
        session.commit()
    return pid, task


def _task(client, pid: int, task_id: int) -> dict:
    return next(t for t in client.get(f"/api/projects/{pid}/board").json()["tasks"] if t["id"] == task_id)


def _wait_for(check, attempts: int = 200):
    for _ in range(attempts):
        value = check()
        if value:
            return value
        time.sleep(0.01)
    raise AssertionError("background work didn't finish")


def _assert_error(response, status: int, code: str):
    assert response.status_code == status, response.text
    assert response.json()["code"] == code


# ---------- 202 ----------


def test_signed_merge_is_accepted_and_moves_the_task_to_done(client):
    pid, task = _board(client)
    response = post(client, fixture("pull_request_merged"), delivery="72d3-merged")

    assert response.status_code == 202
    assert response.json() == {"delivery_id": "72d3-merged", "status": "accepted"}
    done = _wait_for(lambda: (t := _task(client, pid, task["id"]))["status"] == "done" and t)
    assert all(item["done"] for item in done["checklist"])
    events = client.get(f"/api/projects/{pid}/activity").json()
    moved = next(e for e in events if e["type"] == "task_status_changed")
    assert (moved["actor"], moved["task_id"], moved["status"]) == ("github", task["id"], "done")


def test_fixtures_end_to_end(client):
    pid, task = _board(client)
    status = lambda: _task(client, pid, task["id"])["status"]  # noqa: E731

    post(client, fixture("pull_request_opened"), delivery="d-1")
    _wait_for(lambda: status() == "in_progress")
    # spec 007 (T033): the opened PR closes a project issue, so a review is proposed
    review = _wait_for(
        lambda: [p for p in client.get(f"/api/projects/{pid}/proposals").json() if p["key"] == "request_review"]
    )
    assert review[0]["content"]["pr_number"] == 31

    post(client, fixture("pull_request_ready_for_review"), delivery="d-2")
    _wait_for(lambda: status() == "review")
    post(client, fixture("issues_closed_completed"), event="issues", delivery="d-3")
    _wait_for(lambda: status() == "done")
    post(client, fixture("issues_reopened"), event="issues", delivery="d-4")
    _wait_for(lambda: status() == "todo")

    post(client, fixture("issues_closed_not_planned"), event="issues", delivery="d-5")
    _wait_for(lambda: any(e["type"] == "github_event_ignored" for e in client.get(f"/api/projects/{pid}/activity").json()))
    assert status() == "todo"


def test_duplicate_delivery_is_ignored(client):
    pid, task = _board(client)
    assert post(client, fixture("pull_request_opened"), delivery="dup").json()["status"] == "accepted"
    response = post(client, fixture("pull_request_opened"), delivery="dup")
    assert response.status_code == 202
    assert response.json() == {"delivery_id": "dup", "status": "ignored", "reason": "duplicate"}


def test_unhandled_event_or_action_is_ignored(client):
    _board(client)
    push = post(client, b'{"ref": "refs/heads/main", "repository": {"full_name": "acme/agile-app"}}', event="push", delivery="p-1")
    assert push.status_code == 202
    assert push.json() == {"delivery_id": "p-1", "status": "ignored", "reason": "unhandled_event"}

    labeled = json.loads(fixture("pull_request_opened"))
    labeled["action"] = "labeled"
    response = post(client, json.dumps(labeled).encode(), delivery="p-2")
    assert response.json() == {"delivery_id": "p-2", "status": "ignored", "reason": "unhandled_event"}


def test_unknown_repository_is_ignored(client):
    payload = json.loads(fixture("issues_closed_completed"))
    payload["repository"]["full_name"] = "acme/not-connected"
    response = post(client, json.dumps(payload).encode(), event="issues", delivery="u-1")
    assert response.status_code == 202
    assert response.json() == {"delivery_id": "u-1", "status": "ignored", "reason": "unknown_repository"}


# ---------- 200 ----------


def test_ping_answers_pong(client):
    response = post(client, b'{"zen": "Keep it logically awesome.", "hook_id": 1}', event="ping")
    assert response.status_code == 200
    assert response.json() == {"status": "pong"}


# ---------- 400 ----------


def test_missing_headers_or_a_body_that_isnt_json_are_malformed(client):
    body = fixture("pull_request_opened")
    _assert_error(post(client, body, event=None), 400, "malformed_request")
    _assert_error(post(client, body, delivery=None), 400, "malformed_request")
    _assert_error(post(client, b"not json", delivery="m-1"), 400, "malformed_request")


# ---------- 401 ----------


def test_missing_or_wrong_signature_is_rejected_and_changes_nothing(client):
    pid, task = _board(client)
    body = fixture("pull_request_merged")
    _assert_error(post(client, body, sig=None, delivery="s-1"), 401, "invalid_signature")
    _assert_error(post(client, body, sig="sha256=" + "0" * 64, delivery="s-2"), 401, "invalid_signature")
    # Signed with another secret
    _assert_error(post(client, body, sig=signature("other", body), delivery="s-3"), 401, "invalid_signature")
    # Signed, then tampered with
    tampered = body.replace(b"Closes #12", b"Closes #13")
    _assert_error(post(client, tampered, sig=signature(SECRET, body), delivery="s-4"), 401, "invalid_signature")

    time.sleep(0.05)
    assert _task(client, pid, task["id"])["status"] == "todo"
    # Rejected deliveries aren't recorded: the real one is still processed
    assert post(client, body, delivery="s-1").json()["status"] == "accepted"


# ---------- Objectives (US3) ----------


def test_objective_closes_when_the_last_task_is_done_by_hand_or_from_github(client):
    pid, linked = _board(client)
    board = client.get(f"/api/projects/{pid}/board").json()
    sprint_1 = board["sprints"][0]["id"]
    others = [t for t in board["tasks"] if t["sprint_id"] == sprint_1 and t["id"] != linked["id"]]
    for task in others:  # by hand
        assert client.patch(f"/api/tasks/{task['id']}", json={"status": "done"}).status_code == 200

    def objective() -> dict:
        return next(o for o in client.get(f"/api/projects/{pid}/board").json()["objectives"] if o["sprint_id"] == sprint_1)

    assert objective()["done"] is False

    post(client, fixture("pull_request_merged"), delivery="obj-1")  # the last one, from GitHub
    _wait_for(lambda: objective()["done"])
    closed = [e for e in client.get(f"/api/projects/{pid}/activity").json() if e["type"] == "objective_closed"]
    assert [e["sprint_id"] for e in closed] == [sprint_1]

    # Moving a task out of done by hand reopens it
    assert client.patch(f"/api/tasks/{others[0]['id']}", json={"status": "review"}).status_code == 200
    assert objective()["done"] is False
