#!/bin/sh
# nginx entrypoint: renders the right config for the current certificate state and keeps it fresh.
#   no certificate yet  -> bootstrap.conf.template (HTTP only, ACME challenge path open)
#   certificate present -> https.conf.template
# A background loop re-renders and reloads when a certificate appears, and reloads every 6 h so renewed
# certificates are picked up without a restart.
set -eu
# (the background loop below must never die: every command in it is guarded)

: "${DOMAIN:?DOMAIN is required}"
export HTTPS_PORT_SUFFIX="${HTTPS_PORT_SUFFIX:-}"
TEMPLATES=/etc/nginx/cropshift-templates
CONF=/etc/nginx/conf.d/default.conf
CERT="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"

desired_mode() { [ -s "$CERT" ] && echo https || echo bootstrap; }

render() {
    mode="$1"
    cp "$TEMPLATES/common.inc" /etc/nginx/cropshift-common.inc
    # Only substitute our two variables: nginx's own $variables must survive untouched.
    # shellcheck disable=SC2016  # envsubst needs the literal variable names
    envsubst '${DOMAIN} ${HTTPS_PORT_SUFFIX}' < "$TEMPLATES/${mode}.conf.template" > "$CONF"
    echo "nginx: rendered ${mode} config for ${DOMAIN}"
}

mode="$(desired_mode)"
render "$mode"
nginx -t

(
    ticks=0
    while :; do
        sleep 30
        ticks=$((ticks + 1))
        wanted="$(desired_mode)"
        if [ "$wanted" != "$mode" ]; then
            { render "$wanted" && nginx -t && nginx -s reload && mode="$wanted"; } || echo "nginx: switching to $wanted failed, will retry"
        elif [ $((ticks % 720)) -eq 0 ]; then
            nginx -s reload || echo "nginx: periodic reload failed"
        fi
    done
) &

exec nginx -g 'daemon off;'
