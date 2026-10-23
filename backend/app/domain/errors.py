class DomainError(Exception):
    """Base for business errors; the HTTP adapter maps them to status codes."""


class NotFound(DomainError):
    def __init__(self, entity: str, id: int | None):
        super().__init__(f"{entity} {id} does not exist")
        self.entity = entity
        self.id = id


class ProjectNotFound(NotFound):
    def __init__(self, id: int | None):
        super().__init__("Project", id)


class TaskNotFound(NotFound):
    def __init__(self, id: int | None):
        super().__init__("Task", id)


class ProposalAlreadyResolved(DomainError):
    def __init__(self, id: int | None, status: str):
        super().__init__(f"Proposal {id} is already {status}")
        self.id = id
        self.status = status
