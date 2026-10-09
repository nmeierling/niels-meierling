#!/usr/bin/env bash
#
# Sync this website to an FTP server.
#
# Host, user and password are asked for interactively and never written to disk,
# so this script is safe to keep in a public repository.
#
# Usage:
#   ./deploy.sh              upload new and changed files
#   ./deploy.sh ftp://user@host[:port]/remote/dir
#                            same, with host, user and remote directory taken from the URL
#   ./deploy.sh --dry-run    only show what would be uploaded
#   ./deploy.sh --delete     also delete remote files that no longer exist locally (lftp only)
#   ./deploy.sh --list       show the server's top-level folders and the remote directory
#
# The remote directory must already exist; it is never created, so a wrong path fails loudly.
#
# Uses lftp when installed (real sync: only changed files, optional delete).
# Without lftp it falls back to curl and uploads every file each time.
# Install lftp on macOS with:  brew install lftp

set -euo pipefail

cd "$(dirname "$0")"

# Never upload these (relative paths / basenames). projects/ holds the unprocessed screenshots.
EXCLUDES=(
    ".git/"
    ".claude/"
    "projects/"
    ".DS_Store"
    ".gitignore"
    "README.md"
    "*.sh"
)

DRY_RUN=false
DELETE=false
LIST=false
FTP_URL=""
for arg in "$@"; do
    case "$arg" in
        --dry-run) DRY_RUN=true ;;
        --delete) DELETE=true ;;
        --list) LIST=true ;;
        -h|--help) sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
        -*) echo "Unknown option: $arg" >&2; exit 1 ;;
        *) FTP_URL=$arg ;;
    esac
done

# --- credentials ------------------------------------------------------------

DEFAULT_REMOTE_DIR=/domains/nielsmeierling.de/public_html

