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


# ---------- issues ----------


def test_create_issue():
    github = FakeGitHub(answer(201, {"number": 12, "html_url": "https://github.com/acme/app/issues/12"}))
    issue = run(github.host().create_issue(REPO, "Login", "Body", ["type:feature"], ["ana"]))
    assert (issue.number, issue.url, issue.state) == (12, "https://github.com/acme/app/issues/12", "open")
    assert github.calls() == [("POST", "/repos/acme/app/issues")]
    assert github.body() == {"title": "Login", "body": "Body", "labels": ["type:feature"], "assignees": ["ana"]}


def test_create_issue_retries_once_without_assignees_on_422():
    answers = iter(
        [
            httpx.Response(422, json={"message": "Validation Failed"}),
            httpx.Response(201, json={"number": 3, "html_url": "u3"}),
        ]
    )
    github = FakeGitHub(lambda _: next(answers))
    assert run(github.host().create_issue(REPO, "Login", "Body", [], ["stranger"])).number == 3
    assert [github.body(0)["assignees"], github.body(1)["assignees"]] == [["stranger"], []]

    still_failing = FakeGitHub(answer(422, {"message": "Validation Failed"}))
    with pytest.raises(GitHubError):
        run(still_failing.host().create_issue(REPO, "Login", "Body", [], ["stranger"]))
    assert len(still_failing.requests) == 2  # only one retry
    no_assignees = FakeGitHub(answer(422, {"message": "Validation Failed"}))
    with pytest.raises(GitHubError):
        run(no_assignees.host().create_issue(REPO, "Login", "Body", [], []))
    assert len(no_assignees.requests) == 1


def test_update_issue():
    github = FakeGitHub(answer(200, {"number": 12}))
    assert run(github.host().update_issue(REPO, 12, "New title", "Body", ["priority:high"], [])) is True
    assert github.calls() == [("PATCH", "/repos/acme/app/issues/12")]
    assert github.body() == {"title": "New title", "body": "Body", "labels": ["priority:high"], "assignees": []}


@pytest.mark.parametrize("status", [404, 410])
def test_update_issue_deleted_on_github_returns_false(status):
    github = FakeGitHub(answer(status, {"message": "This issue was deleted"}))
    assert run(github.host().update_issue(REPO, 12, "T", "B", [], [])) is False


def test_update_issue_retries_without_assignees_on_422():
    answers = iter([httpx.Response(422, json={"message": "Validation Failed"}), httpx.Response(200, json={})])
    github = FakeGitHub(lambda _: next(answers))
    assert run(github.host().update_issue(REPO, 12, "T", "B", [], ["stranger"])) is True
    assert github.body(1)["assignees"] == []


def test_close_issue_comments_then_closes_as_not_planned():
    github = FakeGitHub(answer(200, {}))
    assert run(github.host().close_issue(REPO, 12, "not_planned", "Discarded: out of scope")) is True
    assert github.calls() == [("POST", "/repos/acme/app/issues/12/comments"), ("PATCH", "/repos/acme/app/issues/12")]
    assert github.body(0) == {"body": "Discarded: out of scope"}
    assert github.body(1) == {"state": "closed", "state_reason": "not_planned"}

    assert run(FakeGitHub(answer(410, {"message": "Gone"})).host().close_issue(REPO, 12, "not_planned", "x")) is False


# ---------- usernames ----------


def test_user_has_access():
    github = FakeGitHub(lambda _: httpx.Response(204))
    assert run(github.host().user_has_access(REPO, "ana")) is True
    assert github.calls() == [("GET", "/repos/acme/app/collaborators/ana")]
    assert run(FakeGitHub(answer(404, {"message": "Not Found"})).host().user_has_access(REPO, "stranger")) is False


# ---------- pull requests ----------


def test_get_pull_request_reads_state_and_closing_refs():
    github = FakeGitHub(answer(200, {"html_url": "https://github.com/acme/app/pull/30", "state": "closed", "merged": True, "body": "Closes #12"}))
    pr = run(github.host().get_pull_request(REPO, 30))
    assert (pr.number, pr.url, pr.state, pr.closes) == (30, "https://github.com/acme/app/pull/30", "merged", [12])


def test_get_pull_request_diff_asks_for_the_diff_media_type():
    github = FakeGitHub(lambda _: httpx.Response(200, text="diff --git a/x b/x\n+1\n"))
    assert run(github.host().get_pull_request_diff(REPO, 30)) == "diff --git a/x b/x\n+1\n"
    request = github.requests[0]
    assert (request.method, request.url.path) == ("GET", "/repos/acme/app/pulls/30")
    assert request.headers["Accept"] == "application/vnd.github.diff"


def test_request_review_and_comment():
    github = FakeGitHub(answer(201, {}))
    host = github.host()
    run(host.request_review(REPO, 30, ["bruno", "carla"]))
    run(host.comment_on_pull_request(REPO, 30, "Looks good."))
    assert github.calls() == [("POST", "/repos/acme/app/pulls/30/requested_reviewers"), ("POST", "/repos/acme/app/issues/30/comments")]
    assert github.body(0) == {"reviewers": ["bruno", "carla"]} and github.body(1) == {"body": "Looks good."}


def test_both_code_hosts_implement_the_whole_port():
    from app.adapters.outbound.code_host.fake import FakeCodeHost
    from app.application.ports.code_host import CodeHost

    port = {name for name, value in vars(CodeHost).items() if callable(value) and not name.startswith("_")}
    assert "open_pull_request" not in port and len(port) == 11
    for host in (GitHubCodeHost, FakeCodeHost):
        assert port <= set(dir(host)), host
    assert (GitHubCodeHost.mode, FakeCodeHost().mode) == ("github", "test")


def test_request_review_of_a_non_collaborator_raises():
    github = FakeGitHub(answer(422, {"message": "Reviews may only be requested from collaborators."}))
    with pytest.raises(GitHubError) as info:
        run(github.host().request_review(REPO, 30, ["stranger"]))
    assert info.value.status == 422
