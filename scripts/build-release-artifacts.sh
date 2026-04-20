#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DIST_DIR="${REPO_ROOT}/dist"

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required to build release artifacts" >&2
  exit 1
fi

VERSION="$(jq -r '.version' "${REPO_ROOT}/manifest.json")"
PLUGIN_ID="$(jq -r '.applications.zotero.id' "${REPO_ROOT}/manifest.json")"
MIN_VERSION="$(jq -r '.applications.zotero.strict_min_version' "${REPO_ROOT}/manifest.json")"
MAX_VERSION="$(jq -r '.applications.zotero.strict_max_version' "${REPO_ROOT}/manifest.json")"
REPOSITORY="${GITHUB_REPOSITORY:-cpsimpson/zotero-todoist-bridge}"
TAG="v${VERSION}"
XPI_NAME="zotero-todoist-bridge-${VERSION}.xpi"
XPI_PATH="${DIST_DIR}/${XPI_NAME}"
UPDATE_LINK="https://github.com/${REPOSITORY}/releases/download/${TAG}/${XPI_NAME}"

mkdir -p "${DIST_DIR}"
rm -f "${DIST_DIR}"/*.xpi "${DIST_DIR}/updates.json"

cd "${REPO_ROOT}"
zip -r "${XPI_PATH}" \
  manifest.json \
  bootstrap.js \
  zotero-todoist-bridge.js \
  preferences.xhtml \
  preferences.js \
  locale

if command -v sha256sum >/dev/null 2>&1; then
  XPI_HASH="$(sha256sum "${XPI_PATH}" | awk '{print $1}')"
else
  XPI_HASH="$(shasum -a 256 "${XPI_PATH}" | awk '{print $1}')"
fi

cat > "${DIST_DIR}/updates.json" <<EOF
{
  "addons": {
    "${PLUGIN_ID}": {
      "updates": [
        {
          "version": "${VERSION}",
          "update_link": "${UPDATE_LINK}",
          "update_hash": "sha256:${XPI_HASH}",
          "applications": {
            "zotero": {
              "strict_min_version": "${MIN_VERSION}",
              "strict_max_version": "${MAX_VERSION}"
            }
          }
        }
      ]
    }
  }
}
EOF

echo "version=${VERSION}"
echo "tag=${TAG}"
echo "xpi=${XPI_NAME}"
