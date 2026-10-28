#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.cargo/bin:$PATH"
mkdir -p src-tauri/native-bin
swiftc -O -target arm64-apple-macosx13.0 native/DocumentTools.swift -o src-tauri/native-bin/vert-document-tools -framework AppKit -framework PDFKit -framework Vision
npm ci
npm run tauri -- build --bundles app

codesign --force --deep --sign - 'src-tauri/target/release/bundle/macos/耄耋格式.app'
codesign --verify --deep --strict 'src-tauri/target/release/bundle/macos/耄耋格式.app'
