#!/usr/bin/env bash
# Shared helpers for install.sh and manage.sh: logging, prompts, a safe .env reader/writer, OS detection.
# shellcheck disable=SC2034  # variables below are read by install.sh and manage.sh
# Sourced, never executed. Nothing here prints a secret or enables `set -x`.

if [ -t 1 ]; then
    C_RED=$'\033[31m'; C_GRN=$'\033[32m'; C_YEL=$'\033[33m'; C_BLU=$'\033[34m'; C_DIM=$'\033[2m'; C_OFF=$'\033[0m'
else
    C_RED=""; C_GRN=""; C_YEL=""; C_BLU=""; C_DIM=""; C_OFF=""
fi

info()  { printf '%s\n' "${C_BLU}==>${C_OFF} $*"; }
ok()    { printf '%s\n' "${C_GRN}ok${C_OFF}  $*"; }
warn()  { printf '%s\n' "${C_YEL}warn${C_OFF} $*" >&2; }
die()   { printf '%s\n' "${C_RED}error${C_OFF} $*" >&2; exit 1; }
step()  { STEP_N=$(( ${STEP_N:-0} + 1 )); printf '\n%s\n' "${C_BLU}[${STEP_N}] $*${C_OFF}"; }

NONINTERACTIVE="${NONINTERACTIVE:-0}"

# ---------- .env handling ----------
# Values are restricted to a safe charset so they survive docker compose's .env parsing untouched
# (no spaces, quotes, $, backticks or backslashes). Generated secrets use hex.
SAFE_VALUE_RE='^[A-Za-z0-9._~+/=@:,%-]*$'

declare -A ENV_CUR=()   # values currently in the .env file
declare -A ENV_NEW=()   # values chosen in this run
ENV_ORDER=()            # keys in the order they are asked (also the order they are written)

load_env_file() {
    local file="$1" line key value
    [ -f "$file" ] || return 0
    while IFS= read -r line || [ -n "$line" ]; do
        case "$line" in ''|'#'*) continue ;; esac
        key="${line%%=*}"; value="${line#*=}"
        [[ "$key" =~ ^[A-Z][A-Z0-9_]*$ ]] || continue
        ENV_CUR["$key"]="$value"
    done < "$file"
}

current_value() {  # precedence: this run > real environment (automation) > existing file
    local key="$1"
    if [ -n "${ENV_NEW[$key]+x}" ]; then printf '%s' "${ENV_NEW[$key]}"
    elif [ -n "${!key:-}" ]; then printf '%s' "${!key}"
    elif [ -n "${ENV_CUR[$key]+x}" ]; then printf '%s' "${ENV_CUR[$key]}"
    fi
}

# ask KEY "Label" "Help text" default kind validator
#   kind: required | optional | secret | secret-optional
#   validator: name of a function that returns 0 when the value is acceptable (optional)
# Interactive: shows the help, the default/current value (masked for secrets) and reads one answer.
#   Enter keeps the shown value; for optional values, "-" clears it.
# Non-interactive: takes the environment/.env/default value; a missing required value is an error.
ask() {
    local key="$1" label="$2" help="$3" default="${4:-}" kind="${5:-required}" validator="${6:-}"
    local cur value shown secret=0 optional=0 prompt
    case "$kind" in secret|secret-optional) secret=1 ;; esac
    case "$kind" in optional|secret-optional) optional=1 ;; esac
    ENV_ORDER+=("$key")
    cur="$(current_value "$key")"
    [ -z "$cur" ] && cur="$default"

    if [ "$NONINTERACTIVE" = "1" ]; then
        value="$cur"
    else
        printf '\n%s\n' "${C_DIM}${help}${C_OFF}"
        if [ "$secret" = 1 ]; then
            if [ -n "$cur" ]; then shown="(keep current value)"; else shown="(hidden input)"; fi
        else
            shown="${cur:+[$cur]}"
        fi
        prompt="${label} ${shown}: "
        while :; do
            if [ "$secret" = 1 ]; then
                IFS= read -r -s -p "$prompt" value || die "input closed"; printf '\n'
            else
                IFS= read -r -p "$prompt" value || die "input closed"
            fi
            if [ -z "$value" ]; then value="$cur"
            elif [ "$value" = "-" ] && [ "$optional" = 1 ]; then value=""
            fi
            if [ -z "$value" ] && [ "$optional" = 0 ]; then warn "$label is required."; continue; fi
            if [ -n "$value" ] && ! [[ "$value" =~ $SAFE_VALUE_RE ]]; then
                warn "Only letters, digits and . _ ~ + / = @ : , % - are allowed (no spaces or quotes)."; continue
            fi
            if [ -n "$value" ] && [ -n "$validator" ] && ! "$validator" "$value"; then continue; fi
            break
        done
    fi
    if [ -z "$value" ] && [ "$optional" = 0 ]; then die "$key is required (set it in the environment or deployment/.env)"; fi
    if [ -n "$value" ] && ! [[ "$value" =~ $SAFE_VALUE_RE ]]; then die "$key contains characters that are not allowed"; fi
    if [ -n "$value" ] && [ -n "$validator" ] && ! "$validator" "$value"; then die "$key is invalid"; fi
    ENV_NEW["$key"]="$value"
}

