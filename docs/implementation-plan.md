# VERT Enhanced implementation plan

Approved scope: docs/superpowers/specs/2026-10-24-vert-enhanced-design.md.

1. Build environment: Rust, npm dependencies, isolated FFmpeg/ImageMagick runtime, local LibreOffice.
2. Native macOS helper: PDF merge/split/render/text and Vision OCR, per-page progress.
3. Backend: validated conversion routing, capabilities, isolated jobs, cancellation, collision-safe saves.
4. UI: source-aware formats, Office conversions, PDF/OCR toolbox, ordered queues, saved output folder and real status.
5. Verification: engine smoke tests, backend integration against real fixtures, frontend tests/build and UI review.
6. Build separate VERT Enhanced.app and record local runtime requirements and tested format routes.

Implementation adjustment: use PDFKit and Vision instead of Poppler/Tesseract on this Mac; no cloud OCR. Existing app's FFmpeg/ImageMagick link to missing Homebrew libraries, so supply isolated replacement engines. Full PDF-to-Word/table reconstruction remains outside the first release.
