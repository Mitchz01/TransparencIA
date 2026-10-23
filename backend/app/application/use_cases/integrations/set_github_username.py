"""Register a member's GitHub username (spec 007, US3, FR-012).

The username is saved even when the user can't access the repo: `has_access` warns about
it. GitHub being down never fails the request (`has_access` is then None)."""

import logging

from app.application.dto import MemberGithubAccess
from app.application.ports.code_host import CodeHostFactory
from app.application.ports.unit_of_work import UnitOfWork
from app.domain.errors import MemberNotFound
from app.domain.integrations import validate_github_username

logger = logging.getLogger("agile")


class SetGithubUsername:
    def __init__(self, uow: UnitOfWork, code_hosts: CodeHostFactory):
        self._uow = uow
        self._code_hosts = code_hosts

    async def execute(self, member_id: int, username: str | None) -> MemberGithubAccess:
        project = self._uow.projects.get_by_member(member_id)
        if project is None:
            raise MemberNotFound(member_id)
        clean = validate_github_username(username)

        member = next(m for m in project.members if m.id == member_id)
        member.github_username = clean
        saved = self._uow.projects.save(project)
        self._uow.commit()
        member = next(m for m in saved.members if m.id == member_id)

        has_access: bool | None = None
        if clean is not None and project.repository is not None:
            try:
                has_access = await self._code_hosts(project.github_token).user_has_access(project.repository, clean)
            except Exception:  # noqa: BLE001  GitHub down: saved anyway, access unknown
                logger.warning("Couldn't check %s's access to %s", clean, project.repository, exc_info=True)
        return MemberGithubAccess(member=member, has_access=has_access)
