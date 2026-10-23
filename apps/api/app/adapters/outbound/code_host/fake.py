from dataclasses import dataclass, field
from typing import Any, Literal

from app.domain.integrations import IssueRef, PullRequestRef, RepoAccess


@dataclass
class FakeCodeHost:
    """In-memory CodeHost: records calls instead of calling GitHub (tokenless demo and tests).

    Every repo is accessible and every user has access unless listed in the fields below,
    which tests use to simulate GitHub's answers."""

    calls: list[tuple[str, dict[str, Any]]] = field(default_factory=list)
    _next_number: int = 1
    # repo -> what check_access answers instead of "ok with every permission"
    access: dict[str, RepoAccess] = field(default_factory=dict)
    users_without_access: set[str] = field(default_factory=set)
    # issue numbers deleted on GitHub: update/close answer False
    deleted_issues: set[int] = field(default_factory=set)
    # PR number -> diff
    diffs: dict[int, str] = field(default_factory=dict)
    mode: Literal["github", "test"] = "test"

    async def check_access(self, repository: str) -> RepoAccess:
        self.calls.append(("check_access", {"repository": repository}))
        default = RepoAccess(status="ok", url=f"https://github.com/{repository}", can_write=True, can_admin=True)
        return self.access.get(repository, default)

    async def register_webhook(self, repository: str, url: str, secret: str) -> int:
        hook_id = self._take_number()
        self.calls.append(("register_webhook", {"repository": repository, "url": url, "hook_id": hook_id}))
        return hook_id

    async def delete_webhook(self, repository: str, hook_id: int) -> None:
        self.calls.append(("delete_webhook", {"repository": repository, "hook_id": hook_id}))

    async def create_issue(self, repository: str, title: str, body: str, labels: list[str], assignees: list[str]) -> IssueRef:
        number = self._take_number()
        self.calls.append(
            (
                "create_issue",
                {"repository": repository, "title": title, "body": body, "labels": labels, "assignees": assignees, "number": number},
            )
        )
        return IssueRef(number=number, url=f"https://github.com/{repository}/issues/{number}")

    async def update_issue(
        self, repository: str, number: int, title: str, body: str, labels: list[str], assignees: list[str]
    ) -> bool:
        self.calls.append(
            (
                "update_issue",
                {"repository": repository, "number": number, "title": title, "body": body, "labels": labels, "assignees": assignees},
            )
        )
        return number not in self.deleted_issues

    async def close_issue(self, repository: str, number: int, reason: Literal["completed", "not_planned"], comment: str) -> bool:
        self.calls.append(("close_issue", {"repository": repository, "number": number, "reason": reason, "comment": comment}))
        return number not in self.deleted_issues

    async def user_has_access(self, repository: str, username: str) -> bool:
        self.calls.append(("user_has_access", {"repository": repository, "username": username}))
        return username not in self.users_without_access

    async def get_pull_request(self, repository: str, number: int) -> PullRequestRef:
        return PullRequestRef(number=number, url=f"https://github.com/{repository}/pull/{number}")

    async def get_pull_request_diff(self, repository: str, number: int) -> str:
        self.calls.append(("get_pull_request_diff", {"repository": repository, "number": number}))
        return self.diffs.get(number, "diff --git a/app.py b/app.py\n+print('hello')\n")

    async def request_review(self, repository: str, number: int, reviewers: list[str]) -> None:
        self.calls.append(("request_review", {"repository": repository, "number": number, "reviewers": reviewers}))

    async def comment_on_pull_request(self, repository: str, number: int, body: str) -> None:
        self.calls.append(("comment_on_pull_request", {"repository": repository, "number": number, "body": body}))

    def called(self, name: str) -> list[dict[str, Any]]:
        """The arguments of every call to `name`, in order."""
        return [args for call, args in self.calls if call == name]

    def _take_number(self) -> int:
        number = self._next_number
        self._next_number += 1
        return number
