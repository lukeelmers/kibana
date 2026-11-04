#!/usr/bin/env bash
# Zips this directory into nightshift_app-<version>.zip for upload to Fleet, with the version read
# from manifest.yml. Entries are prefixed with nightshift_app-<version>/, which is what Fleet
# expects of an uploaded package.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
version="$(sed -n 's/^version: //p' "$here/manifest.yml")"
name="nightshift_app-$version"
staging="$(mktemp -d)"
trap 'rm -rf "$staging"' EXIT

mkdir "$staging/$name"
cp -R "$here/manifest.yml" "$here/docs" "$here/kibana" "$staging/$name/"
rm -f "$here/$name.zip"
(cd "$staging" && zip -qr "$here/$name.zip" "$name")
echo "$here/$name.zip"
