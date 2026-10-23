"""Project activity: history and the live SSE stream with replay (spec 005, UC-14).
This is the only streaming endpoint (plan/api-conventions.md, "Server-Sent Events")."""

from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends, Header, Query, Request
from sse_starlette.sse import EventSourceResponse

from app.adapters.inbound.http import dependencies as deps
from app.application.use_cases.activity.list_activity import DEFAULT_LIMIT, FollowActivity, ListActivity
from app.application.ports.unit_of_work import UnitOfWorkFactory
from app.application.use_cases.accounts.authorize import AuthorizeAccess
from app.domain.accounts import Account
from app.domain.errors import ValidationFailed
from app.domain.events import DomainEvent

router = APIRouter(prefix="/api/projects", tags=["activity"])

PING_SECONDS = 15


@router.get("/{project_id}/activity", response_model=list[DomainEvent], dependencies=[Depends(deps.allow("view"))])
def list_activity(
    project_id: int,
    before: int | None = Query(None),
    limit: int = Query(DEFAULT_LIMIT),
    use_case: ListActivity = Depends(deps.get_list_activity),
) -> list[DomainEvent]:
    return use_case.execute(project_id, before, limit)


def _start_after(last_event_id: str | None, after: int | None) -> int | None:
    if last_event_id is None or last_event_id == "":
        return after
    try:
        return int(last_event_id)
    except ValueError:
        raise ValidationFailed.single("Last-Event-ID", "Must be an integer.") from None


def sse_message(event: DomainEvent) -> dict[str, str]:
    message = {"event": event.type, "data": event.model_dump_json()}
    if event.seq is not None:
        message["id"] = str(event.seq)  # EventSource sends it back as Last-Event-ID
    return message


@router.get("/{project_id}/events")
async def events(
    project_id: int,
    request: Request,
    after: int | None = Query(None),
    last_event_id: str | None = Header(None),
    account: Account = Depends(deps.current_account),
    authorize: AuthorizeAccess = Depends(deps.get_authorize_access),
    uow_factory: UnitOfWorkFactory = Depends(deps.get_uow_factory),
    follow: FollowActivity = Depends(deps.get_follow_activity),
) -> EventSourceResponse:
    authorize.execute(account, "project", project_id, "view")  # 404 as JSON before the stream starts
    start = _start_after(last_event_id, after)

    def still_member() -> bool:
        # Spec 015 (FR-014): a removed member stops receiving events. The request's session is
        # closed once the stream starts, so each check opens its own unit of work.
        with uow_factory() as uow:
            return AuthorizeAccess(uow).allows(account, "project", project_id, "view")

    async def stream() -> AsyncIterator[dict[str, str]]:
        async for event in follow.stream(project_id, start):
            if await request.is_disconnected() or not still_member():
                break
            yield sse_message(event)

    return EventSourceResponse(
        stream(),
        ping=PING_SECONDS,
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
