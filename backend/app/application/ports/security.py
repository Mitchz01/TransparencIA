from typing import Protocol


class PasswordHasher(Protocol):
    """Spec 015: one-way password hashes (FR-003). The adapter picks the algorithm."""

    def hash(self, password: str) -> str: ...
    def verify(self, password: str, hashed: str) -> bool:
        """False for a wrong password or a hash it can't read; never raises."""
        ...
