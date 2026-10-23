import os
import tempfile

# Before importing the app: API tests use a throwaway SQLite file, never ./agile.db.
_DB_DIR = tempfile.mkdtemp(prefix="agile-tests-")
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_DIR}/test.db"
os.environ.setdefault("MOCK_AGENTS", "1")
os.environ.setdefault("MOCK_GITHUB", "1")  # spec 007: tests never call the real GitHub API
os.environ.setdefault("MOCK_AGENTS_DELAY", "0")
# Spec 017 (D13) hides the documents of spec 006 and the issue proposals of spec 007 by default; their tests need them.
os.environ.setdefault("GENERATE_DOCUMENTS", "1")
os.environ.setdefault("PROPOSE_ISSUES", "1")
os.environ["GITHUB_WEBHOOK_SECRET"] = "test-webhook-secret"  # spec 008: tests sign their own deliveries

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlmodel import SQLModel  # noqa: E402

from app.adapters.outbound.persistence.db import engine  # noqa: E402


@pytest.fixture
def client():
    """Signed in as "Ana" (spec 015: every /api call needs a session). tests/api.py has the rest."""
    from app.adapters.outbound.security.password_hasher import ScryptPasswordHasher
    from app.main import app
    from tests.api import sign_up

    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    with TestClient(app, raise_server_exceptions=False) as test_client:
        # Cheap scrypt: API tests sign up many people; test_accounts_persistence covers the real cost.
        app.state.password_hasher = ScryptPasswordHasher(n=2**8)
        sign_up(test_client, "Ana")
        yield test_client


@pytest.fixture
def anonymous(client):
    """Nobody signed in, on the same app as `client`."""
    from tests.api import new_client

    return new_client(client)
