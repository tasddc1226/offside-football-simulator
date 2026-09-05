# Phase 5 reference-population protocol

This is the offline, deterministic data-generation protocol for the Legacy Score
reference population. It is a reproducibility and data-integrity gate, not a
gameplay path, a model of real players, or a source of legal or eligibility claims.

## Target and status

The eventual publish target is 10,000 independently seeded careers in each of
`GK`, `DF`, `MF`, and `FW` (40,000 total). Requested lengths are stratified from
1 through 20 seasons: row `i` requests `1 + (i mod --seasons)` seasons. Realized
seasons may be shorter when the engine requires retirement.

Distribution acceptance uses all 40,000 rows, not a post-selected 20-season subset.
Band and 80+ denominators, the zero-team-trophy subset, and predeclared numerical
tolerances are fixed in the [balance acceptance criteria](phase-5-balance-redesign.md#분포-판정-기준-고정--2026-09-05).
These are product review criteria for the final full run, not per-PR statistical
assertions. The final synthetic choice policy and candidate versions remain open;
no diagnostic v5 policy is approved for publication by that clarification.

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

The current generator is v3: `phase5-population-3-ui-choices`, choice policy
`ui-action-strata-v1`. KEEP always accepts, other role choices preserve the previous
policy. It accepts `--legacy-version 1.0.0|1.1.0` (default 1.0.0) and pins the
selected definition checksum. Version 1.1.0 is an unactivated candidate, not an
accepted scoring release. The original v3 population ID is retained for compatibility.
Rows also retain the five components, minutes, possible minutes, peak OVR,
trophies and eligible endings for diagnosis. Final balance acceptance remains open.

Ruleset 1.1 or informed-strategy runs now use the candidate protocol
`phase5-population-5-policy-isolation`. Their IDs include the choice policy and
canonical SHA-256 of the complete provenance: generator, artifact checksums,
versions, choice/seed/length policies, requested count and scoring policy. Random,
opportunity and mixed reports therefore cannot alias one another or a report from
a different source bundle. This is identity isolation, not registration of a new
reference policy. Existing publisher/runtime validation still rejects v5 until a
separate balance acceptance and release change registers it. Old checkpoints and
diagnostic rows are not relabelled or resumed as v5.

The predeclared final candidate policy is `mixed`: a seed-fixed 50/50 split between
`ui-action-strata-v1` behavior and the public-information opportunity policy. This
is a synthetic reference choice mix, not an estimate of player behavior. Candidate
rows also retain recorded career tag IDs, 40%-minutes active-season count, and
versioned sustained-contribution-season count for audit. These fields never feed
choices or simulation. The 2026-09-06 800-career pilot missed the LEGEND and 80+
gates, so v5 remains non-publishable and the 40,000-career run is blocked.
The frozen candidate's 80-career normal/accelerated parity check matched every row
(bundle `3e4d1df24bd74f27c107d67e8e2ba8762ae58920d422edb4bfdc1ab5d07ee09b`,
7.62x observed speedup). This validates execution equivalence, not distribution
acceptance.

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
