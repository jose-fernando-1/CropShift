#!/usr/bin/env bash
# Cropshift installer for a raw Linux server: installs Docker, asks for each setting, builds, starts the whole stack
# behind nginx and gets a Let's Encrypt certificate (certbot), with automatic renewal. Safe to re-run.
#
#   git clone <repo> && cd <repo>
#   sudo ./deployment/install.sh
#
# Options:
#   --non-interactive   take every value from the environment or deployment/.env (for automation); errors when a
#                       required value is missing instead of asking
#   --env-only          only ask for settings and write deployment/.env, then stop
#   --skip-docker       do not try to install Docker (it must already be there)
#   --no-firewall       leave the firewall alone
#   --no-root-check     do not require root (rootless Docker, or testing with a user that can run docker)
#   -h, --help
#
# Supported: Debian/Ubuntu (apt) tested path; Fedora/RHEL family (dnf) is best effort.
# It needs: root, a DNS A record for your domain pointing at this machine, and ports 80 and 443 reachable.
set -euo pipefail

ORIGINAL_ARGS=("$@")
DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$DEPLOY_DIR")"
ENV_FILE="$DEPLOY_DIR/.env"
PROJECT="${COMPOSE_PROJECT_NAME:-cropshift}"
# shellcheck source=scripts/lib.sh
. "$DEPLOY_DIR/scripts/lib.sh"

usage() {
    cat <<'USAGE'
Cropshift installer: takes a raw Linux server to a running HTTPS site (Docker, nginx, certbot). Safe to re-run.

  sudo ./deployment/install.sh [options]

Options:
  --non-interactive   take every value from the environment or deployment/.env (automation); a missing
                      required value is an error instead of a question
  --env-only          only ask for the settings and write deployment/.env (no root, no installs, nothing started)
  --skip-docker       do not install Docker (it must already be there)
  --no-firewall       leave the firewall alone
  --no-root-check     do not require root (rootless Docker, or testing)
  -h, --help

Needs: a DNS A record for your domain pointing at this machine and ports 80/443 reachable (Let's Encrypt modes).
Supported: Debian/Ubuntu (tested path); Fedora/RHEL family is best effort.
USAGE
}

ENV_ONLY=0; SKIP_DOCKER=0; NO_FIREWALL=0; NO_ROOT_CHECK=0
while [ $# -gt 0 ]; do
    case "$1" in
        --non-interactive) NONINTERACTIVE=1 ;;
        --env-only) ENV_ONLY=1 ;;
        --skip-docker) SKIP_DOCKER=1 ;;
        --no-firewall) NO_FIREWALL=1 ;;
        --no-root-check) NO_ROOT_CHECK=1 ;;
        -h|--help) usage; exit 0 ;;
        *) die "Unknown option: $1 (see --help)" ;;
    esac
    shift
done

dc() { docker compose -p "$PROJECT" -f "$DEPLOY_DIR/docker-compose.yml" --env-file "$ENV_FILE" "$@"; }

# ------------------------------------------------------------------------------------------------ 1. preflight
preflight() {
    step "Checking this machine"
    if [ "$(id -u)" -ne 0 ] && [ "$NO_ROOT_CHECK" = 0 ]; then
        command -v sudo >/dev/null 2>&1 || die "Run as root (sudo ./deployment/install.sh)."
        info "Re-running with sudo"
        exec sudo -E bash "${BASH_SOURCE[0]}" "${ORIGINAL_ARGS[@]}"
    fi
    [ "$(uname -s)" = "Linux" ] || die "This installer is for Linux servers."
    [ -f "$REPO_DIR/backend/Dockerfile" ] && [ -f "$REPO_DIR/web/Dockerfile" ] \
        || die "Run this from a full clone of the repository (backend/ and web/ are missing next to deployment/)."
    detect_os
    [ "$(os_family)" != unsupported ] || die "Unsupported distribution '$OS_ID'. Use Debian/Ubuntu, or install Docker yourself and pass --skip-docker."
    ok "Linux: ${PRETTY_NAME:-$OS_ID}"

    local mem_mb
    mem_mb="$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)"
    if [ "$mem_mb" -lt 1800 ]; then
        warn "Only ${mem_mb} MB of RAM: building the web image needs about 2 GB. Add swap first, e.g.: fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile"
    fi
    local free_gb
    free_gb="$(df -Pk /var/lib 2>/dev/null | awk 'NR==2 {print int($4/1024/1024)}')"
    [ "${free_gb:-10}" -ge 6 ] || warn "Only ${free_gb} GB free under /var/lib: images and the database need about 6 GB."
}

