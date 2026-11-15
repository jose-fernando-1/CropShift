from types import SimpleNamespace

import pytest

from app.core import rate_limit
from app.core.rate_limit import TokenBucketLimiter, client_ip


def test_bucket_allows_burst_then_blocks_then_refills():
    now = [0.0]
    limiter = TokenBucketLimiter(per_minute=3, clock=lambda: now[0])
    assert [limiter.allow("a") for _ in range(4)] == [True, True, True, False]
    assert limiter.allow("b") is True  # keys are independent
    now[0] += 20  # one token back (3 per minute = 1 per 20 s)
    assert limiter.allow("a") is True and limiter.allow("a") is False


def test_zero_disables_limiting():
    limiter = TokenBucketLimiter(per_minute=0)
    assert all(limiter.allow("a") for _ in range(1000))


def request(peer, forwarded=None):
    headers = {"x-forwarded-for": forwarded} if forwarded else {}
    return SimpleNamespace(client=SimpleNamespace(host=peer), headers=headers)


def test_forwarded_header_is_trusted_only_from_trusted_proxies(monkeypatch):
    monkeypatch.setattr(rate_limit.settings, "trusted_proxies", ["10.0.0.5"])
    assert client_ip(request("10.0.0.5", "6.6.6.6, 203.0.113.9")) == "203.0.113.9"
    assert client_ip(request("198.51.100.7", "203.0.113.9")) == "198.51.100.7"  # spoofed header ignored
    assert client_ip(request("10.0.0.5")) == "10.0.0.5"


def test_route_returns_429_envelope(client, assert_contract, monkeypatch):
    monkeypatch.setattr(rate_limit, "limiter", TokenBucketLimiter(per_minute=1))
    first = client.post("/api/v1/locations/resolve", json={"lat": 0.0, "lon": 0.0})
    second = client.post("/api/v1/locations/resolve", json={"lat": 0.0, "lon": 0.0})
    assert first.status_code in (200, 500)  # 500 only when no database is available here
    assert second.status_code == 429
    assert_contract("api-error", second.json())
    assert second.json()["error"]["code"] == "rate_limited"


@pytest.fixture(autouse=True)
def _restore_limiter():
    original = rate_limit.limiter
    yield
    rate_limit.limiter = original
