# Reliability integration evidence — 2026-09-21

This integration branch combines the accepted reliability, presentation, gameplay, social, and awards chains. It does not merge, deploy, or close issues; root review remains the release gate.

| Scope | Result | Evidence |
|---|---|---|
| T-7-039 back guard | Fixed and covered | `pnpm --filter @offside/web exec playwright test e2e/hub.spec.ts --workers=1` — 5/5; includes direct-entry, public transition, refresh, and legitimate home-exit paths. |
| #172 creation isolation | Fixed and covered | Independent tab/session draft and stale same-career revision conflict coverage; no duplicate command execution. Creation E2E: `pnpm --filter @offside/web exec playwright test e2e/create.spec.ts --workers=1` — 5/5. |
| #168 pointer/radio | Not reproduced | Focused pointer/keyboard evidence remains green; no speculative production change. Recommend obsolete/not-reproduced disposition after root review. |
| #190 role a11y | Fixed and covered | Current 3.3 role-change fixture executes a changed-role case; focused axe result has zero serious/critical violations. |
| #207 waits/CompareCards | Fixed and covered | Current 3.3 season-result, conflict, and CompareCards focused paths pass with deterministic waits. |
| #197 season reachability | Pinned and bounded | Historical/current representative fixtures remain reachable; expensive 20-season audit stays explicit opt-in rather than default. |
| Awards | Integrated | Candidate awards/milestones display and stable NPC identity names are covered by domain 8/8 and career index 32/32 focused tests. |
| Locker compatibility | Fixed and covered | API locker/migration focused tests 13/13; default GET projects the original eight player keys, while `includeRecognition=1` exposes evidence, notes, and recognition. Web locker/retirement/season-result focused tests 40/40. |

## Integrated review issue matrix

| Issue(s) | Outcome |
|---|---|
| #242 | Bounded healthy rookie reserve/sub-trial minutes use actual-match evidence; historical role/replay coverage remains preserved. |
| #243 | Six new major chapters are integrated with bounded repeat-diversity evaluation and historical chapter selection preserved. |
| #246 | Rehabilitation wording is age/body appropriate without changing historical content assets. |
| #169 | Earlier captain relationship unlock and truthful eligibility hints are integrated. |
| #248 | Player award calculation and deterministic recipient identity are integrated; domain award tests pass 8/8. |
| #249 | K3/team-name candidate data is integrated; settings/team-name focused coverage remains green. |
| #251, #254 | Career chronicle and milestone/award dashboard summary are integrated; career index focused test passes 32/32. |
| #252, #253, #256, #257 | Peak evidence, qualitative labels, club-list search, and empty-state presentation are integrated; locker/retirement/season-result focused tests pass 40/40. |
| #161, #162 | Nationality/identity selector behavior is covered without issue-token lint regressions; full web check passes 740/740 with one pre-existing skip. |
| #245 | Promotion-zone reputation reward is integrated as `promotionCenti250` (+250 internal centi units; UI may format this as +2.5); league membership is unchanged. |
| #259 | Daily/weekly competition delivery is integrated and browser-QA accepted; comments/likes/live-PvP remain explicitly deferred. |

## Version and compatibility contract

New careers use ruleset `3.4.0` and content pack `0.13.0`; historical saves retain their stored versions. The production season remains `svc_season_1`, starts `2026-09-05T15:00:00Z`, has no end date, and uses `challenge_set_id=cs_season_1`. The guarded activation pair is exactly `3.3.0/0.12.0 → 3.4.0/0.13.0`; daily challenge simulation remains pinned to `3.3.0/0.12.0`.

Verified candidate checksums:

- pack `0.13.0`: `ba395ac1dc4f26379fbcc17b60cf132ab987177255bd474c0ef2fd8b6acfb9e6`
- ruleset `3.4.0`: `a94ac12b535b692a6bfa31140a68480642aeb001d0d965b4aad153918f101e2c`

Final branch SHA is the tip of `tasddc1226/luna-issues-reliability` (exact SHA is recorded in the durable handoff report); root owns final browser/release authorization.
