"""Small in-process rate limiter for the POST routes (token bucket per client IP).

State lives in this process: it assumes ONE uvicorn worker (the compose default). Behind several workers or
replicas, limit at the proxy instead. The client IP comes from `X-Forwarded-For` only when the direct peer is in
`TRUSTED_PROXIES` (the web's Next proxy); otherwise a client could spoof the header to dodge the limit.
"""

import time
from threading import Lock

from fastapi import Request

from app.core.config import settings
from app.core.exceptions import AppError


class TokenBucketLimiter:
    def __init__(self, per_minute: int, clock=time.monotonic):
        self.capacity = per_minute
        self.refill_per_second = per_minute / 60
        self.clock = clock
        self._buckets: dict[str, tuple[float, float]] = {}
        self._lock = Lock()

    def allow(self, key: str) -> bool:
        if self.capacity <= 0:
            return True
        now = self.clock()
        with self._lock:
            tokens, updated = self._buckets.get(key, (float(self.capacity), now))
            tokens = min(float(self.capacity), tokens + (now - updated) * self.refill_per_second)
            allowed = tokens >= 1
            self._buckets[key] = (tokens - 1 if allowed else tokens, now)
            if len(self._buckets) > 10_000:  # bound memory: drop the stalest half
                for stale in sorted(self._buckets, key=lambda k: self._buckets[k][1])[:5_000]:
                    del self._buckets[stale]
            return allowed


def client_ip(request: Request) -> str:
    peer = request.client.host if request.client else "unknown"
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded and peer in settings.trusted_proxies:
        return forwarded.split(",")[
            -1
        ].strip()  # the hop the trusted proxy appended; earlier entries are client-supplied
    return peer


limiter = TokenBucketLimiter(settings.rate_limit_per_min)


def enforce_rate_limit(request: Request) -> None:
    if not limiter.allow(client_ip(request)):
        raise AppError("rate_limited", "rate_limited", 429)
