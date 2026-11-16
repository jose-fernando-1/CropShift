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

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$DEPLOY_DIR")"
ENV_FILE="$DEPLOY_DIR/.env"
PROJECT="${COMPOSE_PROJECT_NAME:-cropshift}"
# shellcheck source=scripts/lib.sh
. "$DEPLOY_DIR/scripts/lib.sh"

ENV_ONLY=0; SKIP_DOCKER=0; NO_FIREWALL=0; NO_ROOT_CHECK=0
while [ $# -gt 0 ]; do
    case "$1" in
        --non-interactive) NONINTERACTIVE=1 ;;
        --env-only) ENV_ONLY=1 ;;
        --skip-docker) SKIP_DOCKER=1 ;;
        --no-firewall) NO_FIREWALL=1 ;;
        --no-root-check) NO_ROOT_CHECK=1 ;;
        -h|--help) sed -n '2,22p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
        *) die "Unknown option: $1 (see --help)" ;;
    esac
    shift
done

dc() { docker compose -p "$PROJECT" -f "$DEPLOY_DIR/docker-compose.yml" --env-file "$ENV_FILE" "$@"; }

ORIGINAL_ARGS=("$@")

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
    local missing=0 tool
    for tool in curl openssl ss; do command -v "$tool" >/dev/null 2>&1 || missing=1; done
    if [ "$missing" = 0 ]; then
        ok "curl, openssl and iproute2 are already installed"
    elif [ "$family" = debian ]; then
        export DEBIAN_FRONTEND=noninteractive
        apt-get update -qq
        apt-get install -y -qq ca-certificates curl gnupg openssl iproute2 >/dev/null
        ok "ca-certificates, curl, openssl, iproute2"
    else
        local pm; pm="$(command -v dnf || command -v yum)"
        "$pm" install -y -q ca-certificates curl openssl iproute >/dev/null
        ok "ca-certificates, curl, openssl, iproute"
    fi

    if docker compose version >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
        ok "Docker $(docker --version | awk '{print $3}' | tr -d ,) with Compose $(docker compose version --short) is already installed"
        return
    fi
    [ "$SKIP_DOCKER" = 0 ] || die "Docker with the Compose plugin is not available and --skip-docker was given."
    info "Installing Docker Engine from Docker's official repository"
    if [ "$family" = debian ]; then
        local repo_id="debian"
        case " $OS_ID $OS_LIKE " in *" ubuntu "*) repo_id="ubuntu" ;; esac
        [ -n "$OS_VERSION_CODENAME" ] || die "Cannot determine the release codename for Docker's apt repository."
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

    local existing_pw; existing_pw="$(current_value POSTGRES_PASSWORD)"
    if [ -z "$existing_pw" ] && docker volume inspect "${PROJECT}_postgres_data" >/dev/null 2>&1; then
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
Leave empty to use the built-in defaults (gemini-3.6-flash, gemini-3.5-flash-lite, gemini-3.8-flash)." \
            "gemini-3.6-flash" optional
        ask GEMINI_FALLBACK_MODELS "Gemini fallback models (comma separated)" \
"Tried in order when the first choice fails. Leave empty for the built-in defaults." \
            "gemini-3.5-flash-lite,gemini-3.1-flash-lite" optional
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
            firewall-cmd --permanent --add-service=http --add-service=https >/dev/null && firewall-cmd --reload >/dev/null
            ok "firewalld: http and https opened"
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
    crops="$(dc exec -T db psql -U "${ENV_NEW[POSTGRES_USER]}" -d "${ENV_NEW[POSTGRES_DB]}" -tAc 'SELECT count(*) FROM crops' 2>/dev/null | tr -d '[:space:]')"
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

cert_exists() {
    docker run --rm -v "${PROJECT}_certs:/c:ro" --entrypoint sh nginx:1.27-alpine \
        -c "test -s /c/live/${ENV_NEW[DOMAIN]}/fullchain.pem" >/dev/null 2>&1
}

issue_selfsigned() {
    local tmp; tmp="$(mktemp -d)"
    openssl req -x509 -nodes -newkey rsa:2048 -days 365 -subj "/CN=${ENV_NEW[DOMAIN]}" \
        -addext "subjectAltName=DNS:${ENV_NEW[DOMAIN]}" -keyout "$tmp/privkey.pem" -out "$tmp/fullchain.pem" 2>/dev/null
    docker run --rm -v "${PROJECT}_certs:/dst" -v "$tmp:/src:ro" --entrypoint sh nginx:1.27-alpine \
        -c "mkdir -p /dst/live/${ENV_NEW[DOMAIN]} && cp /src/fullchain.pem /src/privkey.pem /dst/live/${ENV_NEW[DOMAIN]}/ && chmod 600 /dst/live/${ENV_NEW[DOMAIN]}/privkey.pem"
    rm -rf "$tmp"
}

issue_letsencrypt() {
    local args=(certonly --webroot -w /var/www/certbot -d "${ENV_NEW[DOMAIN]}" --email "${ENV_NEW[LETSENCRYPT_EMAIL]}"
                --agree-tos --no-eff-email --non-interactive --keep-until-expiring)
    [ "${ENV_NEW[CERT_MODE]}" = letsencrypt-staging ] && args+=(--staging)
    dc --profile tls run --rm --entrypoint certbot certbot "${args[@]}"
}

setup_tls() {
    step "HTTPS certificate (${ENV_NEW[CERT_MODE]})"
    if cert_exists; then
        ok "A certificate for ${ENV_NEW[DOMAIN]} is already in place (certbot renews it automatically)"
    elif [ "${ENV_NEW[CERT_MODE]}" = selfsigned ]; then
        issue_selfsigned && ok "Self-signed certificate created (valid 365 days; browsers will show a warning)"
    else
        info "Asking Let's Encrypt via the HTTP challenge on port ${ENV_NEW[HTTP_PORT]}"
        issue_letsencrypt || die "Certificate issuance failed. Check that ${ENV_NEW[DOMAIN]} points to this server and port 80 is reachable from the internet, then re-run this script (it resumes)."
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
  Certificates:   $( [ "${ENV_NEW[CERT_MODE]}" = selfsigned ] && echo "self-signed, 365 days: re-run install.sh to renew" || echo "renewed automatically by the certbot service" )
  Docs:           deployment/README.md
MSG
}

main() {
    preflight
    install_base_packages
    gather_config
    [ "$ENV_ONLY" = 0 ] || { info "--env-only: done."; exit 0; }
    check_dns_and_ports
    configure_firewall
    start_stack
    setup_tls
    verify
    summary
}
main "$@"
