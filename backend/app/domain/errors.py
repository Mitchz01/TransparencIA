class DomainError(Exception):
    """Base de los errores de negocio; el adaptador HTTP los traduce a status codes."""


class NotFound(DomainError):
    def __init__(self, entity: str, id: int | None):
        super().__init__(f"{entity} {id} no existe")
        self.entity = entity
        self.id = id


class ProjectNotFound(NotFound):
    def __init__(self, id: int | None):
        super().__init__("Proyecto", id)


class TaskNotFound(NotFound):
    def __init__(self, id: int | None):
        super().__init__("Tarea", id)


class ProposalAlreadyResolved(DomainError):
    def __init__(self, id: int | None, status: str):
        super().__init__(f"La propuesta {id} ya está {status}")
        self.id = id
        self.status = status