# ------------------------------------------------------------------------------------------------ 2. packages
install_base_packages() {
    step "Installing base packages and Docker"
    local family; family="$(os_family)"
    local pkgs=() tool
    for tool in curl openssl ss; do
        command -v "$tool" >/dev/null 2>&1 && continue
        case "$tool" in ss) pkgs+=("$([ "$family" = debian ] && echo iproute2 || echo iproute)") ;; *) pkgs+=("$tool") ;; esac
    done
    if [ "${#pkgs[@]}" -eq 0 ]; then
        ok "curl, openssl and iproute2 are already installed"
    elif [ "$family" = debian ]; then
        export DEBIAN_FRONTEND=noninteractive
        apt-get update -qq
        apt-get install -y -qq ca-certificates "${pkgs[@]}" >/dev/null
        ok "installed: ${pkgs[*]}"
    else
        local pm; pm="$(command -v dnf || command -v yum)"
        "$pm" install -y -q "${pkgs[@]}" >/dev/null
        ok "installed: ${pkgs[*]}"
    fi

    if docker compose version >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
        ok "Docker $(docker --version | awk '{print $3}' | tr -d ,) with Compose $(docker compose version --short) is already installed"
        return
    fi
    [ "$SKIP_DOCKER" = 0 ] || die "Docker with the Compose plugin is not available and --skip-docker was given."
    if command -v docker >/dev/null 2>&1; then
        die "Docker is installed but 'docker compose' (v2 plugin) or the daemon is not working. Installing Docker's own packages would replace your engine and restart other containers on this host, so I will not do it: install the compose plugin (apt install docker-compose-v2, or Docker's docker-compose-plugin) or start the daemon, then re-run."
    fi
    info "Installing Docker Engine from Docker's official repository"
    if [ "$family" = debian ]; then
        local repo_id="debian"
        case " $OS_ID $OS_LIKE " in *" ubuntu "*) repo_id="ubuntu" ;; esac
        [ -n "$OS_VERSION_CODENAME" ] || die "Cannot determine the release codename for Docker's apt repository."
        curl -fsSI "https://download.docker.com/linux/${repo_id}/dists/${OS_VERSION_CODENAME}/Release" >/dev/null 2>&1 \
            || die "Docker has no apt repository for ${repo_id} '${OS_VERSION_CODENAME}'. Install Docker manually and re-run with --skip-docker."
        apt-get install -y -qq gnupg >/dev/null
        install -m 0755 -d /etc/apt/keyrings
        curl -fsSL "https://download.docker.com/linux/${repo_id}/gpg" -o /etc/apt/keyrings/docker.asc
        chmod a+r /etc/apt/keyrings/docker.asc
        echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/${repo_id} ${OS_VERSION_CODENAME} stable" \
            > /etc/apt/sources.list.d/docker.list
        apt-get update -qq
        apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin >/dev/null
    else
        local pm repo_id="centos"; pm="$(command -v dnf || command -v yum)"
        case "$OS_ID" in fedora) repo_id="fedora" ;; rhel) repo_id="rhel" ;; esac
        "$pm" install -y -q dnf-plugins-core >/dev/null || true
        "$pm" config-manager addrepo --from-repofile="https://download.docker.com/linux/${repo_id}/docker-ce.repo" 2>/dev/null \
            || "$pm" config-manager --add-repo "https://download.docker.com/linux/${repo_id}/docker-ce.repo"
        "$pm" install -y -q docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin >/dev/null
    fi
    systemctl enable --now docker >/dev/null 2>&1 || service docker start
    docker compose version >/dev/null 2>&1 || die "Docker installed but 'docker compose' does not work."
    ok "Docker $(docker --version | awk '{print $3}' | tr -d ,) installed and enabled at boot"
}

