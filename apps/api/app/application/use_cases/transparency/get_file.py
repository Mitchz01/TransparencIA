"""Serve a stored file: to the members of its project, and to anyone once it is the evidence of a
confirmed expense of a published portal (spec 017, US2 and US3). Owner: P3."""

from app.application.ports.unit_of_work import UnitOfWork
from app.domain.accounts import member_of
from app.domain.transparency import FileNotFound, StoredFile


class GetFile:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    def execute(self, file_id: int, account_id: int | None) -> StoredFile:
        """Anything the caller may not see is reported as not found, like a missing id."""
        file = self._uow.files.get(file_id)
        project = self._uow.projects.get(file.project_id) if file else None
        if file is None or project is None:
            raise FileNotFound(file_id)
        if member_of(project, account_id) is not None:
            return file
        if project.public and any(e.file_id == file_id for e in self._uow.expenses.list_by_project(project.id, "confirmed")):  # type: ignore[arg-type]
            return file
        raise FileNotFound(file_id)
