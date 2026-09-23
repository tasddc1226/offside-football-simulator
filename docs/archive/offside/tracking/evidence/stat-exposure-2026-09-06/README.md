# 1.1 stat-exposure mixed pilot — 2026-09-06

This is `diagnostic_only` non-publishing evidence after the 1.1-only stat-exposure fix. It does not
activate a ruleset, register a reference population, relax an acceptance range, or authorize
the 40,000-career run.

## Frozen inputs

- source HEAD at launch: `d2821ba90c77886cb414a29b088e05fe54ee31b2`
- Node: `v22.22.1`
- generator bundle SHA-256: `b1e951c6965117d5bbb3e75223893e2e9328938472e0a5ae141d3a8c7becfeb5`
- ruleset: `1.1.0`, checksum `ea9becea77c9ef5941e4e1a066e6ae21c036eb1bca42252cd0911d50e2f1745e`
- content pack: `0.3.0`, checksum `15bafeb76059b1dd4d2f381eacda61cf837877be16b07144597aac3cd8758a79`
- Legacy policy: `1.1.0`, checksum `65f999560d714cff24741921f8fff7d04fd5a2e0b84283eb1a2f72acfe4c8e69`
- choice policy: seed-fixed `ui-mixed-v1`
- seeds: `0..199` per position; requested seasons: `1 + (seedIndex mod 20)`

The 80-career normal/accelerated parity replay matched every row. Normal runtime was 41.86s,
accelerated runtime 6.03s (6.94x). The normal and accelerated report SHA-256 values were
`16a7c5789b297cbce330530d27aac417fd3b31d2f077fdc847115b19f2c2dd35` and
`a3d1c6978691946f55af13090d83b93057b9e66205be36cc780b85f2859f8a43` respectively; report
container hashes differ because provenance records the execution path, while verified rows match.

## Mixed 800 result

Raw diagnostic report SHA-256:
`282ee125cfe029396dcb21c440ca143feee49f1a59efd32cc014c3a432b1f282`.

| Measure | Result | Existing acceptance range | Status |
| --- | ---: | ---: | --- |
| LEGEND | 4/800 (0.50%) | 1.5–2.5% | below |
| ICON | 80/800 (10.00%) | 6–10% | at upper bound |
| REMEMBERED | 256/800 (32.00%) | 25–35% | inside |
| score >= 80 | 53/800 (6.63%) | 8–12% | below |
| untitled score >= 80 | 0/29 | 2–4%, denominator >= 1,000 | denominator and qualification evidence insufficient |

Overall mean score was 45.71. Mean career minutes share was 25.91%, mean peak OVR 66.59,
mean 40%-minutes active seasons 2.65, and mean established-contribution seasons 1.83.

| Position | Mean | Max | ICON | LEGEND | >=80 | Minutes share | Five-axis means (A/C/L/R/N) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| GK | 45.03 | 92 | 17 | 3 | 14 | 21.58% | 48.78 / 47.61 / 22.08 / 70.35 / 30.68 |
| DF | 52.37 | 87 | 31 | 0 | 17 | 34.68% | 57.07 / 49.59 / 33.22 / 71.29 / 47.70 |
| MF | 40.21 | 86 | 16 | 0 | 9 | 20.90% | 38.16 / 42.83 / 22.63 / 69.99 / 27.63 |
| FW | 45.24 | 91 | 16 | 1 | 13 | 26.47% | 47.15 / 43.58 / 25.50 / 72.44 / 36.53 |

The 1–5, 6–15, and 16–20 season cohorts averaged 24.96, 47.49, and 62.90. Their >=80 counts
were 0/200, 18/400, and 35/200; all four LEGEND careers were in the 16–20 cohort.
Opportunity careers averaged 49.38 with 46 >=80 and four LEGEND results; random careers averaged
41.87 with seven >=80 and no LEGEND result. The fix therefore changes real recorded statistics,
but this pilot still misses the LEGEND, >=80, and untitled gates and retains a substantial DF/MF
gap. These position-wide means mix different generated exposure, performance, and career histories;
they do not show that equal-quality raw evidence is scored unfairly. The 29 untitled rows are also
dominated by short careers, so `0/29` does not establish that a sustained untitled path is impossible.
No score coefficient was adjusted after observing these results, and no 40,000 run was started.

## Raw report locations

These are temporary local evidence paths, not checked-in archives:

- parity normal: `/var/folders/2m/3c9wkp7j7tvfp9sndjn_y5qw0000gn/T/offside-population-verify-gxL9du/normal.json`
- parity accelerated: `/var/folders/2m/3c9wkp7j7tvfp9sndjn_y5qw0000gn/T/offside-population-verify-gxL9du/accelerated.json`
- mixed 800: `/tmp/offside-stat-exposure-pilot.wbFTO9/mixed.json`

The reproducible diagnostic inputs and output are permanently retained beside this README:

- `raw/mixed-800.json.gz` (uncompressed SHA-256
  `282ee125cfe029396dcb21c440ca143feee49f1a59efd32cc014c3a432b1f282`)
- `raw/legacy-population.mjs.gz` (uncompressed generator SHA-256
  `b1e951c6965117d5bbb3e75223893e2e9328938472e0a5ae141d3a8c7becfeb5`)
- `raw/bundle-manifest.json`
- `checksums.sha256` for the checked-in compressed files
