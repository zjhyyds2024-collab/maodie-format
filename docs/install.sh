#!/bin/sh
# VERT Desktop installer
# https://vert-desktop.github.io/vert-desktop/install.sh
#
#   curl -fsSL https://vert-desktop.github.io/vert-desktop/install.sh | sh
set -eu

REPO="vert-desktop/vert-desktop"
API_URL="https://api.github.com/repos/${REPO}/releases/latest"

fail() {
  echo "error: $1" >&2
  exit 1
}

info() {
  echo "==> $1"
}

as_root() {
  if [ "$(id -u)" = "0" ]; then
    "$@"
  elif command -v sudo >/dev/null 2>&1; then
    sudo "$@"
  else
    fail "this step needs root privileges, but sudo is not available"
  fi
}

latest_asset_url() {
  # $1: extension to look for (e.g. "deb", "AppImage")
  curl -fsSL "$API_URL" | grep -oP '"browser_download_url":\s*"\K[^"]+\.'"$1"'(?=")' | head -n1
}

install_macos() {
  if command -v brew >/dev/null 2>&1; then
    info "Installing VERT Desktop via Homebrew"
    brew install --cask vert-desktop/tap/vert-desktop
  else
    fail "Homebrew not found. Install it from https://brew.sh, then re-run this script, or download the .dmg from https://github.com/${REPO}/releases/latest"
  fi
}

install_linux() {
  tmpdir="$(mktemp -d)"
  trap 'rm -rf "$tmpdir"' EXIT

  if command -v apt >/dev/null 2>&1; then
    info "Detected a Debian/Ubuntu system, installing the .deb package"
    url="$(latest_asset_url deb)"
    [ -n "$url" ] || fail "could not find a .deb asset in the latest release"
    curl -fsSL -o "$tmpdir/vert-desktop.deb" "$url"
    as_root apt install -y "$tmpdir/vert-desktop.deb"
    info "VERT Desktop installed. Launch it from your app menu, or run 'vert-desktop'."
  else
    info "Installing the .AppImage (universal Linux)"
    url="$(latest_asset_url AppImage)"
    [ -n "$url" ] || fail "could not find an .AppImage asset in the latest release"

    bindir="$HOME/.local/bin"
    mkdir -p "$bindir"
    target="$bindir/vert-desktop.AppImage"
    curl -fsSL -o "$target" "$url"
    chmod +x "$target"

    mkdir -p "$HOME/.local/share/applications"
    cat > "$HOME/.local/share/applications/vert-desktop.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=VERT Desktop
Comment=Privacy-first file converter
Exec=$target
Icon=vert-desktop
Categories=Utility;Graphics;AudioVideo;
Terminal=false
EOF

    info "VERT Desktop installed to $target"
    case ":$PATH:" in
      *":$bindir:"*) info "Launch it from your app menu, or run 'vert-desktop.AppImage'." ;;
      *) info "Launch it from your app menu, or run '$target' ($bindir is not on your PATH)." ;;
    esac
  fi
}

os="$(uname -s)"
case "$os" in
  Darwin) install_macos ;;
  Linux) install_linux ;;
  *) fail "unsupported OS: $os" ;;
esac
