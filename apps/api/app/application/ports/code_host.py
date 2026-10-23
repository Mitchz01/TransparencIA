from collections.abc import Awaitable, Callable
from typing import Literal, Protocol

from app.domain.integrations import IssueRef, PullRequestRef, RepoAccess

# "github" = real calls; "test" = FakeCodeHost, nothing reaches GitHub (spec 007, FR-005).
CodeHostMode = Literal["github", "test"]


class CodeHost(Protocol):
    """Code host (GitHub today). Always works on the project's single repo.

    Failures: GitHub not answering (5xx, timeout, rate limit, after retries) raises
    CodeHostUnavailable; anything else GitHub rejects raises an adapter error."""

    mode: CodeHostMode

    async def check_access(self, repository: str) -> RepoAccess: ...
    async def register_webhook(self, repository: str, url: str, secret: str) -> int:
        """Subscribes to the repo's PR and issue events; returns the webhook id."""
        ...
    async def delete_webhook(self, repository: str, hook_id: int) -> None: ...
    async def create_issue(self, repository: str, title: str, body: str, labels: list[str], assignees: list[str]) -> IssueRef: ...
    async def update_issue(
        self, repository: str, number: int, title: str, body: str, labels: list[str], assignees: list[str]
    ) -> bool:
        """False if the issue no longer exists on GitHub (the link becomes broken)."""
        ...
    async def close_issue(self, repository: str, number: int, reason: Literal["completed", "not_planned"], comment: str) -> bool:
        """Posts `comment` and closes the issue; False if it no longer exists."""
        ...
    async def user_has_access(self, repository: str, username: str) -> bool: ...
    async def get_pull_request(self, repository: str, number: int) -> PullRequestRef: ...
    async def get_pull_request_diff(self, repository: str, number: int) -> str: ...
    async def request_review(self, repository: str, number: int, reviewers: list[str]) -> None: ...
    async def comment_on_pull_request(self, repository: str, number: int, body: str) -> None: ...


# Called before each retry of a failed GitHub call (5xx, timeout, rate limit; T034) with the
# retry's number (1 = first retry) and the seconds until it: the use case shows "delayed".
OnRetry = Callable[[int, float], Awaitable[None]]


class CodeHostFactory(Protocol):
    """Picks the code host for a project's token (FR-004): the project's token, else the
    installation's, else FakeCodeHost (test mode). Built in the composition root.
    `on_retry` is told about every retry the host makes while GitHub is failing."""

    def __call__(self, token: str | None, on_retry: OnRetry | None = None) -> CodeHost: ...
