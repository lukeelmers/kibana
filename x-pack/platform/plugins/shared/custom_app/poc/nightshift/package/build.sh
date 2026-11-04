#!/usr/bin/env bash
# Zips this directory into nightshift_app-0.1.0.zip for upload to Fleet. Entries are prefixed
# with nightshift_app-0.1.0/, which is what Fleet expects of an uploaded package.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
name="nightshift_app-0.1.0"
staging="$(mktemp -d)"
trap 'rm -rf "$staging"' EXIT

mkdir "$staging/$name"
cp -R "$here/manifest.yml" "$here/docs" "$here/kibana" "$staging/$name/"
rm -f "$here/$name.zip"
(cd "$staging" && zip -qr "$here/$name.zip" "$name")
echo "$here/$name.zip"
