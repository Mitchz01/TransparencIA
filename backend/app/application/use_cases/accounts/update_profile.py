"""UC-15 · Edit my profile (spec 015, US2). A new name renames me in every project; nothing else
the projects copied changes (FR-013)."""

from collections.abc import Sequence

from app.application.dto import ProfileUpdate
from app.application.ports.event_bus import EventBus
from app.application.ports.unit_of_work import UnitOfWork
from app.application.use_cases.projects.team import TeamChangedHandler, TeamChanges, with_member_changed
from app.domain.accounts import Account, member_of, unique_name, validate_profile
from app.domain.errors import FieldError, ValidationFailed

NULLABLE = frozenset({"role", "github_username"})


class UpdateProfile:
    def __init__(self, uow: UnitOfWork, bus: EventBus, on_team_changed: Sequence[TeamChangedHandler] = ()):
        self._uow = uow
        self._changes = TeamChanges(uow, bus, on_team_changed)

    async def execute(self, account: Account, data: ProfileUpdate) -> Account:
        sent = data.model_dump(include=data.model_fields_set)
        if not sent:
            raise ValidationFailed.single("", "No fields to update.")
        required = [FieldError(name, "Required.") for name, value in sent.items() if value is None and name not in NULLABLE]
        if required:
            raise ValidationFailed(required, "The profile has invalid fields.")

        saved = self._uow.accounts.save(validate_profile(account.model_copy(update=sent)))
        if saved.name != account.name:
            self._rename_in_projects(saved)
        self._uow.commit()
        await self._changes.publish()
        return saved

    def _rename_in_projects(self, account: Account) -> None:
        for project in self._uow.projects.list_by_account(account.id or 0):
            member = member_of(project, account.id)
            if member is None or member.id is None:
                continue
            name = unique_name(account.name, [m.name for m in project.members if m.id != member.id])
            if name != member.name:
                edited, diff = with_member_changed(project, member.id, {"name": name})
                self._changes.stage(edited, diff)
