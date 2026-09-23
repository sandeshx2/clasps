#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERSION="$(node -p "require('${ROOT_DIR}/manifest.json').version")"
STAGING_DIR="$(mktemp -d)"
ARCHIVE="${ROOT_DIR}/dist/dwx-firefox-v${VERSION}.zip"

cleanup() {
  rm -rf "${STAGING_DIR}"
}
trap cleanup EXIT

mkdir -p "${STAGING_DIR}/icons" "${ROOT_DIR}/dist"

# Firefox uses an event-page background script rather than Chromium's
# service-worker background. The shared background.js feature-detects the
# available clipboard implementation in either environment.
jq '(.background) = {"scripts": ["command.js", "background.js"]} | (.permissions) |= map(select(. != "offscreen"))' \
  "${ROOT_DIR}/manifest.json" > "${STAGING_DIR}/manifest.json"

for file in \
  background.js \
  command.js \
  error-popup.css \
  error-popup.html \
  error-popup.js \
  LICENSE \
  options.css \
  options.html \
  options.js \
  README.md
do
  cp "${ROOT_DIR}/${file}" "${STAGING_DIR}/${file}"
done

for icon in icon-16.png icon-32.png icon-48.png icon-128.png; do
  cp "${ROOT_DIR}/icons/${icon}" "${STAGING_DIR}/icons/${icon}"
done

rm -f "${ARCHIVE}"
(cd "${STAGING_DIR}" && zip -qr "${ARCHIVE}" .)
printf 'Created %s\n' "${ARCHIVE}"
