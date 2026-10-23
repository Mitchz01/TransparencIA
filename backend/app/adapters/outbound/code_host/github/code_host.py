"""CodeHost on GitHub's REST API (spec 007). All GitHub knowledge stays in this package."""

from typing import Literal

from app.adapters.outbound.code_host.github.client import GitHubClient, GitHubError
from app.domain.integrations import IssueRef, RepoAccess

# GitHub roles that can create issues with labels/assignees, comment and request reviews.
WRITE_ROLES = ("push", "maintain", "admin")
WEBHOOK_EVENTS = ["issues", "pull_request"]
GONE = (404, 410)  # the issue was deleted (410) or can't be found anymore (404)


class GitHubCodeHost:
    mode: Literal["github", "test"] = "github"

    def __init__(self, token: str, client: GitHubClient | None = None):
        self._client = client or GitHubClient(token)

    # ---------- Connection (US1) ----------

    async def check_access(self, repository: str) -> RepoAccess:
        try:
            response = await self._client.request("GET", f"/repos/{repository}")
        except GitHubError as error:
            if error.status == 404:  # also what GitHub answers for a private repo the token can't see
                return RepoAccess(status="not_found")
            if error.status == 401:
                return RepoAccess(status="forbidden")
            if error.status == 403:
                return RepoAccess(status="missing_permissions")
            raise
        data = response.json()
        permissions = data.get("permissions") or {}
        return RepoAccess(
            status="ok",
            url=data.get("html_url", f"https://github.com/{repository}"),
            can_write=any(permissions.get(role) for role in WRITE_ROLES),
            can_admin=bool(permissions.get("admin")),
        )

    async def register_webhook(self, repository: str, url: str, secret: str) -> int:
        config = {"url": url, "content_type": "json", "insecure_ssl": "0", **({"secret": secret} if secret else {})}
        response = await self._client.request(
            "POST", f"/repos/{repository}/hooks", json={"name": "web", "active": True, "events": WEBHOOK_EVENTS, "config": config}
        )
        return int(response.json()["id"])

    async def delete_webhook(self, repository: str, hook_id: int) -> None:
        try:
            await self._client.request("DELETE", f"/repos/{repository}/hooks/{hook_id}")
        except GitHubError as error:
            if error.status != 404:  # already gone: nothing to do
                raise

    # ---------- Issues (US2) ----------

    async def create_issue(self, repository: str, title: str, body: str, labels: list[str], assignees: list[str]) -> IssueRef:
        payload = {"title": title, "body": body, "labels": labels, "assignees": assignees}
        try:
            response = await self._client.request("POST", f"/repos/{repository}/issues", json=payload)
        except GitHubError as error:
            # 422 is usually an assignee who can't be assigned (no repo access): retry once without them.
            if error.status != 422 or not assignees:
                raise
            response = await self._client.request("POST", f"/repos/{repository}/issues", json={**payload, "assignees": []})
        data = response.json()
        return IssueRef(number=int(data["number"]), url=data["html_url"])

    async def update_issue(
        self, repository: str, number: int, title: str, body: str, labels: list[str], assignees: list[str]
    ) -> bool:
        payload = {"title": title, "body": body, "labels": labels, "assignees": assignees}
        path = f"/repos/{repository}/issues/{number}"
        try:
            try:
                await self._client.request("PATCH", path, json=payload)
            except GitHubError as error:
                if error.status != 422 or not assignees:
                    raise
                await self._client.request("PATCH", path, json={**payload, "assignees": []})
        except GitHubError as error:
            if error.status in GONE:
                return False
            raise
        return True

    async def close_issue(self, repository: str, number: int, reason: Literal["completed", "not_planned"], comment: str) -> bool:
        try:
            await self._client.request("POST", f"/repos/{repository}/issues/{number}/comments", json={"body": comment})
            await self._client.request(
                "PATCH", f"/repos/{repository}/issues/{number}", json={"state": "closed", "state_reason": reason}
            )
        except GitHubError as error:
            if error.status in GONE:
                return False
            raise
        return True
