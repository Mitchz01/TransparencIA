"""Every status row of spec 005's API Contract (proposals and activity)."""

import time

from sqlmodel import Session

from app.adapters.outbound.agents.mock.data import MOCK_PLAN
from app.adapters.outbound.persistence.db import engine
from app.adapters.outbound.persistence.tables import ProposalTable
from tests.api import create_project

PROJECT = {"name": "Agile Planner", "description": "Plans the work.", "members": [{"name": "Ana", "role": "Backend"}]}


def _project(client) -> int:
    return create_project(client, PROJECT)["id"]


def _proposal(project_id: int, key: str = "methodology", kind: str = "plan_stage", **fields) -> int:
    with Session(engine) as session:
        row = ProposalTable(project_id=project_id, kind=kind, key=key, agent="Agile coach", content=MOCK_PLAN[key], rationale="Because", **fields)
        session.add(row)
        session.commit()
        return row.id


def test_list_and_get(client):
    pid = _project(client)
    old = _proposal(pid, "analysis", status="approved")
    new = _proposal(pid)
    listed = client.get(f"/api/projects/{pid}/proposals").json()
    assert [p["id"] for p in listed] == [new, old]
    proposal = listed[0]
    assert proposal["origin"] == "leader" and proposal["apply_failed"] is False and proposal["rejection_reason"] is None
    assert [p["id"] for p in client.get(f"/api/projects/{pid}/proposals?status=pending").json()] == [new]

    bad = client.get(f"/api/projects/{pid}/proposals?status=nope")
    assert bad.status_code == 422 and bad.json()["errors"][0]["field"] == "status"
    assert client.get("/api/projects/999/proposals").json()["code"] == "project_not_found"
    assert client.get(f"/api/proposals/{new}").json()["id"] == new
    assert client.get("/api/proposals/999").json()["code"] == "proposal_not_found"


def test_approve_then_apply_fails_without_an_applier(client):
    pid = _project(client)
    pr = _proposal(pid, kind="replan")  # spec 008 hasn't registered its applier yet
    response = client.post(f"/api/proposals/{pr}/approve")
    assert response.status_code == 200 and response.json()["status"] == "approved"

    again = client.post(f"/api/proposals/{pr}/approve")
    assert again.status_code == 409
    assert again.json()["code"] == "proposal_already_resolved" and again.json()["status"] == "approved"

    # No spec registered a replan applier yet: the decision stays, applying is flagged.
    for _ in range(50):
        stored = client.get(f"/api/proposals/{pr}").json()
        if stored["apply_failed"]:
            break
        time.sleep(0.01)  # applying runs in the background
    assert stored["status"] == "approved" and stored["apply_failed"] is True

    retry = client.post(f"/api/proposals/{pr}/apply")
    assert retry.status_code == 202 and retry.json() == {"proposal_id": pr, "status": "applying"}

    types = [e["type"] for e in client.get(f"/api/projects/{pid}/activity").json()]
    assert "proposal_resolved" in types and "proposal_apply_failed" in types


def test_adjust(client):
    pid = _project(client)
    pr = _proposal(pid)
    bad = client.post(f"/api/proposals/{pr}/adjust", json={"content": {**MOCK_PLAN["methodology"], "methodology": "waterfall"}})
    assert bad.status_code == 422 and bad.json()["errors"][0]["field"] == "content.methodology"
    missing = client.post(f"/api/proposals/{pr}/adjust", json={})
    assert missing.status_code == 422 and missing.json()["errors"][0] == {"field": "content", "message": "Required."}

    ok = client.post(f"/api/proposals/{pr}/adjust", json={"content": {**MOCK_PLAN["methodology"], "sprint_length_weeks": 1}})
    assert ok.status_code == 200 and ok.json()["status"] == "adjusted"
    assert ok.json()["adjusted_content"]["sprint_length_weeks"] == 1
    assert client.post(f"/api/proposals/{pr}/adjust", json={"content": MOCK_PLAN["methodology"]}).status_code == 409


