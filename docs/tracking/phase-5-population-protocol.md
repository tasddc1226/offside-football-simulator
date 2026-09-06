# Phase 5 reference-population protocol

This is the offline, deterministic data-generation protocol for the Legacy Score
reference population. It is a reproducibility and data-integrity gate, not a
gameplay path, a model of real players, or a source of legal or eligibility claims.

## Target and status

The eventual publish target is 10,000 independently seeded careers in each of
`GK`, `DF`, `MF`, and `FW` (40,000 total). Requested lengths are stratified from
1 through 20 seasons: row `i` requests `1 + (i mod --seasons)` seasons. Realized
seasons may be shorter when the engine requires retirement.

Distribution observations use all 40,000 rows, not a post-selected 20-season subset.
On 2026-09-06 the user approved the predeclared band, 80+, and zero-team-trophy
proportions as operational observation targets rather than hard merge gates. Storage
compatibility, equal-quality position fairness, attainable source-backed high-score
paths, and exact population provenance/count/seed integrity remain mandatory gates.

The retained baseline protocol is v2: ruleset `1.0.0`, registered content pack `0.3.0`,
protocol `phase5-population-2-registered-choices`, choice policy
`registered-hash-strata-v1`, and seed
`phase5-population:<position>:<zero-based-index>`.

The v2 40,000-career run is retained as engine stress/before-change evidence, **not
as a publishable player reference**. A later UI audit found that it sometimes
declines a KEEP proposal, while the actual screen only offers ACCEPT/confirmation.
Its commands are engine-valid, but this is an important player-policy mismatch.
No official reference population has been published. Original band goals remain
unchanged; interim smoke or parity output is not a balance pass.

The complete v2 run finished in 3,261,059 ms. Retained evidence and its exact frozen
generator are compressed under `evidence/phase5-baseline-v2/`, with checksums and
band counts in [manifest.json](evidence/phase5-baseline-v2/manifest.json). Across
40,000 runs there were two ICON results, zero LEGEND, and 7,687 REMEMBERED.
These files are deliberately outside the runtime content registry.

The preserved legacy generator contract is v3: `phase5-population-3-ui-choices`, choice policy
`ui-action-strata-v1`. KEEP always accepts, other role choices preserve the previous
policy. It accepts `--legacy-version 1.0.0|1.1.0` (default 1.0.0) and pins the
selected definition checksum. Before the 2026-09-06 approval, Version 1.1.0 was an
unactivated candidate. The original v3 population ID is retained for compatibility.
Rows also retain the five components, minutes, possible minutes, peak OVR,
trophies and eligible endings for diagnosis.

Ruleset 1.1 or informed-strategy runs now use the candidate protocol
`phase5-population-5-policy-isolation`. Their IDs include the choice policy and
canonical SHA-256 of the complete provenance: generator, artifact checksums,
versions, choice/seed/length policies, requested count and scoring policy. Random,
opportunity and mixed reports therefore cannot alias one another or a report from
a different source bundle. This identity isolation is now also the registered v5
contract for exactly Legacy `1.1.0`, ruleset `1.1.0`, pack `0.3.0`, and
`ui-mixed-v1`. Legacy v3 remains a separate supported tuple. Old checkpoints and
diagnostic rows are not relabelled or resumed as v5.

The predeclared final candidate policy is `mixed`: a seed-fixed 50/50 split between
`ui-action-strata-v1` behavior and the public-information opportunity policy. This
is a synthetic reference choice mix, not an estimate of player behavior. Candidate
rows also retain recorded career tag IDs, 40%-minutes active-season count, and
versioned sustained-contribution-season count for audit. These fields never feed
choices or simulation. The 2026-09-06 800-career pilot missed the LEGEND and 80+
targets. Those misses remain disclosed observations, not reasons to tune scores to a
desired histogram. After the 2026-09-06 decision, the final 40,000-career run may be
published once the mandatory integrity and path gates pass.
The frozen candidate's 80-career normal/accelerated parity check matched every row
(bundle `3e4d1df24bd74f27c107d67e8e2ba8762ae58920d422edb4bfdc1ab5d07ee09b`,
7.62x observed speedup). This validates execution equivalence, not distribution
acceptance.

### Published v5 run — 2026-09-06

The stat-exposure-corrected source was frozen as generator bundle
`b1e951c6965117d5bbb3e75223893e2e9328938472e0a5ae141d3a8c7becfeb5`. A fresh
80-career normal/accelerated comparison matched every row (6.94x observed speedup),
then the same bundle generated exactly 10,000 rows per position in 2,563,504 ms on
Node 22.22.1. No earlier checkpoint or pilot row was resumed.

The final payload hash is
`7b7b657d80b8d0c329e51b1335ead44d5ba5c0dfd7a31628124849aba8332878` and the compact
population checksum is
`0d5c8a1acd5e08b6f44d0960de42d95c1200f6b431d1ce326e1ae4007c8577a7`.
The immutable runtime population, manifest, compressed raw evidence, and compressed
generator are stored under `packages/content/legacy/1.1.0/`. The publisher validates
every seed, requested length, score/band, five-axis calculation, hash shape, and the
seed-derived per-career mixed strategy before the immutable write. `content:validate`
checks the registered tuple, compact artifact, content bindings, and retained gzip
checksums without regenerating careers.

