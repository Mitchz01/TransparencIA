"""Background work outside the request (agents, applying proposals). Shared with spec 002."""

import asyncio
from collections.abc import Coroutine
from typing import Any

from app.config import logger

_tasks: set[asyncio.Task[Any]] = set()


def spawn(coro: Coroutine[Any, Any, Any]) -> asyncio.Task[Any]:
    """Runs `coro` in the background, keeps a reference until it's done and logs failures."""
    task = asyncio.get_running_loop().create_task(coro)
    _tasks.add(task)

    def _done(finished: asyncio.Task[Any]) -> None:
        _tasks.discard(finished)
        if not finished.cancelled() and finished.exception() is not None:
            logger.error("Background task failed", exc_info=finished.exception())

    task.add_done_callback(_done)
    return task


async def wait_for_background() -> None:
    """Tests use it to let spawned work finish before asserting."""
    while _tasks:
        await asyncio.gather(*list(_tasks), return_exceptions=True)