def test_reject(client):
    pid = _project(client)
    pr = _proposal(pid)
    empty = client.post(f"/api/proposals/{pr}/reject", json={"reason": "  "})
    assert empty.status_code == 422 and empty.json()["errors"][0]["field"] == "reason"
    assert client.post(f"/api/proposals/{pr}/reject", json={"reason": "x" * 1001}).status_code == 422
    ok = client.post(f"/api/proposals/{pr}/reject", json={"reason": "Two-week sprints are too long."})
    assert ok.status_code == 200 and ok.json()["rejection_reason"] == "Two-week sprints are too long."
    assert client.post(f"/api/proposals/{pr}/reject", json={"reason": "again"}).status_code == 409
    assert client.post(f"/api/proposals/{pr}/apply").json()["code"] == "proposal_not_retryable"


def test_bulk_approve(client):
    pid = _project(client)
    a, b = _proposal(pid, "analysis"), _proposal(pid, "architecture")
    done = _proposal(pid, "roadmap", status="approved")
    response = client.post(f"/api/projects/{pid}/proposals/approve", json={"ids": [a, b, done, 999]})
    assert response.status_code == 200
    body = response.json()
    assert [(r["id"], r["ok"]) for r in body] == [(a, True), (b, True), (done, False), (999, False)]
    assert body[2]["error"]["code"] == "proposal_already_resolved" and body[3]["error"]["code"] == "proposal_not_found"
    assert client.post(f"/api/projects/{pid}/proposals/approve", json={"ids": []}).status_code == 422
    assert client.post(f"/api/projects/{pid}/proposals/approve", json={"ids": list(range(101))}).status_code == 422
    assert client.post("/api/projects/999/proposals/approve", json={"ids": [a]}).json()["code"] == "project_not_found"


def test_activity_history(client):
    pid = _project(client)
    for key in ("analysis", "architecture", "roadmap"):
        client.post(f"/api/proposals/{_proposal(pid, key)}/reject", json={"reason": "No"})
    page = client.get(f"/api/projects/{pid}/activity?limit=2").json()
    assert len(page) == 2 and page[0]["seq"] > page[1]["seq"]
    first = page[0]
    assert {"seq", "type", "project_id", "occurred_at", "actor", "summary", "ref"} <= set(first)
    assert first["ref"]["kind"] == "proposal" and first["actor"] == "person" and first["reason"] == "No"
    older = client.get(f"/api/projects/{pid}/activity?before={page[-1]['seq']}&limit=50").json()
    assert all(e["seq"] < page[-1]["seq"] for e in older)
    assert client.get(f"/api/projects/{pid}/activity?limit=0").status_code == 422
    assert client.get("/api/projects/999/activity").json()["code"] == "project_not_found"


def test_events_stream_replays_what_was_missed(client):
    pid = _project(client)
    for key in ("analysis", "architecture"):
        client.post(f"/api/proposals/{_proposal(pid, key)}/reject", json={"reason": "No"})
    seqs = sorted(e["seq"] for e in client.get(f"/api/projects/{pid}/activity").json())

    assert client.get("/api/projects/999/events").json()["code"] == "project_not_found"
    bad = client.get(f"/api/projects/{pid}/events", headers={"Last-Event-ID": "abc"})
    assert bad.status_code == 422

    lines: list[str] = []
    with client.stream("GET", f"/api/projects/{pid}/events", headers={"Last-Event-ID": str(seqs[0] - 1)}) as response:
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/event-stream")
        assert response.headers["cache-control"] == "no-cache"
        for line in response.iter_lines():
            lines.append(line)
            if sum(1 for item in lines if item.startswith("id:")) == len(seqs):
                break
    ids = [int(item.split(":", 1)[1]) for item in lines if item.startswith("id:")]
    assert ids == seqs
    assert any(item.strip() == "event: proposal_resolved" for item in lines)
