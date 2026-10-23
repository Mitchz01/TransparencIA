"""UC-01 · Create a project with its team (spec 001, US1)."""

from app.application.dto import ProjectCreate
from app.application.ports.unit_of_work import UnitOfWork
from app.domain.project import Member, Project, validate_project


class CreateProject:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    def execute(self, data: ProjectCreate) -> Project:
        project = validate_project(
            Project(
                name=data.name,
                description=data.description,
                duration_weeks=data.duration_weeks,
                requested_methodology=data.requested_methodology,
                auto_approve=data.auto_approve,
                members=[Member(**m.model_dump()) for m in data.members],
            )
        )
        # Always a draft: creating a project never starts planning (FR-005, spec 002).
        saved = self._uow.projects.add(project.model_copy(update={"status": "draft", "plan": None}))
        self._uow.commit()
        return saved
