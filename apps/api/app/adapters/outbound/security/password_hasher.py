"""Spec 015: password hashes with the standard library's scrypt, so no new dependency."""

import base64
import hashlib
import hmac
import secrets

# Cost from OWASP's scrypt guidance (2^14, 8, 1): about 16 MB and tens of milliseconds per hash.
N, R, P = 2**14, 8, 1
SALT_BYTES = 16
KEY_BYTES = 32


def _b64(data: bytes) -> str:
    return base64.b64encode(data).decode()


class ScryptPasswordHasher:
    """Implements the PasswordHasher port. Stored as `scrypt$n$r$p$salt$hash` (base64), so the
    cost can change later without breaking the hashes already saved."""

    def __init__(self, n: int = N, r: int = R, p: int = P):
        self._n, self._r, self._p = n, r, p

    def hash(self, password: str) -> str:
        salt = secrets.token_bytes(SALT_BYTES)
        key = self._derive(password, salt, self._n, self._r, self._p)
        return f"scrypt${self._n}${self._r}${self._p}${_b64(salt)}${_b64(key)}"

    def verify(self, password: str, hashed: str) -> bool:
        try:
            scheme, n, r, p, salt, key = hashed.split("$")
            if scheme != "scrypt":
                return False
            expected = base64.b64decode(key)
            actual = self._derive(password, base64.b64decode(salt), int(n), int(r), int(p))
        except (ValueError, TypeError):
            return False
        return hmac.compare_digest(actual, expected)

    @staticmethod
    def _derive(password: str, salt: bytes, n: int, r: int, p: int) -> bytes:
        return hashlib.scrypt(password.encode(), salt=salt, n=n, r=r, p=p, maxmem=64 * 1024 * 1024, dklen=KEY_BYTES)
