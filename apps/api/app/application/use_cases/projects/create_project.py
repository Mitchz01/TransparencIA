"""UC-01 · Create a project; its creator is the first member, as leader (spec 001, US1; spec 015, US3)."""

from app.application.dto import ProjectCreate
from app.application.ports.unit_of_work import UnitOfWork
from app.application.use_cases.projects.invitation import new_invite_token
from app.domain.accounts import Account, member_from_profile, project_role
from app.domain.project import Project, validate_project


class CreateProject:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    def execute(self, data: ProjectCreate, account: Account) -> Project:
        leader = member_from_profile(account, project_role(data.role, account), "leader")
        project = validate_project(
            Project(
                name=data.name,
                description=data.description,
                duration_weeks=data.duration_weeks,
                requested_methodology=data.requested_methodology,
                auto_approve=data.auto_approve,
                members=[leader],
                invite_token=new_invite_token(),  # ready to share from the start (spec 015, US4)
            )
        )
        # Always a draft: creating a project never starts planning (FR-005, spec 002).
        saved = self._uow.projects.add(project.model_copy(update={"status": "draft", "plan": None}))
        self._uow.commit()
        return saved
