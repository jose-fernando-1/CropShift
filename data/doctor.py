"""`python -m data doctor`: which sources and credentials work, with the fix for each failure.

Never prints a secret. Network checks are single, tiny requests.
"""

from collections.abc import Callable
from dataclasses import dataclass

import httpx

from app.core.config import DEFAULT_GEMINI_MODELS
from data._common.env import load_env, secret
from data._common.http import ExternalServiceError, get_with_retry, make_client

OK, MISSING, FAIL = "OK", "MISSING", "FAIL"

POWER_URL = "https://power.larc.nasa.gov/api/temporal/daily/point"
SOILGRIDS_URL = "https://rest.isric.org/soilgrids/v2.0/properties/query"
IBGE_MUNICIPALITIES_URL = "https://servicodados.ibge.gov.br/api/v1/localidades/estados/26/municipios"
ZARC_URL = "https://dados.agricultura.gov.br/dataset/tabua-de-risco-zoneamento-agricola-de-risco-climatico"
APPEEARS_LOGIN_URL = "https://appeears.earthdatacloud.nasa.gov/api/login"
GEMINI_MODELS_URL = "https://generativelanguage.googleapis.com/v1beta/models"

# Pilot point of the proposal (Sao Bento do Una, PE).
PILOT_LAT, PILOT_LON = -8.60, -36.40


@dataclass
class Check:
    name: str
    status: str
    detail: str
    hint: str = ""


def check_power(client: httpx.Client) -> Check:
    params = {
        "parameters": "T2M,PRECTOTCORR",
        "community": "AG",
        "longitude": PILOT_LON,
        "latitude": PILOT_LAT,
        "start": "20240101",
        "end": "20240107",
        "format": "JSON",
    }
    response = get_with_retry(client, POWER_URL, params=params, retries=2)
    if response.status_code != 200:
        return Check("NASA POWER", FAIL, f"HTTP {response.status_code}", "Check connectivity; POWER needs no key.")
    days = len(response.json()["properties"]["parameter"]["T2M"])
    return Check("NASA POWER", OK, f"{days} daily values at the pilot point (no key needed)")


def check_soilgrids(client: httpx.Client) -> Check:
    params = {"lon": PILOT_LON, "lat": PILOT_LAT, "property": "clay", "depth": "0-5cm", "value": "mean"}
    response = get_with_retry(client, SOILGRIDS_URL, params=params, retries=1)
    if response.status_code == 200:
        return Check("SoilGrids REST", OK, "clay 0-5 cm answered (no key needed)")
    return Check(
        "SoilGrids REST",
        FAIL,
        f"HTTP {response.status_code}",
        "The public REST API is slow and sometimes down; retry later (extraction is resumable, re-run it).",
    )


def check_ibge(client: httpx.Client) -> Check:
    response = get_with_retry(client, IBGE_MUNICIPALITIES_URL, retries=2)
    if response.status_code != 200:
        return Check("IBGE localidades", FAIL, f"HTTP {response.status_code}")
    return Check("IBGE localidades", OK, f"{len(response.json())} municipalities in PE (no key needed)")


def check_zarc(client: httpx.Client) -> Check:
    try:
        response = client.get(ZARC_URL)
    except httpx.HTTPError as exc:
        return Check(
            "MAPA ZARC portal",
            MISSING,
            f"{type(exc).__name__} (the portal resets non-browser clients)",
            "Download the safra CSV in a browser into data/raw/mapa_zarc/ (see data/sources/mapa_zarc/README.md).",
        )
    return Check("MAPA ZARC portal", OK if response.status_code == 200 else FAIL, f"HTTP {response.status_code}")


