"""UC-06 · The board read model (spec 003): sprints with their load, objectives and tasks.
Empty lists until the plan is applied."""

from app.application.dto import BoardView, SprintView
from app.application.ports.unit_of_work import UnitOfWork
from app.domain.board import Sprint, Task, is_continuous, sprint_capacity, sprint_load, wip_limits
from app.domain.errors import ProjectNotFound
from app.domain.project import Project


def sprint_views(project: Project, sprints: list[Sprint], tasks: list[Task]) -> list[SprintView]:
    """Each sprint with its points against capacity; no load on a continuous board."""
    continuous = is_continuous(project)
    capacity = sprint_capacity(project)
    return [
        SprintView(**s.model_dump(), load=None if continuous else sprint_load(s.id, tasks, capacity)) for s in sprints
    ]


class GetBoard:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    def execute(self, project_id: int) -> BoardView:
        project = self._uow.projects.get(project_id)
        if project is None:
            raise ProjectNotFound(project_id)
        sprints = self._uow.sprints.list_by_project(project_id)
        tasks = self._uow.tasks.list_by_project(project_id)
        return BoardView(
            project_id=project_id,
            continuous=is_continuous(project),
            wip_limits=wip_limits(project),
            capacity_override=project.sprint_capacity_override,
            sprints=sprint_views(project, sprints, tasks),
            objectives=self._uow.objectives.list_by_project(project_id),
            tasks=tasks,
        )
