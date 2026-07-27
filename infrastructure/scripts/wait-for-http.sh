#!/usr/bin/env sh
set -eu
url="$1"
until wget -qO- "$url" >/dev/null 2>&1; do sleep 2; done
