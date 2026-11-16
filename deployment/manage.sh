#!/usr/bin/env bash
# Day-to-day operations for a deployment made by install.sh.
#
#   status            containers, health, certificate expiry
#   logs [service]    follow logs (api, web, nginx, db, certbot); all services when omitted
#   start | stop      start or stop the whole stack (data and certificates are kept)
#   restart [service]
#   update            git pull (fast-forward only), rebuild, migrate, restart with minimal downtime
#   issue-cert        (re)request the Let's Encrypt certificate, then reload nginx
#   renew-now         run certbot renew immediately and reload nginx
#   backup [file]     pg_dump of the database to a compressed file (default: backups/cropshift-DATE.dump)
#   restore FILE      replace the database content with a backup made by `backup` (asks first)
#   smoke             run the end-to-end checks against this server
#   env               show the settings with secrets masked
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$DEPLOY_DIR")"
ENV_FILE="$DEPLOY_DIR/.env"
PROJECT="${COMPOSE_PROJECT_NAME:-cropshift}"
# shellcheck source=scripts/lib.sh
. "$DEPLOY_DIR/scripts/lib.sh"

usage() {
    cat <<'USAGE'
Day-to-day operations for a deployment made by install.sh.

  sudo ./deployment/manage.sh <command> [args]

  status            containers, health, certificate expiry
  logs [service]    follow logs (api, web, nginx, db, certbot); all services when omitted
  start | stop      start or stop the whole stack (data and certificates are kept)
  restart [service]
  update            backup, git pull (fast-forward only), rebuild, migrate, restart
  issue-cert        request the Let's Encrypt certificate again, then restart nginx
  renew-now         run certbot renew immediately and reload nginx
  backup [file]     compressed pg_dump (default: backups/cropshift-DATE.dump)
  restore FILE      replace the database content with a backup made by `backup` (asks first, keeps a safety dump)
  smoke             run the end-to-end checks against this server
  env               show the settings with secrets masked
USAGE
}

case "${1:-help}" in help|-h|--help) usage; exit 0 ;; esac

# Needs the root-owned .env and the Docker socket. Re-exec through sudo ONLY when not already root (a stopped daemon
# must not make a root shell loop through sudo forever).
if [ ! -r "$ENV_FILE" ] || ! docker info >/dev/null 2>&1; then
    if [ "$(id -u)" -ne 0 ]; then
        command -v sudo >/dev/null 2>&1 || die "Run as root (or a user that can read $ENV_FILE and use Docker)."
        exec sudo -E bash "${BASH_SOURCE[0]}" "$@"
    fi
    [ -f "$ENV_FILE" ] || die "$ENV_FILE not found: run ./deployment/install.sh first."
    die "Docker is not running or not reachable. Try: systemctl status docker"
fi
load_env_file "$ENV_FILE"
dc() { docker compose -p "$PROJECT" -f "$DEPLOY_DIR/docker-compose.yml" --env-file "$ENV_FILE" "$@"; }
cert_mode="${ENV_CUR[CERT_MODE]:-letsencrypt}"
domain="${ENV_CUR[DOMAIN]:?DOMAIN missing in $ENV_FILE}"

reload_nginx() { dc exec -T nginx nginx -s reload; }

cmd_status() {
    dc ps
    echo
    local cid; cid="$(dc ps -q nginx | head -1)"
    if [ -n "$cid" ] && docker exec "$cid" test -s "/etc/letsencrypt/live/${domain}/fullchain.pem" 2>/dev/null; then
        printf 'Certificate for %s expires: ' "$domain"
        docker exec "$cid" cat "/etc/letsencrypt/live/${domain}/fullchain.pem" | openssl x509 -noout -enddate | sed 's/notAfter=//'
    else
        echo "No certificate in place yet for ${domain}."
    fi
}

cmd_backup() {
    local out="${1:-$REPO_DIR/backups/cropshift-$(date -u +%Y%m%dT%H%M%SZ).dump}" tmp
    mkdir -p "$(dirname "$out")"
    tmp="$(umask 077; mktemp "${out}.partial.XXXXXX")"
    if dc exec -T db pg_dump -U "${ENV_CUR[POSTGRES_USER]:-rurotation}" -d "${ENV_CUR[POSTGRES_DB]:-rurotation}" -Fc > "$tmp"; then
        [ -s "$tmp" ] || { rm -f "$tmp"; die "pg_dump produced an empty file"; }
        mv "$tmp" "$out"
        ok "Backup written to $out ($(du -h "$out" | cut -f1))"
    else
        rm -f "$tmp"
        die "pg_dump failed: no backup was written"
    fi
}