# ------------------------------------------------------------------------------------------------ 3. configuration
gather_config() {
    step "Configuration"
    load_env_file "$ENV_FILE"
    if [ -f "$ENV_FILE" ]; then
        info "Found $ENV_FILE: press Enter at any question to keep the value shown."
    else
        info "Answer each question; defaults are in [brackets]. Nothing is sent anywhere: values go to $ENV_FILE (mode 600)."
    fi
    [ "$NONINTERACTIVE" = 1 ] && info "Non-interactive: using the environment, then $ENV_FILE, then defaults."

    choose CERT_MODE "Certificate mode" \
"HTTPS certificate source:
  letsencrypt          real, trusted certificate (needs public DNS for the domain and ports 80/443 open)
  letsencrypt-staging  Let's Encrypt test CA: same flow, certificates are NOT trusted (use to rehearse; avoids rate limits)
  selfsigned           a local self-signed certificate (no public DNS needed; browsers will warn)" \
        letsencrypt "letsencrypt|letsencrypt-staging|selfsigned"

    ask DOMAIN "Domain name" \
"The public hostname people will open, e.g. cropshift.example.org. Its DNS A record must point to this server.
Use 'localhost' only with the selfsigned mode (testing)." \
        "" required validate_domain

    if [ "${ENV_NEW[CERT_MODE]}" = selfsigned ]; then
        ENV_ORDER+=("LETSENCRYPT_EMAIL"); ENV_NEW[LETSENCRYPT_EMAIL]="$(current_value LETSENCRYPT_EMAIL)"
    else
        ask LETSENCRYPT_EMAIL "Email for Let's Encrypt" \
"Let's Encrypt sends certificate-expiry warnings and account notices here. It is shared only with Let's Encrypt." \
            "" required validate_email
    fi

    local existing_pw volume_exists=0
    existing_pw="$(current_value POSTGRES_PASSWORD)"
    docker volume inspect "${PROJECT}_postgres_data" >/dev/null 2>&1 && volume_exists=1
    if [ -n "$existing_pw" ]; then
        ask POSTGRES_PASSWORD "PostgreSQL password" \
"Keep the current password unless you also changed it inside the database (it cannot be cleared here)." \
            "" secret validate_password
    elif [ "$volume_exists" = 1 ]; then
        warn "A database volume from a previous install exists but no password is stored in $ENV_FILE."
        warn "Enter the ORIGINAL database password; a new one would not match the existing data."
        ask POSTGRES_PASSWORD "PostgreSQL password" "The password the existing database was created with." "" secret validate_password
    else
        ask POSTGRES_PASSWORD "PostgreSQL password" \
"Password of the database user. Leave empty to generate a strong random one (recommended); it is only stored in
$ENV_FILE. Changing it later does not change an already-initialised database." \
            "" secret-optional validate_password
        if [ -z "${ENV_NEW[POSTGRES_PASSWORD]}" ]; then
            ENV_NEW[POSTGRES_PASSWORD]="$(random_secret)"
            ok "Generated a random database password"
        fi
    fi

    ask GEMINI_API_KEY "Gemini API key (optional)" \
"Enables AI-written explanations (Google AI Studio -> Get API key). Without it, explanations use a built-in template
and everything else works. Content is sent to Google; no coordinates or personal data are included. '-' clears it." \
        "" secret-optional
    if [ -n "${ENV_NEW[GEMINI_API_KEY]}" ]; then
        ask GEMINI_MODEL "Gemini model (first choice)" \
"A model your key can call. Models are retired and sometimes overloaded, so the API falls through a fallback chain.
Enter a name, or leave empty to use only the built-in defaults (gemini-3.6-flash, gemini-3.5-flash-lite, gemini-3.8-flash)." \
            "" optional
        ask GEMINI_FALLBACK_MODELS "Gemini fallback models (comma separated)" \
"Tried in order when the first choice fails; the built-in defaults follow them. Leave empty if the defaults are enough." \
            "" optional
    else
        ENV_ORDER+=("GEMINI_MODEL" "GEMINI_FALLBACK_MODELS"); ENV_NEW[GEMINI_MODEL]=""; ENV_NEW[GEMINI_FALLBACK_MODELS]=""
    fi

    choose SHOW_DATA_FLOW "Show the 'Data flow' inspector" \
"The header button that lists every API call. Useful for demos and debugging; hide it on a public site (false)." \
        false "true|false"
    ask RATE_LIMIT_PER_MIN "Requests per minute per visitor (POST routes)" \
"Abuse protection in the API (0 disables it). nginx adds a coarse per-IP limit on top." \
        60 required validate_rate

    # Fixed values (not asked): kept visible in .env so the stack is reproducible.
    ENV_ORDER+=(LOG_LEVEL HTTP_PORT HTTPS_PORT HTTPS_PORT_SUFFIX POSTGRES_USER POSTGRES_DB)
    ENV_NEW[LOG_LEVEL]="$(current_value LOG_LEVEL)"; [ -n "${ENV_NEW[LOG_LEVEL]}" ] || ENV_NEW[LOG_LEVEL]=INFO
    ENV_NEW[HTTP_PORT]="$(current_value HTTP_PORT)"; [ -n "${ENV_NEW[HTTP_PORT]}" ] || ENV_NEW[HTTP_PORT]=80
    ENV_NEW[HTTPS_PORT]="$(current_value HTTPS_PORT)"; [ -n "${ENV_NEW[HTTPS_PORT]}" ] || ENV_NEW[HTTPS_PORT]=443
    if ! validate_port "${ENV_NEW[HTTP_PORT]}" || ! validate_port "${ENV_NEW[HTTPS_PORT]}"; then die "Invalid HTTP_PORT/HTTPS_PORT"; fi
    if [ "${ENV_NEW[HTTPS_PORT]}" = 443 ]; then ENV_NEW[HTTPS_PORT_SUFFIX]=""; else ENV_NEW[HTTPS_PORT_SUFFIX]=":${ENV_NEW[HTTPS_PORT]}"; fi
    ENV_NEW[POSTGRES_USER]="$(current_value POSTGRES_USER)"; [ -n "${ENV_NEW[POSTGRES_USER]}" ] || ENV_NEW[POSTGRES_USER]=rurotation
    ENV_NEW[POSTGRES_DB]="$(current_value POSTGRES_DB)"; [ -n "${ENV_NEW[POSTGRES_DB]}" ] || ENV_NEW[POSTGRES_DB]=rurotation

    write_env_file "$ENV_FILE"
    ok "Wrote $ENV_FILE (mode 600)"
    info "Summary: domain=${ENV_NEW[DOMAIN]} certs=${ENV_NEW[CERT_MODE]} db-password=$(mask "${ENV_NEW[POSTGRES_PASSWORD]}") gemini=$(mask "${ENV_NEW[GEMINI_API_KEY]}") data-flow=${ENV_NEW[SHOW_DATA_FLOW]}"
    info "Earthdata credentials are not needed here: they only matter for re-extracting satellite data on a developer machine."
    if ! [ "$NONINTERACTIVE" = 1 ] && [ "$ENV_ONLY" = 0 ]; then
        confirm "Continue with the installation?" y || { info "Stopped. Re-run when ready."; exit 0; }
    fi
}

