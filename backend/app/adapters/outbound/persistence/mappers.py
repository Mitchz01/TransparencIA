"""Tabla ↔ entidad de dominio. Los campos coinciden, así que alcanza con validar
desde atributos; el equipo de un proyecto vive en otra tabla y se arma aparte."""

from app.adapters.outbound.persistence.tables import MemberTable, ProjectTable, SprintTable, TaskTable
from app.domain.board import Sprint, Task
from app.domain.project import Member, Project


def project_to_domain(row: ProjectTable, members: list[MemberTable]) -> Project:
    return Project.model_validate(
        {**row.model_dump(), "members": [member_to_domain(m) for m in members]}
    )


def project_to_table(project: Project) -> ProjectTable:
    return ProjectTable.model_validate(project.model_dump(exclude={"members"}))


def member_to_domain(row: MemberTable) -> Member:
    return Member.model_validate(row.model_dump())


def member_to_table(member: Member, project_id: int) -> MemberTable:
    return MemberTable.model_validate({**member.model_dump(), "project_id": project_id})


def sprint_to_domain(row: SprintTable) -> Sprint:
    return Sprint.model_validate(row.model_dump())


def sprint_to_table(sprint: Sprint) -> SprintTable:
    return SprintTable.model_validate(sprint.model_dump())


def task_to_domain(row: TaskTable) -> Task:
    return Task.model_validate(row.model_dump())


def task_to_table(task: Task) -> TaskTable:
    return TaskTable.model_validate(task.model_dump())
