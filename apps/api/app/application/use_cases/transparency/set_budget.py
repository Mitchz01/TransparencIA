"""Set a project's budget; the leader may save it even if the lines don't add up (spec 017, US1). Owner: P3."""

from app.application.ports.unit_of_work import UnitOfWork
from app.domain.errors import ProjectNotFound, ValidationFailed
from app.domain.transparency import Budget, budget_errors


class SetBudget:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    def execute(self, project_id: int, budget: Budget) -> Budget:
        if self._uow.projects.get(project_id) is None:
            raise ProjectNotFound(project_id)
        budget = budget.model_copy(update={"project_id": project_id})
        errors = budget_errors(budget)
        if errors:
            raise ValidationFailed(errors)
        saved = self._uow.budgets.save(budget)
        self._uow.commit()
        return saved