# decode %XX escapes (backslashes are protected so printf only expands the escapes we add)
urldecode() { local s=${1//\\/\\\\}; printf '%b' "${s//%/\\x}"; }

[[ -n "$FTP_URL" ]] || read -r -p "FTP host or URL (ftp://user@host/remote/dir): " FTP_URL

# Split [scheme://][user[:password]@]host[:port][/path]; parts not given are asked for below
FTP_USER="" FTP_PASS="" FTP_PORT="" REMOTE_DIR=""
is_url=false
[[ "$FTP_URL" == *://* || "$FTP_URL" == *@* ]] && is_url=true
rest=${FTP_URL#*://}
hostport=${rest%%/*}
[[ "$rest" == */* ]] && REMOTE_DIR=$(urldecode "/${rest#*/}")
if [[ "$hostport" == *@* ]]; then
    userinfo=${hostport%@*}
    hostport=${hostport##*@}
    FTP_USER=$(urldecode "${userinfo%%:*}")
    [[ "$userinfo" == *:* ]] && FTP_PASS=$(urldecode "${userinfo#*:}")
fi
FTP_HOST=$hostport
if [[ "$hostport" =~ ^([^:]+):([0-9]+)$ ]]; then
    FTP_HOST=${BASH_REMATCH[1]}
    FTP_PORT=${BASH_REMATCH[2]}
fi
[[ "$REMOTE_DIR" == "/" ]] && REMOTE_DIR=""

[[ -n "$FTP_PORT" ]] || $is_url || read -r -p "Port [21]: " FTP_PORT
[[ -n "$FTP_USER" ]] || read -r -p "Username: " FTP_USER
if [[ -z "$FTP_PASS" ]]; then
    read -r -s -p "Password${FTP_USER:+ for $FTP_USER}: " FTP_PASS
    echo
fi
[[ -n "$REMOTE_DIR" ]] || read -r -p "Remote directory [$DEFAULT_REMOTE_DIR]: " REMOTE_DIR
read -r -p "Require encrypted connection (FTPS)? [Y/n]: " USE_TLS

FTP_PORT=${FTP_PORT:-21}
REMOTE_DIR=${REMOTE_DIR:-$DEFAULT_REMOTE_DIR}
REMOTE_DIR="/${REMOTE_DIR#/}"   # leading slash
REMOTE_DIR="${REMOTE_DIR%/}/"   # exactly one trailing slash
[[ "$USE_TLS" =~ ^[Nn] ]] && USE_TLS=false || USE_TLS=true

# The certificate may be issued for another name than the one we connect to (never for a bare IP,
# and shared hosts use their own domain). Ask which name it must be valid for and check that with
# openssl; lftp's own name match is only skipped when the two differ.
CERT_NAME=""
if $USE_TLS; then
    read -r -p "Name the server certificate must be valid for [hstgr.io]: " CERT_NAME
    CERT_NAME=${CERT_NAME:-hstgr.io}
fi

if [[ -z "$FTP_HOST" || -z "$FTP_USER" || -z "$FTP_PASS" ]]; then
    echo "Host, username and password are required." >&2
    exit 1
fi

$USE_TLS || echo "Warning: password and files will be sent unencrypted."

# true if name $1 is covered by certificate name $2 (exact, or one label under a *.wildcard)
name_matches() {
    [[ "$1" == "$2" ]] && return 0
    [[ "$2" == '*.'* ]] || return 1
    local domain=${2#*.}
    [[ "$1" == *".$domain" && "${1%%.*}.$domain" == "$1" ]]
}

# Works with both OpenSSL and macOS' LibreSSL. LibreSSL lacks -verify_hostname and exits 0
# even when the chain is untrusted, so check the reported verify result and match names here.
check_certificate() {
    local out pem names name
    command -v openssl >/dev/null 2>&1 || { echo "openssl is required to check the certificate." >&2; return 1; }
    out=$(echo | openssl s_client -starttls ftp -connect "$FTP_HOST:$FTP_PORT" 2>&1) || true
    if ! grep -q "Verify return code" <<<"$out"; then
        echo "Could not open an encrypted connection to $FTP_HOST:$FTP_PORT:" >&2
        grep -iE "error|refused|unknown|timed out|no such" <<<"$out" | head -2 >&2
        return 1
    fi
    if ! grep -q "Verify return code: 0 (ok)" <<<"$out"; then
        echo "The server's certificate is not trusted:" >&2
        grep -E "Verify return code|verify error" <<<"$out" | head -2 >&2
        return 1
    fi
    pem=$(openssl x509 2>/dev/null <<<"$out") || { echo "Could not read the server's certificate." >&2; return 1; }
    names=$(openssl x509 -noout -text 2>/dev/null <<<"$pem" | grep -o 'DNS:[^,[:space:]]*' | sed 's/^DNS://')
    for name in $names; do
        name_matches "$CERT_NAME" "$name" && return 0
    done
    echo "The server's certificate is not valid for '$CERT_NAME' (it covers: $(echo $names))." >&2
    return 1
}

if [[ -n "$CERT_NAME" ]]; then
    check_certificate || { echo "Aborting." >&2; exit 1; }
    echo "Certificate is valid for $CERT_NAME."
fi

$DRY_RUN && echo "Dry run: nothing will be changed on the server."
echo

# --- lftp: real mirror ------------------------------------------------------

if command -v lftp >/dev/null 2>&1; then
    # built as a string for lftp's own parser (patterns contain no quotes)
    mirror_opts="--reverse --verbose --parallel=4"
    $DRY_RUN && mirror_opts+=" --dry-run"
    $DELETE && mirror_opts+=" --delete"
    for pattern in "${EXCLUDES[@]}"; do
        mirror_opts+=" --exclude-glob \"$pattern\""
    done

    if $LIST; then
        commands="set cmd:fail-exit no
echo \"== / (login directory)\"
cls -1F /
echo
echo \"== $REMOTE_DIR\"
cls -1F \"$REMOTE_DIR\""
    else
        commands="cd \"$REMOTE_DIR\"
mirror $mirror_opts . \"$REMOTE_DIR\""
    fi

    # Password goes through the environment, not the command line (not visible in `ps`)
    export LFTP_PASSWORD="$FTP_PASS"
    if ! lftp --env-password -u "$FTP_USER" -p "$FTP_PORT" "$FTP_HOST" <<EOF
set cmd:fail-exit yes
set ftp:ssl-allow yes
set ftp:ssl-force $USE_TLS
set ftp:ssl-protect-data $USE_TLS
set ssl:check-hostname $([[ -n "$CERT_NAME" && "$CERT_NAME" != "$FTP_HOST" ]] && echo no || echo yes)
set net:max-retries 2
set net:timeout 20
$commands
bye
EOF
    then
        echo "Failed. If the remote directory is wrong, check the server's folders with ./deploy.sh --list" >&2
        exit 1
    fi
    unset LFTP_PASSWORD
    $LIST || echo "Done."
    exit 0
fi

# --- curl fallback: upload everything ---------------------------------------

echo "lftp not found, falling back to curl (uploads all files; install lftp for real syncing)."
$DELETE && echo "Note: --delete needs lftp and is ignored."

find_args=(. -type f)
for pattern in "${EXCLUDES[@]}"; do
    if [[ "$pattern" == */ ]]; then
        find_args+=(-not -path "./${pattern}*")
    else
        find_args+=(-not -name "$pattern")
    fi
done

files=()
while IFS= read -r -d '' f; do
    files+=("${f#./}")
done < <(find "${find_args[@]}" -print0 | sort -z)

if [[ ${#files[@]} -eq 0 ]]; then
    echo "Nothing to upload." >&2
    exit 1
fi

# Credentials go to curl through a config on stdin, not the command line
escape() { local s=${1//\\/\\\\}; printf '%s' "${s//\"/\\\"}"; }
curl_config="user = \"$(escape "$FTP_USER"):$(escape "$FTP_PASS")\""
curl_opts=(--silent --show-error --fail --ssl)
$USE_TLS && curl_opts=(--silent --show-error --fail --ssl-reqd)

# curl can connect to the IP while verifying the certificate against the expected name
url_host=$FTP_HOST
if [[ -n "$CERT_NAME" && "$CERT_NAME" != "$FTP_HOST" ]]; then
    url_host=$CERT_NAME
    curl_opts+=(--connect-to "$CERT_NAME:$FTP_PORT:$FTP_HOST:$FTP_PORT")
fi
# %2F makes the path absolute, like lftp (curl paths are otherwise relative to the login directory)
base_url="ftp://$url_host:$FTP_PORT/%2F${REMOTE_DIR#/}"

ftp_list() { printf '%s\n' "$curl_config" | curl "${curl_opts[@]}" --config - --list-only "$1"; }

if $LIST; then
    echo "== / (login directory)"
    ftp_list "ftp://$url_host:$FTP_PORT/%2F" || true
    echo
    echo "== $REMOTE_DIR"
    ftp_list "$base_url" || true
    exit 0
fi

if ! ftp_list "$base_url" >/dev/null; then
    echo "Remote directory $REMOTE_DIR does not exist (see ./deploy.sh --list). Aborting." >&2
    exit 1
fi

if $DRY_RUN; then
    printf 'would upload: %s\n' "${files[@]}"
    echo "${#files[@]} files."
    exit 0
fi

count=0
for f in "${files[@]}"; do
    path=$(printf '%s' "$f" | sed 's/ /%20/g')
    printf 'uploading %s\n' "$f"
    printf '%s\n' "$curl_config" | curl "${curl_opts[@]}" --config - --ftp-create-dirs \
        --upload-file "$f" "$base_url$path"
    count=$((count + 1))
done
echo "Done, $count files uploaded."
