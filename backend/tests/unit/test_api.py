from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_health():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_api_version():
    response = client.get("/api/v1/")

    assert response.status_code == 200
    assert response.json()["version"] == "v1"


def test_valid_location():
    response = client.post(
        "/api/v1/validate-location",
        json={
            "latitude": -8.60,
            "longitude": -36.40,
        },
    )

    assert response.status_code == 200
    assert response.json()["valid"] is True


def test_invalid_latitude():
    response = client.post(
        "/api/v1/validate-location",
        json={
            "latitude": 120,
            "longitude": -36.40,
        },
    )

    assert response.status_code == 422


def test_invalid_longitude():
    response = client.post(
        "/api/v1/validate-location",
        json={
            "latitude": -8.60,
            "longitude": 200,
        },
    )

    assert response.status_code == 422


def test_cors_preflight():
    response = client.options(
        "/api/v1/validate-location",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