# choose KEY "Label" "Help" default "opt1|opt2|opt3": like ask, restricted to one of the options.
choose() {
    local key="$1" label="$2" help="$3" default="$4" options="$5"
    # shellcheck disable=SC2329  # called indirectly by ask() through its validator argument
    _in_options() { local o; IFS='|' read -ra opts <<< "$options"; for o in "${opts[@]}"; do [ "$o" = "$1" ] && return 0; done; warn "Choose one of: ${options//|/, }"; return 1; }
    ask "$key" "$label" "$help" "$default" required _in_options
}

confirm() {  # confirm "Question" default(y|n) -> 0 for yes
    local question="$1" default="${2:-y}" answer
    if [ "$NONINTERACTIVE" = "1" ]; then [ "$default" = "y" ]; return; fi
    while :; do
        IFS= read -r -p "$question [$([ "$default" = y ] && echo Y/n || echo y/N)]: " answer || die "input closed"
        answer="${answer:-$default}"
        case "$answer" in y|Y|yes) return 0 ;; n|N|no) return 1 ;; esac
    done
}

write_env_file() {  # write_env_file path   (mode 600, atomically)
    local file="$1" tmp key
    tmp="$(umask 077; mktemp "${file}.XXXXXX")"
    {
        echo "# Written by deployment/install.sh on $(date -u +%Y-%m-%dT%H:%M:%SZ). Holds secrets: keep mode 600, never commit."
        for key in "${ENV_ORDER[@]}"; do
            printf '%s=%s\n' "$key" "${ENV_NEW[$key]-}"
        done
        local extra=0
        for key in "${!ENV_CUR[@]}"; do
            if [ -z "${ENV_NEW[$key]+x}" ]; then
                [ "$extra" = 0 ] && { echo; echo "# Kept from the previous file"; extra=1; }
                printf '%s=%s\n' "$key" "${ENV_CUR[$key]}"
            fi
        done
    } > "$tmp"
    chmod 600 "$tmp"
    mv "$tmp" "$file"
}

mask() { [ -n "${1:-}" ] && echo "set (hidden)" || echo "not set"; }

random_secret() {  # 48 hex chars
    if command -v openssl >/dev/null 2>&1; then openssl rand -hex 24
    else head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n'; fi
}

# ---------- validators ----------
validate_domain() {
    local v="$1"
    if [[ "$v" =~ ^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$ ]] || [ "$v" = "localhost" ]; then return 0; fi
    warn "Enter a lowercase domain name such as cropshift.example.org (localhost is accepted for self-signed tests)."; return 1
}
validate_email() {
    [[ "$1" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] && return 0
    warn "Enter a valid email address."; return 1
}
validate_port() {
    [[ "$1" =~ ^[0-9]+$ ]] && [ "$1" -ge 1 ] && [ "$1" -le 65535 ] && return 0
    warn "Enter a port between 1 and 65535."; return 1
}
validate_rate() {
    [[ "$1" =~ ^[0-9]+$ ]] && [ "$1" -le 100000 ] && return 0
    warn "Enter a whole number (0 disables the limiter)."; return 1
}
validate_bool() { [ "$1" = true ] || [ "$1" = false ] && return 0; warn "Enter true or false."; return 1; }
validate_password() {
    [ "${#1}" -ge 16 ] && return 0
    warn "Use at least 16 characters (or leave empty to generate one)."; return 1
}

# ---------- system ----------
# shellcheck disable=SC2034  # OS_VERSION_CODENAME is read by install.sh
OS_ID=""; OS_LIKE=""; OS_VERSION_CODENAME=""
detect_os() {
    [ -r /etc/os-release ] || die "Cannot detect the operating system (/etc/os-release is missing)."
    # shellcheck disable=SC1091
    . /etc/os-release
    # shellcheck disable=SC2034  # OS_VERSION_CODENAME is read by install.sh
    OS_ID="${ID:-}"; OS_LIKE="${ID_LIKE:-}"; OS_VERSION_CODENAME="${UBUNTU_CODENAME:-${VERSION_CODENAME:-}}"
}
os_family() {  # echoes debian | rhel | unsupported
    case " $OS_ID $OS_LIKE " in
        *" debian "*|*" ubuntu "*) echo debian ;;
        *" rhel "*|*" fedora "*|*" centos "*) echo rhel ;;
        *) echo unsupported ;;
    esac
}

port_in_use() { ss -ltn 2>/dev/null | awk '{print $4}' | grep -Eq "[:.]$1\$"; }

public_ipv4() { curl -4 -fsS --max-time 8 https://api.ipify.org 2>/dev/null || true; }