# ------------------------------------------------------------------------------------------------ 4. network
check_dns_and_ports() {
    step "Checking DNS and ports"
    local domain="${ENV_NEW[DOMAIN]}" mode="${ENV_NEW[CERT_MODE]}"
    local own_nginx=0
    docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${PROJECT}-nginx-1$" && own_nginx=1
    if [ "$own_nginx" = 0 ]; then
        for p in "${ENV_NEW[HTTP_PORT]}" "${ENV_NEW[HTTPS_PORT]}"; do
            if port_in_use "$p"; then die "Port $p is already in use by another program (a web server?). Stop it, or choose other ports in $ENV_FILE."; fi
        done
        ok "Ports ${ENV_NEW[HTTP_PORT]} and ${ENV_NEW[HTTPS_PORT]} are free"
    fi
    [ "$mode" = selfsigned ] && { ok "selfsigned mode: skipping the public DNS check"; return; }
    if [ "${ENV_NEW[HTTP_PORT]}" != 80 ]; then
        die "Let's Encrypt validates over port 80: HTTP_PORT must be 80 in $mode mode (it is ${ENV_NEW[HTTP_PORT]})."
    fi
    if getent ahostsv6 "$domain" 2>/dev/null | grep -q .; then
        warn "$domain has an AAAA (IPv6) record. Let's Encrypt tries IPv6 first: it must point to this server and be reachable on port 80, or issuance fails. Remove the AAAA record if unsure. IPv6 visitors also share one rate-limit bucket (Docker NAT)."
    fi

    local resolved my_ip
    resolved="$(getent ahostsv4 "$domain" 2>/dev/null | awk 'NR==1 {print $1}')"
    my_ip="$(public_ipv4)"
    if [ -z "$resolved" ]; then
        warn "$domain does not resolve yet. Create a DNS A record pointing to ${my_ip:-the public IP of this server}, wait for it to propagate, then re-run."
        [ "$NONINTERACTIVE" = 1 ] && die "DNS for $domain is not ready."
        confirm "Continue anyway (certificate issuance will fail until DNS works)?" n || exit 1
    elif [ -n "$my_ip" ] && [ "$resolved" != "$my_ip" ]; then
        warn "$domain resolves to $resolved but this server's public IP looks like $my_ip."
        [ "$NONINTERACTIVE" = 1 ] && [ "${SKIP_DNS_CHECK:-0}" != 1 ] && die "DNS mismatch (set SKIP_DNS_CHECK=1 to ignore, e.g. behind NAT)."
        [ "$NONINTERACTIVE" = 1 ] || confirm "Continue anyway?" n || exit 1
    else
        ok "$domain -> ${resolved} (matches this server)"
    fi
}

