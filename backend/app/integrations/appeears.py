"""NASA AppEEARS client (Earthdata Login account required): point samples of SMAP, MODIS, SRTM/NASADEM.

Used ONLY by the offline `data/` pipeline, never by the API. Flow: login (Basic auth) -> bearer token (~48 h) ->
submit a point task -> poll until done (queue can take many minutes) -> list bundle files -> download CSVs. Re-login on 403.
Docs: https://appeears.earthdatacloud.nasa.gov/api/
"""

import logging
import time
from dataclasses import dataclass

import httpx
from pydantic import SecretStr

from app.integrations.http import ExternalServiceError, make_client

logger = logging.getLogger(__name__)

BASE_URL = "https://appeears.earthdatacloud.nasa.gov/api"


class AppeearsError(ExternalServiceError):
    """AppEEARS rejected the credentials, a task failed, or it timed out."""


@dataclass(frozen=True)
class PointRequest:
    name: str
    latitude: float
    longitude: float
    start: str  # "MM-DD-YYYY"
    end: str
    layers: list[tuple[str, str]]  # (product id, layer name), e.g. ("MOD16A2GF.061", "ET_500m")


class AppeearsClient:
    def __init__(self, username: str, password: SecretStr, client: httpx.Client | None = None):
        self._username = username
        self._password = password
        self._client = client or make_client(timeout_s=120.0)
        self._token: str | None = None

    def login(self) -> None:
        response = self._client.post(
            f"{BASE_URL}/login",
            auth=(self._username, self._password.get_secret_value()),
            data={"grant_type": "client_credentials"},
        )
        if response.status_code != 200 or not response.json().get("token"):
            raise AppeearsError(f"AppEEARS login failed (HTTP {response.status_code})", response.status_code)
        self._token = response.json()["token"]

    def _request(self, method: str, path: str, **kwargs) -> httpx.Response:
        if self._token is None:
            self.login()
        for attempt in (1, 2):
            response = self._client.request(
                method, f"{BASE_URL}{path}", headers={"Authorization": f"Bearer {self._token}"}, **kwargs
            )
            if response.status_code == 403 and attempt == 1:  # token expired: authenticate again once
                self.login()
                continue
            return response
        raise AssertionError("unreachable")

    def submit_point(self, request: PointRequest) -> str:
        body = {
            "task_type": "point",
            "task_name": request.name,
            "params": {
                "dates": [{"startDate": request.start, "endDate": request.end}],
                "layers": [{"product": product, "layer": layer} for product, layer in request.layers],
                "coordinates": [
                    {
                        "id": request.name,
                        "longitude": request.longitude,
                        "latitude": request.latitude,
                        "category": "cropshift",
                    }
                ],
            },
        }
        response = self._request("POST", "/task", json=body)
        if response.status_code not in (200, 202):
            raise AppeearsError(f"AppEEARS rejected the task (HTTP {response.status_code})", response.status_code)
        return response.json()["task_id"]

    def wait(self, task_id: str, poll_s: float = 30.0, timeout_s: float = 3 * 3600) -> None:
        """Block until the task is done. The queue is slow (26 min for 5 products x 3 months were observed)."""
        deadline = time.monotonic() + timeout_s
        while time.monotonic() < deadline:
            response = self._request("GET", f"/task/{task_id}")
            status = response.json().get("status") if response.status_code == 200 else None
            if status == "done":
                return
            if status in ("error", "failed"):
                raise AppeearsError(f"AppEEARS task {task_id} ended with status {status}")
            time.sleep(poll_s)
        raise AppeearsError(f"AppEEARS task {task_id} did not finish within {timeout_s / 60:.0f} minutes")

    def download_csvs(self, task_id: str) -> dict[str, bytes]:
        """File name -> content of every CSV of the task's bundle."""
        listing = self._request("GET", f"/bundle/{task_id}")
        if listing.status_code != 200:
            raise AppeearsError(f"AppEEARS bundle unavailable (HTTP {listing.status_code})", listing.status_code)
        files = {}
        for entry in listing.json()["files"]:
            if entry["file_name"].endswith(".csv"):
                content = self._request("GET", f"/bundle/{task_id}/{entry['file_id']}", follow_redirects=True)
                files[entry["file_name"]] = content.content
        return files
