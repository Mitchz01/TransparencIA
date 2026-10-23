"""Minimal GitHub REST client: base URL, auth headers, retries and error mapping.

Error mapping (plan 007, "Calls to GitHub"):
- timeout, connection error, 5xx, 429 or a secondary rate limit → retried with exponential
  backoff (or the Retry-After header); `on_retry(retry, wait_seconds)` is awaited before each
  wait, so the proposal being applied shows "delayed" (T034); if it still fails →
  CodeHostUnavailable (502 in a request).
- any other non-2xx → GitHubError with the status, for GitHubCodeHost to interpret."""

import asyncio
from collections.abc import Awaitable, Callable
from typing import Any

import httpx

from app.application.ports.code_host import OnRetry
from app.domain.errors import CodeHostUnavailable

API_URL = "https://api.github.com"
API_VERSION = "2022-11-28"

Sleep = Callable[[float], Awaitable[None]]


class GitHubError(Exception):
    """GitHub answered with a client error (4xx) that isn't worth retrying."""

    def __init__(self, status: int, message: str):
        super().__init__(f"GitHub answered {status}: {message}")
        self.status = status
        self.message = message


def _message(response: httpx.Response) -> str:
    try:
        return str(response.json().get("message", ""))
    except ValueError:
        return response.text[:200]


def _is_transient(response: httpx.Response) -> bool:
    if response.status_code >= 500 or response.status_code == 429:
        return True
    # Secondary rate limits come as 403 with a Retry-After header or a "rate limit" message.
    if response.status_code == 403:
        return "retry-after" in response.headers or response.headers.get("x-ratelimit-remaining") == "0" or (
            "rate limit" in _message(response).lower()
        )
    return False


class GitHubClient:
    def __init__(
        self,
        token: str,
        *,
        base_url: str = API_URL,
        transport: httpx.AsyncBaseTransport | None = None,
        timeout: float = 10.0,
        retries: int = 3,
        backoff_seconds: float = 0.5,
        sleep: Sleep = asyncio.sleep,
        on_retry: OnRetry | None = None,
    ):
        self._base_url = base_url
        self._transport = transport  # tests pass an httpx.MockTransport
        self._timeout = timeout
        self._retries = retries
        self._backoff = backoff_seconds
        self._sleep = sleep
        self._on_retry = on_retry
        self._headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": API_VERSION,
            "User-Agent": "agile-planner",
        }

    async def request(
        self, method: str, path: str, *, json: dict[str, Any] | None = None, accept: str | None = None
    ) -> httpx.Response:
        """The 2xx response; raises GitHubError (4xx) or CodeHostUnavailable (after retries)."""
        headers = {**self._headers, **({"Accept": accept} if accept else {})}
        for attempt in range(self._retries + 1):
            last_attempt = attempt == self._retries
            try:
                async with httpx.AsyncClient(base_url=self._base_url, transport=self._transport, timeout=self._timeout) as client:
                    response = await client.request(method, path, json=json, headers=headers)
            except httpx.TransportError as error:  # timeouts and connection errors
                if last_attempt:
                    raise CodeHostUnavailable(f"GitHub didn't answer ({error.__class__.__name__}).") from None
            else:
                if response.is_success:
                    return response
                if not _is_transient(response):
                    raise GitHubError(response.status_code, _message(response))
                if last_attempt:
                    raise CodeHostUnavailable(f"GitHub failed with {response.status_code}. Try again in a moment.")
                retry_after = response.headers.get("retry-after", "")
                if retry_after.isdigit():
                    await self._wait(attempt, min(float(retry_after), 60.0))
                    continue
            await self._wait(attempt, self._backoff * 2**attempt)
        raise AssertionError("unreachable")

    async def _wait(self, attempt: int, seconds: float) -> None:
        if self._on_retry is not None:
            await self._on_retry(attempt + 1, seconds)
        await self._sleep(seconds)
