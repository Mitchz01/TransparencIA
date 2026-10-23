"""UC-06 · Fixed points per sprint instead of the estimate from hours and seniority
(spec 003, US4, FR-017). `None` goes back to the estimate."""

from app.application.dto import CapacityResult, SprintLoadView
from app.application.ports.unit_of_work import UnitOfWork
from app.application.use_cases.board.get_board import sprint_views
from app.domain.board import CAPACITY_RANGE, is_continuous
from app.domain.errors import CapacityNotApplicable, ProjectNotFound, ValidationFailed


class SetCapacity:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    def execute(self, project_id: int, points_per_sprint: int | None) -> CapacityResult:
        project = self._uow.projects.get(project_id)
        if project is None:
            raise ProjectNotFound(project_id)
        low, high = CAPACITY_RANGE
        if points_per_sprint is not None and not low <= points_per_sprint <= high:
            raise ValidationFailed.single("points_per_sprint", f"Must be between {low} and {high}, or null.")
        if is_continuous(project):
            raise CapacityNotApplicable(project_id)

        saved = self._uow.projects.save(project.model_copy(update={"sprint_capacity_override": points_per_sprint}))
        self._uow.commit()

        views = sprint_views(saved, self._uow.sprints.list_by_project(project_id), self._uow.tasks.list_by_project(project_id))
        return CapacityResult(
            capacity_override=saved.sprint_capacity_override,
            sprints=[SprintLoadView(id=v.id, load=v.load) for v in views if v.id is not None and v.load is not None],
        )
