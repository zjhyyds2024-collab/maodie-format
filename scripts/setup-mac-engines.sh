#!/bin/bash
set -euo pipefail
if [[ "$(uname -m)" != arm64 ]]; then echo 'This build requires an Apple Silicon Mac.'; exit 1; fi
engine_root="$HOME/.local/share/vert-enhanced"
setup_tmp="$(mktemp -d -t vert-setup)"
trap 'rm -r "$setup_tmp"' EXIT
curl -fL --retry 3 https://micro.mamba.pm/api/micromamba/osx-arm64/latest -o "$setup_tmp/micromamba.tar.bz2"
tar -xjf "$setup_tmp/micromamba.tar.bz2" -C "$setup_tmp" bin/micromamba
action=create
if [[ -d "$engine_root/engines/conda-meta" ]]; then action=install; fi
"$setup_tmp/bin/micromamba" "$action" -y --no-rc -r "$engine_root/mamba" -p "$engine_root/engines" -c conda-forge ffmpeg imagemagick pandoc python=3.12 pip
source_root="$(cd "$(dirname "$0")/.." && pwd)"
"$engine_root/engines/bin/python" -m pip install -r "$source_root/docs/mac-python-lock.txt"
if [[ ! -f /Applications/LibreOffice.app/Contents/MacOS/soffice && ! -f "$engine_root/LibreOffice.app/Contents/MacOS/soffice" ]]; then
  echo 'Office conversion requires LibreOffice for Apple Silicon. Install it from https://www.libreoffice.org/download/download-libreoffice/ and reopen 耄耋格式.'
fi
