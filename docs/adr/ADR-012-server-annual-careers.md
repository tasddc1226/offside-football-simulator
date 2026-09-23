# ADR-012: New server-authoritative annual careers

Status: accepted for T-7-040 implementation; production activation is separate.

## Scope

This supersedes ADR-003 only for newly created `SERVER_ANNUAL` careers using the registered `3.5.0 / 0.14.0` pair. Historical `CLIENT_LOCAL` careers retain ADR-002/003 local execution, version pins, imports and checkpoint synchronization. Absence of authority metadata in historical responses means client-local; invalid metadata is not a fallback.

## Authority and creation

The API creates the seed, ID, initial commands and snapshots from a validated player draft. The active service season must explicitly support the annual pair; no fallback to an unactivated version. Article challenges retain their source's immutable seed/build; annual articles create annual careers, historical articles remain client-local. Caller-provided snapshots, outcomes, eligible-event lists and commands are not accepted by annual endpoints. Legacy PUT rejects both existing annual careers and attempted creation using annual-only versions, before its already-applied shortcut.

Creation requests carry the profile ID observed when the user began the intent. It is compared against the authenticated session, not trusted as authorization. Idempotency is owner-scoped; an old intent is rejected after identity changes instead of silently creating another career. Annual article admission uses the same profile fence. Current ownership is checked for receipt replay.

## Fixed year and decisions

One persisted run pins starting snapshot/revision, policy, ruleset/content versions and target season. Important decisions pause. Requests send the decision key and choice ID; the server rebuilds the allowed command from its current snapshot and canonical registered content. Routine training, matches and minor decisions run automatically. A completed run never starts the next year. Reports preserve actual attributes, minutes, growth components and event receipts; progress uses real command counts and season steps, not estimated percentages.

## Atomicity and lifecycle

D1 has no interactive transaction. Each chunk first claims a unique durable receipt under job/career revision, current owner and live-session guards. Every subsequent statement is guarded by that receipt ID in the same batch. A zero-row claim produces no writes; a constraint failure rolls back the whole batch. Checkpoint revision, career revision, snapshot, command log, final report and retirement archive are committed together. Unique run/start revision and run/action revision constraints arbitrate different-key races.

Jobs and receipts reference careers with delete cascade; ownership therefore follows profile merges. Receipt responses are historical: clients must use job/career revisions and owner fences to avoid rolling their cache backwards. Historical run status reads the stored ending snapshot, not the latest career's season.

## Runtime and limitations

Each request executes at most four domain commands and returns one final snapshot. A run has a fail-closed 240-command safety limit. These are bounded application guards, not a claim about production CPU allowance. Local Worker measurements are recorded separately in the task brief. Requests are synchronous; the web controller polls automatically while open. Closing the tab does not guarantee background completion. Reloading resumes the persisted same-year job. No queue, Durable Object or `waitUntil` durability is implied.

## Verification

Use real D1 concurrency, rollback-fault and commit-time ownership/session tests; natural annual progression/retirement/challenge; exact-response replay and changed-body rejection; forged legacy synchronization; and historical fixture tests. Production activation, migrations and release rollback require their normal separate deployment authorization.