configure_firewall() {
    [ "$NO_FIREWALL" = 0 ] || return 0
    if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
        step "Firewall (ufw)"
        if confirm "ufw is active. Allow ports ${ENV_NEW[HTTP_PORT]} and ${ENV_NEW[HTTPS_PORT]}?" y; then
            ufw allow "${ENV_NEW[HTTP_PORT]}/tcp" >/dev/null; ufw allow "${ENV_NEW[HTTPS_PORT]}/tcp" >/dev/null
            ok "ufw: ports opened (SSH rules untouched)"
        fi
    elif command -v firewall-cmd >/dev/null 2>&1 && firewall-cmd --state >/dev/null 2>&1; then
        step "Firewall (firewalld)"
        if confirm "firewalld is running. Allow http and https?" y; then
            firewall-cmd --permanent --add-port="${ENV_NEW[HTTP_PORT]}/tcp" --add-port="${ENV_NEW[HTTPS_PORT]}/tcp" >/dev/null && firewall-cmd --reload >/dev/null
            ok "firewalld: ports ${ENV_NEW[HTTP_PORT]} and ${ENV_NEW[HTTPS_PORT]} opened"
        fi
    fi
}

# ------------------------------------------------------------------------------------------------ 5. stack
wait_healthy() {  # wait_healthy service seconds
    local svc="$1" timeout="$2" cid status waited=0
    while [ "$waited" -lt "$timeout" ]; do
        cid="$(dc ps -q "$svc" 2>/dev/null | head -1)"
        status="$([ -n "$cid" ] && docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$cid" 2>/dev/null || echo none)"
        case "$status" in healthy|running) return 0 ;; esac
        sleep 3; waited=$((waited + 3))
    done
    dc logs --tail 40 "$svc" >&2 || true
    die "$svc did not become healthy within ${timeout}s"
}

start_stack() {
    step "Building images (the web build takes a few minutes)"
    dc --profile tools build
    step "Starting the database and applying migrations"
    dc up -d db
    wait_healthy db 120
    dc run --rm migrate
    local crops
    crops="$(dc exec -T db psql -U "${ENV_NEW[POSTGRES_USER]}" -d "${ENV_NEW[POSTGRES_DB]}" -tAc 'SELECT count(*) FROM crops' 2>/dev/null | tr -d '[:space:]' || true)"
    if [ "${crops:-0}" = "0" ]; then
        info "Empty database: loading the demo dataset (crops, municipalities, ZARC, PAM, precomputed windows)"
        dc --profile tools run --rm seed
    else
        ok "Database already has data (${crops} crops): keeping it"
    fi
    step "Starting api, web and nginx"
    dc up -d api web nginx
    wait_healthy api 120
    wait_healthy web 120
    wait_healthy nginx 60
    ok "Stack is up (plain HTTP while there is no certificate)"
}

