#!/bin/sh
# VERT Desktop uninstaller
# https://vert-desktop.github.io/vert-desktop/uninstall.sh
#
#   curl -fsSL https://vert-desktop.github.io/vert-desktop/uninstall.sh | sh
set -eu

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

uninstall_macos() {
  if command -v brew >/dev/null 2>&1 && brew list --cask vert-desktop >/dev/null 2>&1; then
    info "Removing VERT Desktop (Homebrew)"
    brew uninstall --cask vert-desktop
  else
    fail "VERT Desktop does not appear to be installed via Homebrew"
  fi
}

uninstall_linux() {
  bindir="$HOME/.local/bin"
  appimage="$bindir/vert-desktop.AppImage"

  if command -v dpkg >/dev/null 2>&1 && dpkg -s vert-desktop >/dev/null 2>&1; then
    info "Removing VERT Desktop (.deb package)"
    as_root apt remove -y vert-desktop
  elif [ -f "$appimage" ]; then
    info "Removing VERT Desktop (.AppImage)"
    rm -f "$appimage"
    rm -f "$HOME/.local/share/applications/vert-desktop.desktop"
  else
    fail "VERT Desktop installation not found"
  fi
}

os="$(uname -s)"
case "$os" in
  Darwin) uninstall_macos ;;
  Linux) uninstall_linux ;;
  *) fail "unsupported OS: $os" ;;
esac

info "VERT Desktop uninstalled."
