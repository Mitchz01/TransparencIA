"""Publish or unpublish a project's portal; the slug is stable (spec 017, US3, D9). Owner: P3."""

import secrets

from app.application.ports.unit_of_work import UnitOfWork
from app.domain.errors import ProjectNotFound
from app.domain.transparency import BudgetMissing


def public_url_for(public_app_url: str, slug: str | None) -> str | None:
    """`/p/{slug}` behind PUBLIC_APP_URL; relative when it's empty and the frontend adds its origin."""
    return f"{public_app_url}/p/{slug}" if slug else None


class SetPublication:
    def __init__(self, uow: UnitOfWork, public_app_url: str):
        self._uow = uow
        self._public_app_url = public_app_url

    def execute(self, project_id: int, public: bool) -> tuple[bool, str | None]:
        """Returns (public, public_url). The link survives unpublishing, so republishing keeps it."""
        project = self._uow.projects.get(project_id)
        if project is None:
            raise ProjectNotFound(project_id)
        if public and self._uow.budgets.get(project_id) is None:
            raise BudgetMissing(project_id)
        slug = project.public_slug
        if public and slug is None:
            slug = self._new_slug()
        saved = self._uow.projects.save(project.model_copy(update={"public": public, "public_slug": slug}))
        self._uow.commit()
        return saved.public, public_url_for(self._public_app_url, saved.public_slug)

    def _new_slug(self) -> str:
        while True:
            slug = secrets.token_urlsafe(8)
            if self._uow.projects.get_by_public_slug(slug) is None:
                return slug
