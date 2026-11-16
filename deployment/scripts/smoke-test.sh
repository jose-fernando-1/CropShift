#!/usr/bin/env bash
# Checks a running deployment from this machine: HTTP redirect, HTTPS page, security headers and the live API.
#   smoke-test.sh DOMAIN [HTTPS_PORT] [HTTP_PORT] [--insecure]
# --insecure accepts a self-signed or Let's Encrypt staging certificate. It resolves DOMAIN to 127.0.0.1, so it
# works before DNS is ready. Exit code is the number of failed checks (0 = everything passed).
# shellcheck disable=SC2329  # the t_* functions are invoked indirectly through check()
set -uo pipefail

DOMAIN="${1:?usage: smoke-test.sh DOMAIN [HTTPS_PORT] [HTTP_PORT] [--insecure]}"; shift
HTTPS_PORT=443; HTTP_PORT=80; CURL_TLS=()
numbers=()
for arg in "$@"; do
    if [ "$arg" = "--insecure" ]; then CURL_TLS=(--insecure); else numbers+=("$arg"); fi
done
[ "${#numbers[@]}" -ge 1 ] && HTTPS_PORT="${numbers[0]}"
[ "${#numbers[@]}" -ge 2 ] && HTTP_PORT="${numbers[1]}"

FAILS=0
check() {  # check "description" function-or-command...
    local what="$1"; shift
    if "$@" >/dev/null 2>&1; then printf '  ok    %s\n' "$what"; else printf '  FAIL  %s\n' "$what"; FAILS=$((FAILS + 1)); fi
}
https() {  # https PATH [curl args...]
    curl -fsS --max-time 30 "${CURL_TLS[@]}" --resolve "${DOMAIN}:${HTTPS_PORT}:127.0.0.1" "https://${DOMAIN}:${HTTPS_PORT}$1" "${@:2}"
}

# nginx may still be reloading: wait for the first answer.
for _ in $(seq 1 20); do https /api/health >/dev/null 2>&1 && break; sleep 3; done

redirect_status="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 --resolve "${DOMAIN}:${HTTP_PORT}:127.0.0.1" "http://${DOMAIN}:${HTTP_PORT}/")"
t_redirect()  { [ "$redirect_status" = 301 ]; }
t_page()      { https / | grep -qi '<html'; }
t_hsts()      { https / -D - -o /dev/null | grep -qi '^strict-transport-security'; }
t_health()    { https /api/health | grep -q '"mock":false'; }
t_status()    { https /api/health | grep -q '"status":"ok"'; }
t_crops()     { https /api/v1/crops | grep -q '"crop_id":"cowpea"'; }
t_recommend() { https /api/v1/recommendations -H 'content-type: application/json' -d '{"municipality_code":"2613008"}' | grep -q '"mock":false'; }
t_no_docs()   { https /api/health >/dev/null && ! https /docs; }   # reachable, yet /docs refused

check "HTTP redirects to HTTPS (got ${redirect_status})" t_redirect
check "HTTPS serves the web page" t_page
check "HSTS header present" t_hsts
check "API health answers with mock:false (live backend)" t_health
check "API reports status ok" t_status
check "Crops endpoint serves real data" t_crops
check "Recommendation for the pilot municipality works" t_recommend
check "Internal API docs are NOT exposed publicly" t_no_docs

if [ "$FAILS" -eq 0 ]; then echo "All checks passed."; else echo "$FAILS check(s) failed."; fi
exit "$FAILS"
