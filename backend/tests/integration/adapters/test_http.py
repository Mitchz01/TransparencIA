from fastapi.testclient import TestClient

from app.main import app


def test_health_and_wiring():
    with TestClient(app) as client:
        response = client.get("/api/health")
        assert response.status_code == 200
        assert response.json()["ok"] is True
        assert app.state.agents is not None
        assert app.state.code_host is not None
