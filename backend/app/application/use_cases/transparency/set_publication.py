"""Publish or unpublish a project's portal; the slug is stable (spec 017, US3, D9). Owner: P3."""

from app.application.ports.unit_of_work import UnitOfWork


class SetPublication:
    def __init__(self, uow: UnitOfWork, public_app_url: str):
        self._uow = uow
        self._public_app_url = public_app_url

    def execute(self, project_id: int, public: bool) -> tuple[bool, str | None]:
        """Returns (public, public_url)."""
        raise NotImplementedError
