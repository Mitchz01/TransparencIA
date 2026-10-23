"""UC-15 · Sign in with email and password (spec 015, US1)."""

from app.application.dto import SignedIn, SignInRequest
from app.application.ports.security import PasswordHasher
from app.application.ports.unit_of_work import UnitOfWork
from app.application.use_cases.accounts.sessions import Clock, open_session, utc_now
from app.domain.accounts import normalize_email
from app.domain.errors import InvalidCredentials


class SignIn:
    def __init__(self, uow: UnitOfWork, hasher: PasswordHasher, clock: Clock = utc_now):
        self._uow = uow
        self._hasher = hasher
        self._clock = clock

    def execute(self, data: SignInRequest) -> SignedIn:
        account = self._uow.accounts.get_by_email(normalize_email(data.email))
        if account is None:
            # Same work and same answer as a wrong password, so emails can't be probed (FR-002).
            self._hasher.hash(data.password)
            raise InvalidCredentials()
        if not self._hasher.verify(data.password, account.password_hash):
            raise InvalidCredentials()
        token = open_session(self._uow, account.id or 0, self._clock())
        self._uow.commit()
        return SignedIn(account=account, token=token)
