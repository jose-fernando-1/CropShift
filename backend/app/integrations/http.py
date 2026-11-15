"""HTTP for external services: one client factory, retry with backoff on transient failures.

Shared by `app.integrations.*` (runtime) and the `data/` extraction scripts, so there is one retry policy."""

import logging
import time

import httpx

logger = logging.getLogger("app.integrations.http")

# Generic on purpose: never put a person's name or email in a User-Agent.
USER_AGENT = "cropshift/0.1 (research prototype)"
RETRY_STATUSES = {429, 500, 502, 503, 504}


class ExternalServiceError(RuntimeError):
    """A source stayed unavailable after retries (carries the last status, if any)."""

    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


def make_client(timeout_s: float = 60.0, **kwargs) -> httpx.Client:
    headers = {"User-Agent": USER_AGENT, **kwargs.pop("headers", {})}
    return httpx.Client(timeout=timeout_s, headers=headers, follow_redirects=True, **kwargs)


def get_with_retry(
    client: httpx.Client,
    url: str,
    *,
    params: dict | list[tuple[str, str | float]] | None = None,
    headers: dict | None = None,
    retries: int = 4,
    backoff_s: float = 2.0,
) -> httpx.Response:
    """GET with exponential backoff on timeouts, connection errors, 429 and 5xx.

    Honors `Retry-After` when the server sends it. Other 4xx responses are returned
    to the caller untouched (a 404 is an answer, not a failure).
    """
    last: str = "no attempt made"
    status: int | None = None
    for attempt in range(retries + 1):
        try:
            response = client.get(url, params=params, headers=headers)
        except (httpx.TimeoutException, httpx.TransportError) as exc:
            last, status = f"{type(exc).__name__}", None
        else:
            if response.status_code not in RETRY_STATUSES:
                return response
            last, status = f"HTTP {response.status_code}", response.status_code
            retry_after = response.headers.get("retry-after", "")
            if retry_after.isdigit() and attempt < retries:
                time.sleep(min(int(retry_after), 60))
                continue
        if attempt < retries:
            delay = backoff_s * (2**attempt)
            logger.warning("%s from %s; retry %d/%d in %.0fs", last, httpx.URL(url).host, attempt + 1, retries, delay)
            time.sleep(delay)
    raise ExternalServiceError(f"{httpx.URL(url).host} unavailable after {retries + 1} attempts ({last})", status)
