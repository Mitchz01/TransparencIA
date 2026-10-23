"""UC-16, UC-17 · Join a project and manage its team (spec 015, US4 and US6).

Every team change goes through spec 001's `apply_update` with the whole team, so names stay
unique, limits are checked and the diff publishes the same `team_changed` event (001, US4)."""

from collections.abc import Awaitable, Callable, Sequence
from typing import Any

from app.application.dto import JoinRequest, JoinResult, MemberUpdate
from app.application.ports.event_bus import EventBus
from app.application.ports.unit_of_work import UnitOfWork
from app.domain.accounts import Account, ensure_leader, member_from_profile, member_of, project_role
from app.domain.errors import (
    FieldError,
    Forbidden,
    InvitationNotFound,
    MemberNotFound,
    ProjectNotFound,
    ValidationFailed,
)
from app.domain.events import EventRef, MemberChangeInfo, TeamChanged
from app.domain.project import Member, MemberPatch, Project, ProjectChanges, TeamDiff, apply_update

# Spec 008 registers its drift-replan handler here (contract 001 → 008).
TeamChangedHandler = Callable[[TeamChanged], Awaitable[None]]


def _summary(diff: TeamDiff) -> str:
    parts = [f"{name} joined" for name in diff.joined]
    parts += [f"{name} left" for name in diff.left]
    parts += [f"{c.name} changed ({', '.join(c.fields)})" for c in diff.changed]
    return "Team changed: " + "; ".join(parts)


def _member_fields(error: ValidationFailed) -> ValidationFailed:
    """`members[2].role` → `role`: the request edits one member, so its fields are top level."""
    errors = [
        FieldError(e.field.split(".", 1)[1] if e.field.startswith("members[") and "." in e.field else e.field, e.message)
        for e in error.errors
    ]
    return ValidationFailed(errors, "The member has invalid fields.")


def with_member_changed(project: Project, member_id: int, values: dict[str, Any]) -> tuple[Project, TeamDiff]:
    patches = [MemberPatch(m.id, values if m.id == member_id else {}) for m in project.members]
    try:
        return apply_update(project, ProjectChanges(members=patches))
    except ValidationFailed as error:
        raise _member_fields(error) from None


def with_member_added(project: Project, member: Member) -> tuple[Project, TeamDiff]:
    patches = [MemberPatch(m.id, {}) for m in project.members]
    # apply_update reads a null as "clear this field", so unset optional fields aren't sent.
    patches.append(MemberPatch(None, member.model_dump(exclude={"id"}, exclude_none=True)))
    return apply_update(project, ProjectChanges(members=patches))


def with_member_removed(project: Project, member_id: int) -> tuple[Project, TeamDiff]:
    patches = [MemberPatch(m.id, {}) for m in project.members if m.id != member_id]
    return apply_update(project, ProjectChanges(members=patches))


class TeamChanges:
    """Saves team edits and, after the commit, publishes one `team_changed` per changed project,
    so nobody hears about a change that wasn't saved."""

    def __init__(self, uow: UnitOfWork, bus: EventBus, handlers: Sequence[TeamChangedHandler] = ()):
        self._uow = uow
        self._bus = bus
        self._handlers = list(handlers)
        self._pending: list[TeamChanged] = []

    def stage(self, edited: Project, diff: TeamDiff) -> Project:
        project_id = edited.id or 0
        # Pending tasks of whoever left become unassigned; done ones keep who did them (spec 001).
        if diff.left_ids:
            for task in self._uow.tasks.list_by_project(project_id):
                if task.assignee_id in diff.left_ids and task.status != "done":
                    self._uow.tasks.save(task.model_copy(update={"assignee_id": None}))
        saved = self._uow.projects.save(edited)
        if not diff.empty:
            self._pending.append(
                TeamChanged(
                    project_id=project_id,
                    summary=_summary(diff),
                    ref=EventRef(kind="project", id=project_id),
                    joined=diff.joined,
                    left=diff.left,
                    changed=[MemberChangeInfo(member_id=c.member_id, name=c.name, fields=c.fields) for c in diff.changed],
                )
            )
        return saved

    async def publish(self) -> None:
        events, self._pending = self._pending, []
        for event in events:
            await self._bus.publish(event)
            for handler in self._handlers:
                await handler(event)


def _project(uow: UnitOfWork, project_id: int) -> Project:
    project = uow.projects.get(project_id)
    if project is None:
        raise ProjectNotFound(project_id)
    return project


def _member(project: Project, member_id: int) -> Member:
    member = next((m for m in project.members if m.id == member_id), None)
    if member is None:
        raise MemberNotFound(member_id)
    return member


class JoinProject:
    """US4: whoever opens a valid link joins as Member with their profile (FR-010)."""

    def __init__(self, uow: UnitOfWork, bus: EventBus, on_team_changed: Sequence[TeamChangedHandler] = ()):
        self._uow = uow
        self._changes = TeamChanges(uow, bus, on_team_changed)

    async def execute(self, token: str, account: Account, data: JoinRequest) -> JoinResult:
        project = self._uow.projects.get_by_invite_token(token)
        if project is None:
            raise InvitationNotFound()
        if member_of(project, account.id) is not None:
            return JoinResult(project_id=project.id or 0, joined=False)

        role = project_role(data.role, account)
        member = member_from_profile(account, role, "member", [m.name for m in project.members])
        edited, diff = with_member_added(project, member)
        self._changes.stage(edited, diff)
        self._uow.commit()
        await self._changes.publish()
        return JoinResult(project_id=project.id or 0, joined=True)


class UpdateMember:
    """US6: a leader edits a member's data or permission (FR-013). Only data changes publish
    `team_changed`; permission isn't part of spec 001's diff."""

    def __init__(self, uow: UnitOfWork, bus: EventBus, on_team_changed: Sequence[TeamChangedHandler] = ()):
        self._uow = uow
        self._changes = TeamChanges(uow, bus, on_team_changed)

    async def execute(self, project_id: int, member_id: int, data: MemberUpdate) -> Project:
        project = _project(self._uow, project_id)
        _member(project, member_id)
        values = data.model_dump(include=data.model_fields_set)
        if not values:
            raise ValidationFailed.single("", "No fields to update.")

        edited, diff = with_member_changed(project, member_id, values)
        ensure_leader(edited.members)
        saved = self._changes.stage(edited, diff)
        self._uow.commit()
        await self._changes.publish()
        return saved


class RemoveMember:
    """US6: a leader removes anyone; a member can only leave (FR-014). The last leader can't go (FR-015)."""

    def __init__(self, uow: UnitOfWork, bus: EventBus, on_team_changed: Sequence[TeamChangedHandler] = ()):
        self._uow = uow
        self._changes = TeamChanges(uow, bus, on_team_changed)

    async def execute(self, project_id: int, member_id: int, actor: Member) -> None:
        project = _project(self._uow, project_id)
        _member(project, member_id)
        if actor.permission != "leader" and actor.id != member_id:
            raise Forbidden("Only the project's leaders can remove other members.")
        ensure_leader(m for m in project.members if m.id != member_id)

        edited, diff = with_member_removed(project, member_id)
        self._changes.stage(edited, diff)
        self._uow.commit()
        await self._changes.publish()
