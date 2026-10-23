"""POST /webhooks/github (spec 008, US1): GitHub's PR and issue events of connected repos.

The signature is checked on the raw body before anything is parsed; processing runs in the
background, so `202` means "received", not "applied". Only this module knows GitHub's
payload shapes: it turns them into the domain events of `app.domain.sync`."""

import hashlib
import hmac
import json
from typing import Any

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

from app.adapters.inbound.http import dependencies as deps
from app.adapters.inbound.http.background import spawn
from app.adapters.inbound.http.errors import error_body
from app.application.use_cases.integrations.handle_github_event import HandleGithubEvent
from app.domain.integrations import closing_refs
from app.domain.sync import (
    GithubEvent,
    IssueClosed,
    IssueReopened,
    PullRequestClosed,
    PullRequestMerged,
    PullRequestOpened,
    PullRequestReadyForReview,
)

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

SIGNATURE_HEADER = "X-Hub-Signature-256"
EVENT_HEADER = "X-GitHub-Event"
DELIVERY_HEADER = "X-GitHub-Delivery"


def signature(secret: str, body: bytes) -> str:
    """`sha256=<hex>`, as GitHub signs each delivery."""
    return "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


def valid_signature(secret: str, body: bytes, received: str | None) -> bool:
    """Without a configured secret nothing is trusted."""
    if not secret or not received:
        return False
    return hmac.compare_digest(signature(secret, body), received)


def parse_event(event_name: str, payload: dict[str, Any]) -> GithubEvent | None:
    """The domain event for a payload, or None if the board doesn't handle it."""
    action = payload.get("action")
    repository = (payload.get("repository") or {}).get("full_name")
    if not isinstance(repository, str) or not repository:
        return None
    if event_name == "pull_request":
        pr = payload.get("pull_request") or {}
        number = pr.get("number") or payload.get("number")
        if not isinstance(number, int):
            return None
        common = {"repository": repository, "number": number, "closes": closing_refs(pr.get("body"))}
        if action == "opened":
            return PullRequestOpened(
                **common,
                author=(pr.get("user") or {}).get("login", ""),
                draft=bool(pr.get("draft")),
                url=pr.get("html_url") or "",
                body=pr.get("body") or "",
            )
        if action == "ready_for_review":
            return PullRequestReadyForReview(**common)
        if action == "closed":
            return PullRequestMerged(**common) if pr.get("merged") else PullRequestClosed(**common)
        return None
    if event_name == "issues":
        issue = payload.get("issue") or {}
        number = issue.get("number")
        if not isinstance(number, int) or "pull_request" in issue:  # PRs are issues too on GitHub
            return None
        if action == "closed":
            reason = "not_planned" if issue.get("state_reason") == "not_planned" else "completed"
            return IssueClosed(repository=repository, number=number, reason=reason)
        if action == "reopened":
            return IssueReopened(repository=repository, number=number)
    return None


def _error(status: int, code: str, detail: str) -> JSONResponse:
    return JSONResponse(status_code=status, content=error_body(code, detail))


@router.post("/github", status_code=202)
async def receive_github_event(
    request: Request,
    use_case: HandleGithubEvent = Depends(deps.get_handle_github_event),
) -> JSONResponse:
    body = await request.body()
    if not valid_signature(deps.webhook_secret(request), body, request.headers.get(SIGNATURE_HEADER)):
        return _error(401, "invalid_signature", "The request isn't signed with the project's webhook secret.")
    event_name = request.headers.get(EVENT_HEADER)
    delivery_id = request.headers.get(DELIVERY_HEADER)
    if not event_name or not delivery_id:
        return _error(400, "malformed_request", f"The {EVENT_HEADER} and {DELIVERY_HEADER} headers are required.")
    try:
        payload = json.loads(body)
    except ValueError:
        return _error(400, "malformed_request", "The body isn't valid JSON.")
    if not isinstance(payload, dict):
        return _error(400, "malformed_request", "The body must be a JSON object.")
    if event_name == "ping":
        return JSONResponse(status_code=200, content={"status": "pong"})

    event = parse_event(event_name, payload)
    receipt = use_case.receive(delivery_id, event_name, event)
    if receipt.status == "accepted" and event is not None:
        spawn(use_case.execute(event))  # GitHub doesn't wait for the board
    return JSONResponse(status_code=202, content=receipt.model_dump(exclude_none=True))