# --- certificate lifecycle -----------------------------------------------------------------------------------
# A marker file next to the certificate records which mode made it. A certificate counts as "in place" only when the
# marker matches the chosen mode (so staging -> production or self-signed -> Let's Encrypt really issues a new one)
# and, for self-signed certificates, when it is not within 30 days of expiry (re-running install.sh renews it).
cert_volume_run() {  # cert_volume_run "shell command"   (volume mounted read-write at /c)
    docker run --rm -v "${PROJECT}_certs:/c" --entrypoint sh "$NGINX_IMAGE" -c "$1"
}

cert_present() { cert_volume_run "test -s /c/live/${ENV_NEW[DOMAIN]}/fullchain.pem" >/dev/null 2>&1; }

cert_ok() {
    cert_present || return 1
    local marker
    marker="$(cert_volume_run "cat /c/live/${ENV_NEW[DOMAIN]}/.cropshift-mode 2>/dev/null" 2>/dev/null || true)"
    [ "$marker" = "${ENV_NEW[CERT_MODE]}" ] || return 1
    if [ "${ENV_NEW[CERT_MODE]}" = selfsigned ]; then
        cert_volume_run "cat /c/live/${ENV_NEW[DOMAIN]}/fullchain.pem" 2>/dev/null | openssl x509 -noout -checkend 2592000 >/dev/null 2>&1 || return 1
    fi
    return 0
}

reset_cert_lineage() {  # remove whatever certificate exists for the domain (any mode) so a new one can be made
    cert_volume_run "rm -rf /c/live/${ENV_NEW[DOMAIN]} /c/archive/${ENV_NEW[DOMAIN]} /c/renewal/${ENV_NEW[DOMAIN]}.conf"
}

mark_cert() { cert_volume_run "echo ${ENV_NEW[CERT_MODE]} > /c/live/${ENV_NEW[DOMAIN]}/.cropshift-mode"; }

issue_selfsigned() {
    local tmp; tmp="$(mktemp -d)"
    openssl req -x509 -nodes -newkey rsa:2048 -days 365 -subj "/CN=${ENV_NEW[DOMAIN]}" \
        -addext "subjectAltName=DNS:${ENV_NEW[DOMAIN]}" -keyout "$tmp/privkey.pem" -out "$tmp/fullchain.pem" 2>/dev/null
    docker run --rm -v "${PROJECT}_certs:/dst" -v "$tmp:/src:ro" --entrypoint sh "$NGINX_IMAGE" \
        -c "mkdir -p /dst/live/${ENV_NEW[DOMAIN]} && cp /src/fullchain.pem /src/privkey.pem /dst/live/${ENV_NEW[DOMAIN]}/ && chmod 600 /dst/live/${ENV_NEW[DOMAIN]}/privkey.pem"
    rm -rf "$tmp"
}

# Let's Encrypt allows only 5 failed validations per hostname per hour: prove the challenge path works from
# THIS machine's view of the public name before spending an attempt. (Override: SKIP_ACME_SELFTEST=1, e.g. NAT hairpin.)
acme_selftest() {
    [ "${SKIP_ACME_SELFTEST:-0}" = 1 ] && { warn "Skipping the challenge self-test (SKIP_ACME_SELFTEST=1)"; return 0; }
    local url="http://${ENV_NEW[DOMAIN]}/.well-known/acme-challenge/cropshift-selftest" ok_flag=0
    docker run --rm -v "${PROJECT}_acme_webroot:/w" --entrypoint sh "$NGINX_IMAGE" \
        -c "mkdir -p /w/.well-known/acme-challenge && echo cropshift-ok > /w/.well-known/acme-challenge/cropshift-selftest"
    curl -fsS --max-time 15 "$url" 2>/dev/null | grep -q cropshift-ok && ok_flag=1
    docker run --rm -v "${PROJECT}_acme_webroot:/w" --entrypoint sh "$NGINX_IMAGE" -c "rm -f /w/.well-known/acme-challenge/cropshift-selftest" >/dev/null 2>&1 || true
    [ "$ok_flag" = 1 ] && return 0
    die "http://${ENV_NEW[DOMAIN]}/ does not reach this server's nginx on port 80 (checked from this machine). Fix DNS (A record), the cloud firewall/security group, or anything else listening on port 80, then re-run: nothing was sent to Let's Encrypt, so no rate-limit attempt was used. If this server cannot reach its own public address (NAT hairpin), re-run with SKIP_ACME_SELFTEST=1."
}

