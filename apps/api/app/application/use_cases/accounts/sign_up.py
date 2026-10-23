"""UC-15 · Create an account; it leaves the person signed in (spec 015, US1)."""

from app.application.dto import SignedIn, SignUpRequest
from app.application.ports.security import PasswordHasher
from app.application.ports.unit_of_work import UnitOfWork
from app.application.use_cases.accounts.sessions import Clock, open_session, utc_now
from app.domain.accounts import Account, normalize_email, signup_errors
from app.domain.errors import FieldError, ValidationFailed
from app.domain.project import normalize_name


class SignUp:
    def __init__(self, uow: UnitOfWork, hasher: PasswordHasher, clock: Clock = utc_now):
        self._uow = uow
        self._hasher = hasher
        self._clock = clock

    def execute(self, data: SignUpRequest) -> SignedIn:
        name, email = normalize_name(data.name), normalize_email(data.email)
        errors = signup_errors(name, email, data.password)
        if not errors and self._uow.accounts.get_by_email(email) is not None:
            errors.append(FieldError("email", "Already registered."))
        if errors:
            raise ValidationFailed(errors, "The account has invalid fields.")

        now = self._clock()
        account = self._uow.accounts.add(
            Account(email=email, name=name, password_hash=self._hasher.hash(data.password), created_at=now)
        )
        token = open_session(self._uow, account.id or 0, now)
        self._uow.commit()
        return SignedIn(account=account, token=token)