def check_earthdata(client: httpx.Client) -> Check:
    username, password = secret("EARTHDATA_USERNAME"), secret("EARTHDATA_PASSWORD")
    if not (username and password):
        return Check(
            "NASA Earthdata (AppEEARS)",
            MISSING,
            "EARTHDATA_USERNAME / EARTHDATA_PASSWORD not set",
            "Register at urs.earthdata.nasa.gov, then put both in data/.env (see docs/api-keys.md). "
            "Only the satellite extraction needs it; the API and the demo seed do not.",
        )
    try:
        response = client.post(APPEEARS_LOGIN_URL, auth=(username, password), data={"grant_type": "client_credentials"})
    except httpx.HTTPError as exc:
        return Check("NASA Earthdata (AppEEARS)", FAIL, type(exc).__name__)
    if response.status_code == 200 and response.json().get("token"):
        return Check("NASA Earthdata (AppEEARS)", OK, "login returned a bearer token (valid ~48 h)")
    return Check(
        "NASA Earthdata (AppEEARS)",
        FAIL,
        f"HTTP {response.status_code}",
        "Wrong credentials, or the account is not activated. For IMERG/GLDAS also approve the "
        "'NASA GESDISC DATA ARCHIVE' application in your Earthdata profile.",
    )


def check_gemini(client: httpx.Client) -> Check:
    key = secret("GEMINI_API_KEY")
    if not key:
        return Check(
            "Gemini API",
            MISSING,
            "GEMINI_API_KEY not set",
            "Optional: create a key in Google AI Studio, put it in backend/.env. Without it the template is used.",
        )
    listing = client.get(GEMINI_MODELS_URL, params={"pageSize": 200}, headers={"x-goog-api-key": key})
    if listing.status_code != 200:
        return Check(
            "Gemini API", FAIL, f"HTTP {listing.status_code}", "Key rejected or the project has no API access."
        )
    offered = {m["name"].removeprefix("models/") for m in listing.json().get("models", [])}
    chain = [
        m
        for m in [secret("GEMINI_MODEL"), *(secret("GEMINI_FALLBACK_MODELS") or "").split(","), *DEFAULT_GEMINI_MODELS]
        if m
    ]
    chain = list(dict.fromkeys(m.strip() for m in chain))
    answered, failed = [], []
    for model in chain:
        probe = client.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
            headers={"x-goog-api-key": key},
            json={"contents": [{"parts": [{"text": "Reply with the word ok."}]}]},
        )
        (answered if probe.status_code == 200 else failed).append(
            model if probe.status_code == 200 else f"{model} (HTTP {probe.status_code})"
        )
    if not answered:
        flash = sorted(n for n in offered if "flash" in n)
        return Check(
            "Gemini API",
            FAIL,
            f"no model of the chain answered: {failed}",
            f"Set GEMINI_MODEL / GEMINI_FALLBACK_MODELS from: {flash[:8]}",
        )
    detail = f"chain answers: {answered}" + (f"; not answering now: {failed}" if failed else "")
    hint = (
        "A failing model is skipped for a minute and the next one is tried; the template is the last resort."
        if failed
        else ""
    )
    return Check("Gemini API", OK, detail, hint)


def check_database() -> Check:
    from sqlalchemy import create_engine, text

    from app.core.config import settings

    try:
        with create_engine(settings.database_url, connect_args={"connect_timeout": 3}).connect() as connection:
            version = connection.execute(text("SELECT postgis_version()")).scalar_one()
    except Exception as exc:  # report any driver/connection failure as a check result
        return Check(
            "PostGIS database",
            FAIL,
            type(exc).__name__,
            "Start it with `make db` (docker compose --profile live up -d db).",
        )
    return Check("PostGIS database", OK, f"PostGIS {version}")


NETWORK_CHECKS: list[Callable[[httpx.Client], Check]] = [
    check_power,
    check_soilgrids,
    check_ibge,
    check_zarc,
    check_earthdata,
    check_gemini,
]


def run_doctor() -> list[Check]:
    load_env()
    results: list[Check] = []
    with make_client(timeout_s=20.0) as client:
        for check in NETWORK_CHECKS:
            try:
                results.append(check(client))
            except ExternalServiceError as exc:
                results.append(Check(check.__name__.removeprefix("check_"), FAIL, str(exc)))
            except httpx.HTTPError as exc:
                results.append(Check(check.__name__.removeprefix("check_"), FAIL, type(exc).__name__))
    results.append(check_database())
    return results
