"""Encrypts the projects' GitHub tokens at rest (spec 007, T035).

With SECRET_KEY set, tokens are stored as "fernet:<ciphertext>"; without it they're stored
in plain text in SQLite (acceptable for the local demo, never for a shared deployment).
Values without the prefix are read as plain text, so turning the key on later still reads
the old rows, and they're encrypted on their next save."""

import base64
import hashlib

from app.config import SECRET_KEY, logger

PREFIX = "fernet:"


def _fernet(secret: str):  # type: ignore[no-untyped-def]
    from cryptography.fernet import Fernet  # deferred: only needed when a key is set

    # Any string works as SECRET_KEY: it's stretched into the 32-byte key Fernet expects.
    return Fernet(base64.urlsafe_b64encode(hashlib.sha256(secret.encode()).digest()))


def seal(token: str | None, secret: str = SECRET_KEY) -> str | None:
    if not token or not secret:
        return token
    return PREFIX + _fernet(secret).encrypt(token.encode()).decode()


def unseal(value: str | None, secret: str = SECRET_KEY) -> str | None:
    if not value or not value.startswith(PREFIX):
        return value
    if not secret:
        logger.warning("A GitHub token is encrypted but SECRET_KEY is empty: the project has no usable token")
        return None
    from cryptography.fernet import InvalidToken

    try:
        return _fernet(secret).decrypt(value[len(PREFIX) :].encode()).decode()
    except InvalidToken:
        logger.warning("A GitHub token can't be decrypted with the current SECRET_KEY: the project has no usable token")
        return None
