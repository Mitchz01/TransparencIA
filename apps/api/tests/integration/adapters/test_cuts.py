"""Spec 017 (D13): the generated documents and the issue proposals are hidden, not deleted."""

import importlib

import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel

from app import config
from app.adapters.outbound.persistence.db import engine


@pytest.fixture
def fresh_db():
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)


@pytest.mark.parametrize("enabled, handlers", [(False, 1), (True, 2)])
def test_documents_are_generated_after_a_plan_only_when_turned_on(monkeypatch, fresh_db, enabled, handlers):
    from app.main import app

    monkeypatch.setattr("app.main.GENERATE_DOCUMENTS", enabled)
    with TestClient(app):
        assert len(app.state.on_plan_completed) == handlers  # ApplyPlan, plus GenerateDocuments when on
        assert app.state.generate_documents is not None  # spec 006's writer and appliers stay wired


@pytest.mark.parametrize(
    "env, mock_github, expected",
    [({}, True, False), ({}, False, True), ({"PROPOSE_ISSUES": "1"}, True, True), ({"PROPOSE_ISSUES": "0"}, False, False)],
)
def test_issue_proposals_are_skipped_while_github_is_in_test_mode(monkeypatch, env, mock_github, expected):
    for name in ("PROPOSE_ISSUES", "GITHUB_TOKEN", "MOCK_GITHUB"):
        monkeypatch.delenv(name, raising=False)
    for name, value in env.items():
        monkeypatch.setenv(name, value)
    if mock_github:
        monkeypatch.setenv("MOCK_GITHUB", "1")
    else:
        monkeypatch.setenv("GITHUB_TOKEN", "ghp_test")
    try:
        assert importlib.reload(config).PROPOSE_ISSUES is expected
    finally:
        monkeypatch.undo()
        importlib.reload(config)
