#!/usr/bin/env bash
# Fetches the DAPHNE revision that the grammar is checked against into
# .cache/daphne and prints that path.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
ref="$(cat "$root/conformance/DAPHNE_REF")"
dir="$root/.cache/daphne"

if [ "$(git -C "$dir" rev-parse HEAD 2>/dev/null || true)" != "$ref" ]; then
    rm -rf "$dir"
    git init --quiet "$dir"
    git -C "$dir" fetch --quiet --depth 1 https://github.com/daphne-eu/daphne "$ref"
    git -C "$dir" checkout --quiet FETCH_HEAD
fi
echo "$dir"
