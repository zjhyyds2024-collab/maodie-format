Upstream: https://github.com/HRuiCcc/music-geshizhuanhuan
Commit: 28f4ed0724f85978405d961c0e955266eed383ee
License: MIT (see LICENSE)

Vendored decoder primitives and metadata helper. The upstream web server and CLI are not launched or bundled. VERT uses its existing bounded streaming NCM reader.
Local changes: KGM header/version checks; KWM rejects unverifiable key candidates and normalizes verified padding without damaging M4A box lengths; QMC database URI encoding, read-only bounded queries and schema checks; MP3 tagging preserves existing tags; metadata failures are reported. NCM cover import uses VERT validation and atomic output replacement. QMC1/5/7 aliases use the same validated parsing route.
Kugou asset Git blob: c7db7e52daf24459652644dc2365f3498c411b9a (verified before use).
