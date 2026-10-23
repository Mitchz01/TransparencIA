"""Spec 008's API Contract: the dev-only POST /api/dev/github-events (T029). It only exists
with ENV=dev; here an app is built like main.py's with the dev router mounted."""

import asyncio
import time

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel

from app.adapters.inbound.http import accounts, board, dev, integrations, projects, team
from app.adapters.inbound.http.dependencies import open_uow
from app.adapters.inbound.http.errors import register_error_handlers
from app.adapters.outbound.agents.mock.data import MOCK_PLAN
from app.adapters.outbound.persistence.db import engine
from app.adapters.outbound.persistence.tables import ExternalLinkTable, ProjectTable
from app.application.use_cases.planning.apply_plan import ApplyPlan
from app.main import lifespan
from tests.fakes import RecordingEventBus
from tests.api import create_project, sign_up

REPO = "acme/demo"


@pytest.fixture
def dev_client():
    app = FastAPI(lifespan=lifespan)
    register_error_handlers(app)
    for module in (accounts, projects, team, integrations, board, dev):
        app.include_router(module.router)
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    with TestClient(app, raise_server_exceptions=False) as client:
        sign_up(client)
        yield client


def _linked_task(client) -> tuple[int, dict]:
    pid = create_project(client, {"name": "Demo", "description": "d", "members": [{"name": "Ana", "role": "Backend"}]})["id"]
    with Session(engine) as session:
        row = session.get(ProjectTable, pid)
        row.plan = MOCK_PLAN
        session.add(row)
        session.commit()
    asyncio.run(ApplyPlan(open_uow, RecordingEventBus()).execute(pid))
    assert client.put(f"/api/projects/{pid}/repository", json={"repository": REPO}).status_code == 200
    task = client.get(f"/api/projects/{pid}/board").json()["tasks"][0]
    with Session(engine) as session:
        session.add(ExternalLinkTable(project_id=pid, task_id=task["id"], kind="issue", repository=REPO, number=77, url="u77"))
        session.commit()
    return pid, task


def _status(client, pid: int, task_id: int) -> str:
    return next(t for t in client.get(f"/api/projects/{pid}/board").json()["tasks"] if t["id"] == task_id)["status"]


def _wait_for(check, attempts: int = 200):
    for _ in range(attempts):
        if check():
            return
        time.sleep(0.01)
    raise AssertionError("background work didn't finish")


def test_replays_a_fixture_with_the_overrides(dev_client):
    pid, task = _linked_task(dev_client)

    response = dev_client.post("/api/dev/github-events", json={"fixture": "pull_request_merged", "repository": REPO, "number": 77})

    assert response.status_code == 202
    body = response.json()
    assert body["status"] == "accepted" and body["delivery_id"].startswith("dev-")
    _wait_for(lambda: _status(dev_client, pid, task["id"]) == "done")

    reopened = dev_client.post("/api/dev/github-events", json={"fixture": "issues_reopened", "repository": REPO, "number": 77})
    assert reopened.json()["status"] == "accepted"
    _wait_for(lambda: _status(dev_client, pid, task["id"]) == "todo")


def test_unknown_fixture_or_invalid_fields(dev_client):
    for body, field in (
        ({"fixture": "../../app/main"}, "fixture"),
        ({"fixture": "nope"}, "fixture"),
        ({"fixture": "issues_reopened", "number": 0}, "number"),
        ({"fixture": "issues_reopened", "repository": "not a repo"}, "repository"),
        ({}, "fixture"),
    ):
        response = dev_client.post("/api/dev/github-events", json=body)
        assert response.status_code == 422, body
        assert response.json()["code"] == "validation_failed"
        assert [e["field"] for e in response.json()["errors"]] == [field]


def test_it_doesnt_exist_outside_dev(client):
    response = client.post("/api/dev/github-events", json={"fixture": "pull_request_merged"})
    assert response.status_code == 404
