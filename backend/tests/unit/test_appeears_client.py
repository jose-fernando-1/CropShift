"""AppEEARS client against a mocked transport (no credentials, no network): login, re-login on 403, task flow."""

import httpx
import pytest
from pydantic import SecretStr

from app.integrations.appeears import BASE_URL, AppeearsClient, AppeearsError, PointRequest

REQUEST = PointRequest("t", -8.6, -36.4, "01-01-2024", "03-31-2024", [("MOD16A2GF.061", "ET_500m")])


def make_client(handler):
    return AppeearsClient("user", SecretStr("secret"), httpx.Client(transport=httpx.MockTransport(handler)))


def test_login_failure_never_leaks_the_password():
    client = make_client(lambda request: httpx.Response(401, json={"message": "bad"}))
    with pytest.raises(AppeearsError) as error:
        client.login()
    assert "secret" not in str(error.value) and "401" in str(error.value)


def test_task_flow_with_expired_token_and_csv_download():
    state = {"logins": 0, "expired_once": False}

    def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path.removeprefix("/api")
        if path == "/login":
            state["logins"] += 1
            return httpx.Response(200, json={"token": f"tok{state['logins']}"})
        if path == "/task" and request.method == "POST":
            if not state["expired_once"]:
                state["expired_once"] = True
                return httpx.Response(403)  # token expired: the client must log in again and retry
            assert request.headers["authorization"] == "Bearer tok2"
            return httpx.Response(202, json={"task_id": "abc"})
        if path == "/task/abc":
            return httpx.Response(200, json={"status": "done"})
        if path == "/bundle/abc":
            return httpx.Response(
                200, json={"files": [{"file_name": "x.csv", "file_id": "1"}, {"file_name": "r.xml", "file_id": "2"}]}
            )
        if path == "/bundle/abc/1":
            return httpx.Response(200, content=b"Date,v\n2024-01-01,1\n")
        return httpx.Response(404)

    client = make_client(handler)
    task = client.submit_point(REQUEST)
    client.wait(task, poll_s=0)
    assert task == "abc" and state["logins"] == 2
    assert client.download_csvs(task) == {"x.csv": b"Date,v\n2024-01-01,1\n"}


def test_failed_task_raises():
    client = make_client(
        lambda request: (
            httpx.Response(200, json={"token": "t"})
            if request.url.path.endswith("login")
            else httpx.Response(200, json={"status": "error"})
        )
    )
    with pytest.raises(AppeearsError, match="error"):
        client.wait("abc", poll_s=0)


def test_base_url_is_the_official_endpoint():
    assert BASE_URL == "https://appeears.earthdatacloud.nasa.gov/api"
