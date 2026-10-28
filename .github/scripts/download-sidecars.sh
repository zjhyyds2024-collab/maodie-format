#!/usr/bin/env bash
# Downloads FFmpeg, ImageMagick, and Pandoc binaries for the given target triple.
# Environment variables: FFMPEG_URL, MAGICK_URL, PANDOC_URL
set -euo pipefail

TARGET="${1:?target triple required}"
BINDIR="src-tauri/binaries"
mkdir -p "${BINDIR}"

TMP=$(mktemp -d)
trap 'rm -rf "${TMP}"' EXIT

echo "=== Downloading sidecars for ${TARGET} ==="

# ── FFmpeg ────────────────────────────────────────────────────────────────────
if [[ "${TARGET}" == *linux* ]]; then
  curl -sL "${FFMPEG_URL}" -o "${TMP}/ffmpeg.tar.xz"
  tar -xJf "${TMP}/ffmpeg.tar.xz" -C "${TMP}"
  find "${TMP}" -name "ffmpeg" -type f -exec cp {} "${BINDIR}/vert-desktop-ffmpeg-${TARGET}" \;
elif [[ "${TARGET}" == *darwin* ]]; then
  curl -sL "${FFMPEG_URL}" -o "${TMP}/ffmpeg.zip"
  unzip -q "${TMP}/ffmpeg.zip" -d "${TMP}/ffmpeg"
  find "${TMP}/ffmpeg" -name "ffmpeg" -type f -exec cp {} "${BINDIR}/vert-desktop-ffmpeg-${TARGET}" \;
fi
chmod +x "${BINDIR}/vert-desktop-ffmpeg-${TARGET}"
echo "  ✓ ffmpeg"

# ── ImageMagick ───────────────────────────────────────────────────────────────
if [[ "${TARGET}" == *linux* ]]; then
  curl -sL "${MAGICK_URL}" -o "${BINDIR}/vert-desktop-magick-${TARGET}"
  chmod +x "${BINDIR}/vert-desktop-magick-${TARGET}"
elif [[ "${TARGET}" == *darwin* ]]; then
  curl -sL "${MAGICK_URL}" -o "${TMP}/magick.tar.gz"
  tar -xzf "${TMP}/magick.tar.gz" -C "${TMP}"
  find "${TMP}" -name "magick" -type f -exec cp {} "${BINDIR}/vert-desktop-magick-${TARGET}" \;
  chmod +x "${BINDIR}/vert-desktop-magick-${TARGET}"
fi
echo "  ✓ magick"

# ── Pandoc ────────────────────────────────────────────────────────────────────
if [[ "${TARGET}" == *linux* ]]; then
  curl -sL "${PANDOC_URL}" -o "${TMP}/pandoc.tar.gz"
  tar -xzf "${TMP}/pandoc.tar.gz" -C "${TMP}"
  find "${TMP}" -name "pandoc" -type f -exec cp {} "${BINDIR}/vert-desktop-pandoc-${TARGET}" \;
elif [[ "${TARGET}" == *darwin* ]]; then
  curl -sL "${PANDOC_URL}" -o "${TMP}/pandoc.zip"
  unzip -q "${TMP}/pandoc.zip" -d "${TMP}/pandoc"
  find "${TMP}/pandoc" -name "pandoc" -type f -exec cp {} "${BINDIR}/vert-desktop-pandoc-${TARGET}" \;
fi
chmod +x "${BINDIR}/vert-desktop-pandoc-${TARGET}"
echo "  ✓ pandoc"

echo "=== Done: $(ls -1 ${BINDIR}/) ==="
