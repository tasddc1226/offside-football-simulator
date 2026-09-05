# Phase 5 reference-population protocol

This protocol describes the offline, deterministic population builder used for the
Legacy Score reference population. It is a data-generation gate, not a gameplay
path and not a source of legal or real-world player eligibility claims.

## Required population

The publish target is 10,000 independently seeded careers for each of `GK`, `DF`,
`MF`, and `FW` (40,000 careers total). Each career is run for a deterministic
number of seasons from 1 through 20 as a separate sample. The current builder
defaults to 20 seasons; a production invocation must record the selected
`--seasons` value and may not mix values in one artifact.

The seed is `phase5-population:<position>:<zero-based-index>`. Position fixtures
are the existing real domain fixtures (`career-04-gk`, `career-07-df`,
`career-08-mf`, and `career-09-fw`), with only career id and seed replaced. Every
season is executed through `simulate`: `START_SEASON`, `ADVANCE`, pending
resolution, and `SETTLE_SEASON`; the final state is retired through the real
`RETIRE` command. No `SeasonSummary`, score, or ending is copied from a fixture.

## Command

Run the script with the repository's already-installed `tsx` dependency:

```sh
node_modules/.pnpm/node_modules/.bin/tsx tooling/scripts/legacy-population.ts \
  --count 10000 --seasons 20 \
  --checkpoint artifacts/legacy-population.checkpoint.json \
  --out artifacts/legacy-population.json
```

For the accelerated four-way runner, keep the bundle and checkpoints in a
persistent work directory so an interrupted run can resume:

```sh
node tooling/scripts/legacy-population-node.mjs \
  --work-dir /persistent/phase5-population-work \
  --count 10000 --seasons 20 \
  --out artifacts/legacy-population.json
```

Use a small run for smoke testing, for example
`--count 2 --seasons 20 --smoke`; this writes an explicit `SMOKE_REPORT` and
never a publishable reference-population artifact.
The script resolves the registered `1.0.0` ruleset and `0.1.0` content pack and
records their real `loadRetirementArtifacts` checksums in both checkpoint and
published output.

## Checkpoint and publication rules

The checkpoint is updated in verified 100-career batches per position. Its group
hash is the canonical SHA-256 of the rows. A resume rejects protocol, generator
bundle, version, artifact, count, seed/length, or group-hash mismatches. It
writes through a temporary file and rename so a process interruption cannot
leave a partially written checkpoint.

The final population file is written only after all four groups have the exact
requested count and season setting. Counts below 10,000 are rejected unless
`--smoke` is present; smoke output is explicitly marked `SMOKE_REPORT` and is
not a reference-population publish. A partial checkpoint is never published as
the reference population. The final `populationHash` is the canonical SHA-256
of the payload before that field is added. A failed simulation, invalid snapshot,
retirement/archive/result construction failure, or checksum mismatch aborts the run.

The output rows contain position, seed index, seed, season count, calculated
score, calculated ending id, archive hash, and a deterministic result/evidence
hash. These hashes are audit material; they are not a replacement for retaining
the immutable artifact registry versions.

## Smoke evidence and extrapolation

On 2026-09-05, `--count 20 --seasons 20 --smoke` completed 80 real careers
(20 per position, requested lengths 1 through 20) in 28.76 seconds wall time;
all four groups contained 20 rows and every result hash was 64 hex characters.
A simple linear extrapolation to 40,000 careers is about 14,380 seconds (roughly
4 hours) on that development machine. This is planning evidence only: it is not
a production throughput claim and does not account for contention or checkpoint
I/O. The full 40,000-career batch remains pending review and was not run in
this verification task.

For local acceleration, `tooling/scripts/legacy-population-node.mjs` bundles
the runner with an explicit alias for only `domain/src/hash.ts`; the shim uses
Node's SHA-256 implementation over the domain's exact `utf8Encode` bytes. It
partitions GK/DF/MF/FW into four concurrent jobs and merges only validated
checkpoints. `--verify` compares normal and accelerated rows/archive/result
hashes for 80 careers and checks ASCII, Korean, emoji, and an unpaired-surrogate
UTF-8 vectors. On 2026-09-05 normal took 26.22s and accelerated took 5.32s
(4.93×), with identical rows and hashes. The verification report also records
per-position score min/median/max and band counts.

## Sampling-bias disclosure

The current career fixtures provide deterministic, scripted choices: pending
roles are accepted, events use fixed `A` outcomes, injury resolution uses the
standard plan, national-team calls are declined, and market offers are rejected.
The builder therefore proves reproducibility and real-engine execution, but its
distribution is not yet an unbiased model of player decision-making. A published
reference population must either keep this protocol versioned as the declared
sampling policy or introduce a separately versioned, deterministic choice policy
and regenerate every group. It must never silently combine populations made by
different policies.