issue_letsencrypt() {
    local args=(certonly --webroot -w /var/www/certbot -d "${ENV_NEW[DOMAIN]}" --email "${ENV_NEW[LETSENCRYPT_EMAIL]}"
                --agree-tos --no-eff-email --non-interactive)
    [ "${ENV_NEW[CERT_MODE]}" = letsencrypt-staging ] && args+=(--staging)
    dc --profile tls run --rm --entrypoint certbot certbot "${args[@]}"
}

setup_tls() {
    step "HTTPS certificate (${ENV_NEW[CERT_MODE]})"
    if cert_ok; then
        ok "A ${ENV_NEW[CERT_MODE]} certificate for ${ENV_NEW[DOMAIN]} is already in place$([ "${ENV_NEW[CERT_MODE]}" = selfsigned ] || echo " (certbot renews it automatically)")"
    elif [ "${ENV_NEW[CERT_MODE]}" = selfsigned ]; then
        cert_present && info "Replacing the existing certificate (different mode or close to expiry)"
        reset_cert_lineage
        issue_selfsigned && mark_cert && ok "Self-signed certificate created (valid 365 days; re-run install.sh within 30 days of expiry to renew)"
    else
        info "Checking that the HTTP challenge path is reachable"
        acme_selftest
        cert_present && info "Replacing the existing certificate (it was made in a different mode)"
        reset_cert_lineage
        info "Asking Let's Encrypt via the HTTP challenge on port ${ENV_NEW[HTTP_PORT]}"
        issue_letsencrypt || die "Certificate issuance failed (see certbot's message above). Re-run this script after fixing it: it resumes."
        mark_cert
        ok "Certificate issued"
    fi
    info "Switching nginx to HTTPS"
    dc restart nginx >/dev/null
    wait_healthy nginx 60
    if [ "${ENV_NEW[CERT_MODE]}" != selfsigned ]; then
        dc --profile tls up -d certbot >/dev/null
        ok "certbot renewal service running (checks twice a day, nginx reloads itself)"
    fi
}

verify() {
    step "Verifying"
    local insecure=""
    [ "${ENV_NEW[CERT_MODE]}" = letsencrypt ] || insecure="--insecure"
    "$DEPLOY_DIR/scripts/smoke-test.sh" "${ENV_NEW[DOMAIN]}" "${ENV_NEW[HTTPS_PORT]}" "${ENV_NEW[HTTP_PORT]}" $insecure
}

summary() {
    local suffix="${ENV_NEW[HTTPS_PORT_SUFFIX]}"
    printf '\n%s\n' "${C_GRN}Cropshift is running at https://${ENV_NEW[DOMAIN]}${suffix}/${C_OFF}"
    cat <<MSG

  Manage it:      sudo ./deployment/manage.sh status | logs [service] | update | backup | stop | start
  Configuration:  $ENV_FILE  (secrets, mode 600; re-run install.sh to change answers)
  Data:           Docker volumes ${PROJECT}_postgres_data and ${PROJECT}_certs
                  NEVER run 'docker compose down -v' (it deletes the database and the certificates)
  Certificates:   $( [ "${ENV_NEW[CERT_MODE]}" = selfsigned ] && echo "self-signed, 365 days: re-run install.sh within 30 days of expiry to renew" || echo "renewed automatically by the certbot service" )
  Docs:           deployment/README.md
MSG
}

main() {
    if [ "$ENV_ONLY" = 1 ]; then
        gather_config
        info "--env-only: wrote $ENV_FILE. Nothing was installed or started."
        exit 0
    fi
    preflight
    install_base_packages
    gather_config
    check_dns_and_ports
    configure_firewall
    start_stack
    setup_tls
    verify
    summary
}
main "$@"
