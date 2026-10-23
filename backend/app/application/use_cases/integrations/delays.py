"""Shows a `github_action` proposal as "delayed" while GitHub is failing (spec 007, T034).

The code host retries 5xx, timeouts and rate limits with backoff; before each wait it calls
this callback, which publishes GithubActionDelayed. Nothing is stored on the proposal: it
stops being delayed when its application ends (issues_published, review_requested or
proposal_apply_failed for the same proposal)."""

from app.application.ports.code_host import OnRetry
from app.application.ports.event_bus import EventBus
from app.domain.events import EventRef, GithubActionDelayed


def report_delays(bus: EventBus, project_id: int, proposal_id: int, action: str) -> OnRetry:
    async def on_retry(attempt: int, wait_seconds: float) -> None:
        await bus.publish(
            GithubActionDelayed(
                project_id=project_id,
                proposal_id=proposal_id,
                attempt=attempt,
                retry_in_seconds=wait_seconds,
                summary=f"GitHub isn't answering: {action} retry {attempt} in {wait_seconds:g}s (proposal #{proposal_id})",
                ref=EventRef(kind="proposal", id=proposal_id),
            )
        )

    return on_retry
