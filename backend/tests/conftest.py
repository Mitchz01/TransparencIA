import os
import tempfile

# Before importing the app: API tests use a throwaway SQLite file, never ./agile.db.
_DB_DIR = tempfile.mkdtemp(prefix="agile-tests-")
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_DIR}/test.db"
os.environ.setdefault("MOCK_AGENTS", "1")
os.environ.setdefault("MOCK_GITHUB", "1")  # spec 007: tests never call the real GitHub API

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlmodel import SQLModel  # noqa: E402

from app.adapters.outbound.persistence.db import engine  # noqa: E402


@pytest.fixture
def client():
    from app.main import app

    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client
