#!/usr/bin/env bash
#
# Sync this website to an FTP server.
#
# Host, user and password are asked for interactively and never written to disk,
# so this script is safe to keep in a public repository.
#
# Usage:
#   ./deploy.sh              upload new and changed files
#   ./deploy.sh --dry-run    only show what would be uploaded
#   ./deploy.sh --delete     also delete remote files that no longer exist locally (lftp only)
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
for arg in "$@"; do
    case "$arg" in
        --dry-run) DRY_RUN=true ;;
        --delete) DELETE=true ;;
        -h|--help) sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
        *) echo "Unknown option: $arg" >&2; exit 1 ;;
    esac
done

# --- credentials ------------------------------------------------------------

read -r -p "FTP host (IP or hostname): " FTP_HOST
read -r -p "Port [21]: " FTP_PORT
read -r -p "Username: " FTP_USER
read -r -s -p "Password: " FTP_PASS
echo
read -r -p "Remote directory [/]: " REMOTE_DIR
read -r -p "Require encrypted connection (FTPS)? [Y/n]: " USE_TLS

FTP_PORT=${FTP_PORT:-21}
REMOTE_DIR=${REMOTE_DIR:-/}
REMOTE_DIR="/${REMOTE_DIR#/}"   # leading slash
REMOTE_DIR="${REMOTE_DIR%/}/"   # exactly one trailing slash
[[ "$USE_TLS" =~ ^[Nn] ]] && USE_TLS=false || USE_TLS=true

if [[ -z "$FTP_HOST" || -z "$FTP_USER" || -z "$FTP_PASS" ]]; then
    echo "Host, username and password are required." >&2
    exit 1
fi

$USE_TLS || echo "Warning: password and files will be sent unencrypted."
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

    # Password goes through the environment, not the command line (not visible in `ps`)
    export LFTP_PASSWORD="$FTP_PASS"
    lftp --env-password -u "$FTP_USER" -p "$FTP_PORT" "$FTP_HOST" <<EOF
set cmd:fail-exit yes
set ftp:ssl-allow yes
set ftp:ssl-force $USE_TLS
set ftp:ssl-protect-data $USE_TLS
set net:max-retries 2
set net:timeout 20
mkdir -p -f "$REMOTE_DIR"
mirror $mirror_opts . "$REMOTE_DIR"
bye
EOF
    unset LFTP_PASSWORD
    echo "Done."
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

if $DRY_RUN; then
    printf 'would upload: %s\n' "${files[@]}"
    echo "${#files[@]} files."
    exit 0
fi

# Credentials go to curl through a config on stdin, not the command line
escape() { local s=${1//\\/\\\\}; printf '%s' "${s//\"/\\\"}"; }
curl_config="user = \"$(escape "$FTP_USER"):$(escape "$FTP_PASS")\""
tls_opt=(--ssl)
$USE_TLS && tls_opt=(--ssl-reqd)

count=0
for f in "${files[@]}"; do
    path=$(printf '%s' "$f" | sed 's/ /%20/g')
    printf 'uploading %s\n' "$f"
    printf '%s\n' "$curl_config" | curl --silent --show-error --fail \
        --config - "${tls_opt[@]}" --ftp-create-dirs \
        --upload-file "$f" "ftp://$FTP_HOST:$FTP_PORT$REMOTE_DIR$path"
    count=$((count + 1))
done
echo "Done, $count files uploaded."
