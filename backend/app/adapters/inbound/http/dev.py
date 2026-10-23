"""Development-only endpoints, mounted by main.py only when ENV=dev (spec 008, T029).

POST /api/dev/github-events replays a recorded GitHub payload (backend/tests/fixtures/github)
through the same HandleGithubEvent as the real webhook, to demo the sync without a tunnel.
It skips the signature on purpose."""

import json
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, status

from app.adapters.inbound.http import dependencies as deps
from app.adapters.inbound.http.background import spawn
from app.adapters.inbound.webhooks.github import parse_event
from app.application.dto import DevGithubEvent, WebhookReceipt
from app.application.use_cases.integrations.handle_github_event import HandleGithubEvent
from app.domain.errors import ValidationFailed
from app.domain.integrations import validate_repository

router = APIRouter(prefix="/api/dev", tags=["dev"])

FIXTURES = Path(__file__).resolve().parents[4] / "tests" / "fixtures" / "github"


def fixtures() -> dict[str, Path]:
    return {path.stem: path for path in sorted(FIXTURES.glob("*.json"))}


def build_payload(body: DevGithubEvent) -> tuple[str, dict[str, Any]]:
    """(X-GitHub-Event, payload) for the fixture with the overrides applied. For a
    pull_request fixture, `number` is the issue the PR closes; for an issues one, the issue."""
    available = fixtures()
    if body.fixture not in available:
        raise ValidationFailed.single("fixture", f"Unknown fixture. Use one of: {', '.join(available)}.")
    payload = json.loads(available[body.fixture].read_text(encoding="utf-8"))
    event_name = "pull_request" if body.fixture.startswith("pull_request") else "issues"
    if body.repository is not None:
        payload["repository"]["full_name"] = validate_repository(body.repository)
    if body.number is not None:
        if event_name == "pull_request":
            payload["pull_request"]["body"] = f"Replayed from the {body.fixture} fixture.\n\nCloses #{body.number}"
        else:
            payload["issue"]["number"] = body.number
    return event_name, payload


@router.post("/github-events", status_code=status.HTTP_202_ACCEPTED, response_model=WebhookReceipt, response_model_exclude_none=True)
async def replay_github_event(
    body: DevGithubEvent, use_case: HandleGithubEvent = Depends(deps.get_handle_github_event)
) -> WebhookReceipt:
    event_name, payload = build_payload(body)
    event = parse_event(event_name, payload)
    receipt = use_case.receive(f"dev-{uuid.uuid4()}", event_name, event)
    if receipt.status == "accepted" and event is not None:
        spawn(use_case.execute(event))
    return receipt