cmd_restore() {
    local file="${1:?usage: manage.sh restore FILE}" safety
    [ -f "$file" ] || die "$file not found"
    confirm "This REPLACES the database content with $file. A safety dump of the current database is taken first. Continue?" n || exit 1
    safety="$REPO_DIR/backups/pre-restore-$(date -u +%Y%m%dT%H%M%SZ).dump"
    cmd_backup "$safety"
    dc stop api web >/dev/null
    # One transaction, stop at the first error: a failed restore leaves the database exactly as it was.
    if dc exec -T db pg_restore -U "${ENV_CUR[POSTGRES_USER]:-rurotation}" -d "${ENV_CUR[POSTGRES_DB]:-rurotation}" \
            --clean --if-exists --no-owner --single-transaction --exit-on-error < "$file"; then
        dc up -d api web
        ok "Restored from $file (safety dump of the previous state: $safety). Run: manage.sh smoke"
    else
        dc up -d api web
        die "Restore failed and was rolled back: the database is unchanged. The file may be truncated or from another version."
    fi
}

cmd_update() {
    info "Backing up before the update"
    cmd_backup
    info "Updating the code (fast-forward only)"
    local owner; owner="$(stat -c %U "$REPO_DIR/.git")"
    if [ "$(id -u)" -eq 0 ] && [ "$owner" != root ]; then
        sudo -u "$owner" git -C "$REPO_DIR" pull --ff-only   # keep .git owned by its user, not root
    else
        git -C "$REPO_DIR" pull --ff-only
    fi
    info "Rebuilding images and pulling base images"
    dc --profile tools --profile tls pull --ignore-buildable --quiet 2>/dev/null || true
    dc --profile tools build
    info "Applying migrations"
    dc up -d db
    dc run --rm migrate
    info "Restarting services"
    dc up -d api web nginx
    [ "$cert_mode" = selfsigned ] || dc --profile tls up -d certbot
    ok "Updated. Run: manage.sh smoke (if something is wrong, restore the backup above)"
}

cmd_issue_cert() {
    [ "$cert_mode" != selfsigned ] || die "CERT_MODE=selfsigned: re-run install.sh to create a new self-signed certificate."
    local args=(certonly --webroot -w /var/www/certbot -d "$domain" --email "${ENV_CUR[LETSENCRYPT_EMAIL]:?LETSENCRYPT_EMAIL missing}"
                --agree-tos --no-eff-email --non-interactive --keep-until-expiring)   # not expired yet: certbot keeps it
    [ "$cert_mode" = letsencrypt-staging ] && args+=(--staging)
    dc --profile tls run --rm --entrypoint certbot certbot "${args[@]}"
    dc restart nginx
}

cmd_smoke() {
    local insecure=()
    [ "$cert_mode" = letsencrypt ] || insecure=(--insecure)
    "$DEPLOY_DIR/scripts/smoke-test.sh" "$domain" "${ENV_CUR[HTTPS_PORT]:-443}" "${ENV_CUR[HTTP_PORT]:-80}" "${insecure[@]}"
}

cmd_env() {
    local key
    for key in $(printf '%s\n' "${!ENV_CUR[@]}" | sort); do
        case "$key" in
            *PASSWORD*|*KEY*|*SECRET*|*TOKEN*) printf '%s=%s\n' "$key" "$(mask "${ENV_CUR[$key]}")" ;;
            *) printf '%s=%s\n' "$key" "${ENV_CUR[$key]}" ;;
        esac
    done
}

case "${1:-help}" in
    status) cmd_status ;;
    logs) shift; dc --profile tls logs -f --tail 100 "$@" ;;
    start) dc up -d db api web nginx; [ "$cert_mode" = selfsigned ] || dc --profile tls up -d certbot ;;
    stop) dc --profile tls stop ;;
    restart) shift; dc restart "$@" ;;
    update) cmd_update ;;
    issue-cert) cmd_issue_cert ;;
    renew-now) dc --profile tls run --rm --entrypoint certbot certbot renew --webroot -w /var/www/certbot && reload_nginx ;;
    backup) shift; cmd_backup "$@" ;;
    restore) shift; cmd_restore "$@" ;;
    smoke) cmd_smoke ;;
    env) cmd_env ;;
    *) die "Unknown command '$1'. Try: manage.sh help" ;;
esac
