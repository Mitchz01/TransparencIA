"""CodeHost on GitHub's REST API (spec 007). All GitHub knowledge stays in this package."""

from typing import Literal

from app.adapters.outbound.code_host.github.client import GitHubClient, GitHubError
from app.domain.integrations import RepoAccess

# GitHub roles that can create issues with labels/assignees, comment and request reviews.
WRITE_ROLES = ("push", "maintain", "admin")
WEBHOOK_EVENTS = ["issues", "pull_request"]


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
