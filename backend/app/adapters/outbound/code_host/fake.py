from dataclasses import dataclass, field
from typing import Any

from app.domain.integrations import IssueRef, PullRequestRef


@dataclass
class FakeCodeHost:
    """In-memory CodeHost: records calls instead of calling GitHub (tokenless demo and tests)."""

    calls: list[tuple[str, dict[str, Any]]] = field(default_factory=list)
    _next_number: int = 1

    async def create_issue(self, repository: str, title: str, body: str, labels: list[str]) -> IssueRef:
        number = self._take_number()
        self.calls.append(("create_issue", {"repository": repository, "title": title, "number": number}))
        return IssueRef(number=number, url=f"https://github.com/{repository}/issues/{number}")

    async def close_issue(self, repository: str, number: int) -> None:
        self.calls.append(("close_issue", {"repository": repository, "number": number}))

    async def open_pull_request(self, repository: str, title: str, body: str, head: str, base: str) -> PullRequestRef:
        number = self._take_number()
        self.calls.append(("open_pull_request", {"repository": repository, "title": title, "number": number}))
        return PullRequestRef(number=number, url=f"https://github.com/{repository}/pull/{number}")

    async def request_review(self, repository: str, number: int, reviewers: list[str]) -> None:
        self.calls.append(("request_review", {"repository": repository, "number": number, "reviewers": reviewers}))

    async def get_pull_request(self, repository: str, number: int) -> PullRequestRef:
        return PullRequestRef(number=number, url=f"https://github.com/{repository}/pull/{number}")

    def _take_number(self) -> int:
        number = self._next_number
        self._next_number += 1
        return number
