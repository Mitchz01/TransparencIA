from sqlmodel import Session, select

from app.adapters.outbound.persistence import mappers
from app.adapters.outbound.persistence.tables import MemberTable, ProjectTable, SprintTable, TaskTable
from app.domain.board import Sprint, Task
from app.domain.project import Project


class SqlProjectRepository:
    def __init__(self, session: Session):
        self._session = session

    def get(self, project_id: int) -> Project | None:
        row = self._session.get(ProjectTable, project_id)
        return self._to_domain(row) if row else None

    def list(self) -> list[Project]:
        rows = self._session.exec(select(ProjectTable).order_by(ProjectTable.id)).all()
        return [self._to_domain(row) for row in rows]

    def add(self, project: Project) -> Project:
        row = mappers.project_to_table(project)
        self._session.add(row)
        self._session.flush()
        for member in project.members:
            self._session.add(mappers.member_to_table(member, row.id))
        self._session.flush()
        return self._to_domain(row)

    def save(self, project: Project) -> Project:
        """Updates the project data; the team is edited through its own use case."""
        row = self._session.merge(mappers.project_to_table(project))
        self._session.flush()
        return self._to_domain(row)

    def _to_domain(self, row: ProjectTable) -> Project:
        members = self._session.exec(
            select(MemberTable).where(MemberTable.project_id == row.id).order_by(MemberTable.id)
        ).all()
        return mappers.project_to_domain(row, list(members))


class SqlSprintRepository:
    def __init__(self, session: Session):
        self._session = session

    def list_by_project(self, project_id: int) -> list[Sprint]:
        rows = self._session.exec(
            select(SprintTable).where(SprintTable.project_id == project_id).order_by(SprintTable.number)
        ).all()
        return [mappers.sprint_to_domain(row) for row in rows]

    def add(self, sprint: Sprint) -> Sprint:
        row = mappers.sprint_to_table(sprint)
        self._session.add(row)
        self._session.flush()
        return mappers.sprint_to_domain(row)


class SqlTaskRepository:
    def __init__(self, session: Session):
        self._session = session

    def get(self, task_id: int) -> Task | None:
        row = self._session.get(TaskTable, task_id)
        return mappers.task_to_domain(row) if row else None

    def list_by_project(self, project_id: int) -> list[Task]:
        rows = self._session.exec(
            select(TaskTable).where(TaskTable.project_id == project_id).order_by(TaskTable.position)
        ).all()
        return [mappers.task_to_domain(row) for row in rows]

    def add(self, task: Task) -> Task:
        row = mappers.task_to_table(task)
        self._session.add(row)
        self._session.flush()
        return mappers.task_to_domain(row)

    def save(self, task: Task) -> Task:
        row = self._session.merge(mappers.task_to_table(task))
        self._session.flush()
        return mappers.task_to_domain(row)
