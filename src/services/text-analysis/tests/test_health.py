from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_returns_service_metadata() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "text-analysis"}
    assert response.headers["x-request-id"]


def test_analyze_echoes_request_id_header() -> None:
    response = client.post(
        "/analyze",
        json={"text": "Hello! :)"},
        headers={"X-Request-Id": "req-text-123"},
    )

    assert response.status_code == 200
    assert response.headers["x-request-id"] == "req-text-123"
