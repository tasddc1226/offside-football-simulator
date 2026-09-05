# Phase 5 reference-population protocol

This is the offline, deterministic data-generation protocol for the Legacy Score
reference population. It is a reproducibility and data-integrity gate, not a
gameplay path, a model of real players, or a source of legal or eligibility claims.

## Target and status

The eventual publish target is 10,000 independently seeded careers in each of
`GK`, `DF`, `MF`, and `FW` (40,000 total). Requested lengths are stratified from
1 through 20 seasons: row `i` requests `1 + (i mod --seasons)` seasons. Realized
seasons may be shorter when the engine requires retirement.

The current protocol is v2: ruleset `1.0.0`, registered content pack `0.3.0`,
protocol `phase5-population-2-registered-choices`, choice policy
`registered-hash-strata-v1`, and seed
`phase5-population:<position>:<zero-based-index>`.

The 40,000-career run is still in progress. It has not passed the publication gate,
and no official reference population has been published. The original band goals
remain unchanged; interim smoke or parity output is not a balance pass.

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

```sh
node_modules/.pnpm/node_modules/.bin/tsx tooling/scripts/legacy-population.ts \
  --count 10000 --seasons 20 \
  --checkpoint artifacts/legacy-population.checkpoint.json \
  --out artifacts/legacy-population.json
```

The accelerated runner keeps its bundle and four position checkpoints in a
persistent work directory:

```sh
node tooling/scripts/legacy-population-node.mjs \
  --work-dir /persistent/phase5-population-work \
  --count 10000 --seasons 20 \
  --out artifacts/legacy-population.json
```

Use `--count 20 --seasons 20 --smoke` for a non-publishing smoke report. Counts
below 10,000 are rejected for normal publication and are written only as an
explicitly marked `SMOKE_REPORT`.

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
