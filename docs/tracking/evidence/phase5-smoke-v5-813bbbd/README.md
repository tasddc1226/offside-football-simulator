# Candidate v5 smoke evidence — not a reference population

Source commit: `813bbbdc86ea8c4a907a6002e0a872d6ecab3688` (2026-09-05).
Ruleset/Legacy `1.1.0`, content pack `0.3.0`; no default-version activation.

Each policy uses the same 20 seeds per position (`0..19`) and requested lengths
`1 + (seedIndex mod 20)`: 80 careers, only four requesting 20 seasons.
Every row/archive/result hash matched between normal and accelerated execution.
These are two runs of the **same careers**, not 160 independent observations per policy.
The policies change several choices together and do not isolate one causal effect.

```sh
node tooling/scripts/legacy-population-node.mjs --verify \
  --ruleset-version 1.1.0 --legacy-version 1.1.0 --strategy random
node tooling/scripts/legacy-population-node.mjs --verify \
  --ruleset-version 1.1.0 --legacy-version 1.1.0 --strategy opportunity
```

Node `22.23.1`. Both accelerated bundles had SHA-256:
`ed8468129278d4bab1e6c15459a53502898b513035f500b0411ff001f971f1b1`.
The generator source is retained by the commit above; these files retain the
unmodified accelerated reports, not a runtime artifact or a retained bundle copy.
Their complete artifact checksums, provenance, rows and distinct IDs are in JSON.

| File | Raw file SHA-256 |
| --- | --- |
| [random.json](random.json) | `81b510cc2a039a533bc2842fa681ad7b59a3ba181e8ac7ddea846fa574ca9561` |
| [opportunity.json](opportunity.json) | `8e3cfafb2cec061e2cad3d81fc4dcf23a71d48cb574bf71cd8b20594308ca86f` |

| Policy | Mean | Maximum | 75+ | 80+ | 90+ | Mean career minutes share |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| random | 39.50 | 75 | 1/80 | 0/80 | 0/80 | 17.73% |
| opportunity | 45.39 | 83 | 2/80 | 1/80 | 0/80 | 28.89% |

Mean minutes share is the unweighted mean of each career's minutes/possibleMinutes,
not a pooled minute ratio. Zero-team-trophy subsets contain only four and three
careers, respectively; none reached 80. These tiny subsets cannot establish the
uncrowned target. No LEGEND or population balance acceptance is claimed.

Normal/accelerated wall times were 47.21s/9.71s (random) and 55.46s/5.32s
(opportunity). Processes ran at reduced CPU priority alongside CI; these timings
are neither performance gates nor gameplay duration measurements.

Do not relabel these `SMOKE_REPORT` files, resume them for a different policy, or
copy them into the content registry. The v5 publisher/runtime restriction remains.
