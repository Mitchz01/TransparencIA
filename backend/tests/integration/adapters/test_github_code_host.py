"""GitHubCodeHost against a fake GitHub (httpx.MockTransport): never calls the real API."""

import asyncio
import json
from collections.abc import Callable

import httpx
import pytest

from app.adapters.outbound.code_host.github.client import GitHubClient, GitHubError
from app.adapters.outbound.code_host.github.code_host import GitHubCodeHost
from app.domain.errors import CodeHostUnavailable

run = asyncio.run
REPO = "acme/app"


class FakeGitHub:
    """Answers with the handler and records every request (method, path, JSON body)."""

    def __init__(self, handler: Callable[[httpx.Request], httpx.Response]):
        self.handler = handler
        self.requests: list[httpx.Request] = []
        self.sleeps: list[float] = []

    def host(self, retries: int = 2) -> GitHubCodeHost:
        async def no_sleep(seconds: float) -> None:
            self.sleeps.append(seconds)

        def record(request: httpx.Request) -> httpx.Response:
            self.requests.append(request)
            return self.handler(request)

        client = GitHubClient("tok", transport=httpx.MockTransport(record), retries=retries, sleep=no_sleep)
        return GitHubCodeHost("tok", client)

    def calls(self) -> list[tuple[str, str]]:
        return [(r.method, r.url.path) for r in self.requests]

    def body(self, index: int = -1) -> dict:
        return json.loads(self.requests[index].content)


def answer(status: int, body: object = None, headers: dict[str, str] | None = None) -> Callable[[httpx.Request], httpx.Response]:
    return lambda _: httpx.Response(status, json=body if body is not None else {}, headers=headers)


# ---------- check_access ----------


def test_check_access_reads_permissions_and_sends_auth_headers():
    github = FakeGitHub(answer(200, {"html_url": "https://github.com/acme/app", "permissions": {"admin": True, "push": True}}))
    access = run(github.host().check_access(REPO))
    assert (access.status, access.url, access.can_write, access.can_admin) == ("ok", "https://github.com/acme/app", True, True)
    request = github.requests[0]
    assert (request.method, request.url.path) == ("GET", "/repos/acme/app")
    assert request.headers["Authorization"] == "Bearer tok"
    assert request.headers["Accept"] == "application/vnd.github+json"
    assert request.headers["X-GitHub-Api-Version"] == "2022-11-28"


def test_check_access_read_only_token_has_no_write_permissions():
    github = FakeGitHub(answer(200, {"html_url": "u", "permissions": {"pull": True}}))
    access = run(github.host().check_access(REPO))
    assert (access.can_write, access.can_admin) == (False, False)
    assert access.problem(needs_webhook=False) == "missing_permissions"


@pytest.mark.parametrize(("status", "reason"), [(404, "not_found"), (401, "forbidden"), (403, "missing_permissions")])
def test_check_access_maps_client_errors(status, reason):
    github = FakeGitHub(answer(status, {"message": "nope"}))
    assert run(github.host().check_access(REPO)).status == reason
    assert len(github.requests) == 1  # client errors aren't retried


def test_5xx_is_retried_with_backoff_then_unavailable():
    github = FakeGitHub(answer(502, {"message": "Bad gateway"}))
    with pytest.raises(CodeHostUnavailable):
        run(github.host(retries=2).check_access(REPO))
    assert len(github.requests) == 3 and github.sleeps == [0.5, 1.0]


def test_transient_failure_recovers_on_retry():
    answers = iter([httpx.Response(503), httpx.Response(200, json={"html_url": "u", "permissions": {"push": True}})])
    github = FakeGitHub(lambda _: next(answers))
    assert run(github.host().check_access(REPO)).status == "ok"
    assert len(github.requests) == 2


def test_secondary_rate_limit_waits_retry_after():
    answers = iter(
        [
            httpx.Response(403, json={"message": "You have exceeded a secondary rate limit"}, headers={"Retry-After": "3"}),
            httpx.Response(200, json={"html_url": "u", "permissions": {"push": True}}),
        ]
    )
    github = FakeGitHub(lambda _: next(answers))
    assert run(github.host().check_access(REPO)).status == "ok"
    assert github.sleeps == [3.0]


def test_timeout_becomes_unavailable():
    def timeout(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectTimeout("slow", request=request)

    github = FakeGitHub(timeout)
    with pytest.raises(CodeHostUnavailable):
        run(github.host(retries=1).check_access(REPO))
    assert len(github.requests) == 2


# ---------- webhooks ----------


def test_register_webhook_subscribes_to_issues_and_prs():
    github = FakeGitHub(answer(201, {"id": 42}))
    hook_id = run(github.host().register_webhook(REPO, "https://x.test/webhooks/github", "s3cret"))
    assert hook_id == 42
    assert github.calls() == [("POST", "/repos/acme/app/hooks")]
    body = github.body()
    assert body["events"] == ["issues", "pull_request"] and body["active"] is True
    assert body["config"] == {"url": "https://x.test/webhooks/github", "content_type": "json", "insecure_ssl": "0", "secret": "s3cret"}


def test_register_webhook_rejected_raises_github_error():
    github = FakeGitHub(answer(422, {"message": "Hook already exists on this repository"}))
    with pytest.raises(GitHubError) as info:
        run(github.host().register_webhook(REPO, "https://x.test/webhooks/github", ""))
    assert info.value.status == 422


def test_delete_webhook_ignores_a_missing_hook():
    github = FakeGitHub(answer(204))
    run(github.host().delete_webhook(REPO, 42))
    assert github.calls() == [("DELETE", "/repos/acme/app/hooks/42")]
    run(FakeGitHub(answer(404, {"message": "Not Found"})).host().delete_webhook(REPO, 42))
    with pytest.raises(GitHubError):
        run(FakeGitHub(answer(403, {"message": "Must have admin rights"})).host().delete_webhook(REPO, 42))