The earlier v1 runner used fixed fixture outcomes and content pack `0.1.0`. That
run is retired. Its timings and outputs are not official evidence and must not be
combined with v2 checkpoints or used as the reference population.

## v2 career and choice policy

Every career uses the real domain command path: creation, draft confirmation, youth
progression, `START_SEASON`, content-backed `ADVANCE`, pending resolution,
`SETTLE_SEASON`, and `RETIRE`. Archives and results are built with
`createCareerArchiveCore` and `createLegacyResult`; no score, season summary,
ending, or result is copied from a fixture.

The seed deterministically selects a compatible archetype, background, gender,
preferred foot, simulation mode, training focus, registered event/chapter choices,
eligible career-event choices, market/role handling, and terminal `RETIRE` versus
`COACH_EPILOGUE`.

`tooling/scripts/legacy-population-choices.ts` uses
`selectEligibleEvents` and `selectChapterCandidates` for `ADVANCE`, resolves
pending events only through the matching pack definition, and copies the selected
choice's exact outcomes, effects, tags, rehabilitation plan, call-up, and chapter
rating delta. It never invents an event, choice, or outcome. Role, market,
loan-return, and settlement handling remain generator policy because they are not
content-pack choices. Cross-group position changes are deliberately declined to
preserve the four position strata. Negotiation is not sampled in v2.

All sampling is a deterministic SHA-256 index over `(seed, policy key)`. This is a
declared synthetic policy, not an actual-user or real-world player distribution.

## Commands

For a publishable full run, the accelerated launcher hashes and retains its exact
bundle and four position checkpoints in a persistent work directory:

```sh
node tooling/scripts/legacy-population-node.mjs \
  --work-dir /persistent/phase5-population-work \
  --count 10000 --seasons 20 \
  --ruleset-version 1.1.0 --legacy-version 1.1.0 --strategy mixed \
  --out artifacts/legacy-population.json
```

Use `--count 20 --seasons 20 --smoke` for a non-publishing smoke report. Counts
below 10,000 are rejected for normal publication and are written only as an
explicitly marked `SMOKE_REPORT`.
Direct `tsx tooling/scripts/legacy-population.ts` execution is for smoke/development
verification only: an unhashed worktree cannot be published as a pinned generator.

The optional `--shards-per-position 2` uses eight isolated jobs. Default is one
shard per position (four jobs); more workers are not assumed to be faster on a
busy machine. Shards must cover each seed exactly once. A failed child terminates
its sibling jobs. Old frozen bundles may only resume in their original unsharded
mode; never reuse a v2 work directory for a v3 run.

These are offline release-analysis tools, not a 40,000-career test run on every PR.
Publication validates the complete evidence once; CI keeps focused regression and
compact artifact integrity checks. Individual seed scores are not golden snapshots.

## Artifacts, checkpoints, and publication

The runner loads the registered ruleset and content pack and records the registry
manifest checksums returned by `loadRetirementArtifacts`. These are raw registry
artifact checksums, not hashes of parsed objects or runtime `Map` instances.

Checkpoint state is written after every 100 verified rows per position using a
temporary file followed by rename. Resume rejects mismatches in protocol, generator
bundle hash, policy checksum, versions, artifact checksums, count, requested-length
sequence, seed sequence, or canonical group hash. A failed simulation, invalid
snapshot, archive/result construction failure, or artifact mismatch aborts the run.

Publication requires all four groups to contain exactly the requested count and
refuses partial output. Provenance includes protocol, generator code hash, choice
policy, seed/length policies, versions, artifacts, policy checksum, count, and max
seasons. `populationHash` is the canonical SHA-256 of the payload before that
field is added. No smoke report is a reference population.

## v2 parity evidence

The valid v2 parity run completed 80 careers (20 per position, requested lengths 1
through 20). Normal wall time was **43.2665s**; accelerated wall time was
**5.7933s**, a **7.468×** speedup. Every row, archive hash, and result hash
matched exactly. Domain SHA-256/UTF-8 vectors also passed for ASCII, Korean, emoji,
and an unpaired surrogate.

The frozen accelerated bundle used by the current full run has hash:

```text
53e392c5481120504e2834a6d506c3574212071a15df9480bc309348bb057187
```

The four-way accelerator aliases only the domain hash implementation to Node's
SHA-256 while preserving domain canonicalization and exact UTF-8 encoding; merged
checkpoints are independently validated before publication.

## Limitations and disclosure

The v2 policy improves registered-content and strategy coverage, but remains a
declared synthetic sampling policy. It is not an actual-user distribution and must
not be presented as one. Negotiation and cross-group position changes remain
unsampled by design. Band goals remain the product target; scores are not
normalized or retrofitted to meet them. Any policy, ruleset, content-pack, or
generator-code change requires a new protocol/checkpoint identity and complete
regeneration.
