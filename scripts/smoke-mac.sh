#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.cargo/bin:$PATH"
tools="$HOME/.local/share/vert-enhanced/engines/bin"
mkdir -p work/fixtures
swift native/Fixtures.swift work/fixtures
"$tools/pandoc" 'work/fixtures/中文 文档.md' -o 'work/fixtures/中文 文档.docx'
"$tools/pandoc" work/fixtures/with-image.md --resource-path=work/fixtures -o work/fixtures/with-image.docx
"$tools/pandoc" 'work/fixtures/中文 文档.md' -o 'work/fixtures/中文 演示.pptx'
"$tools/ffmpeg" -hide_banner -loglevel error -f lavfi -i sine=frequency=440:duration=1 -y work/fixtures/tone.wav
"$tools/ffmpeg" -hide_banner -loglevel error -f lavfi -i color=c=blue:s=320x240:d=1 -f lavfi -i sine=frequency=440:duration=1 -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest -y work/fixtures/video.mp4
"$tools/python" native/AdvancedFixtures.py
"$tools/python" tests/test_advanced_tools.py
cargo test --manifest-path src-tauri/Cargo.toml installed_engines_convert_real_fixtures -- --ignored --nocapture
