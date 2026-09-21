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
| #242, #244 | Role-balance candidate is integrated with the accepted 3.4 ruleset correction and historical role/replay coverage preserved. |
| #241, #250, #255, #258 | First-play/gameplay flow corrections are integrated; root’s current-flow and 3.4 season-result E2E cover the reachable paths. |
| #243, #246, #247, #169 | Candidate chapter rotation, long-content, narrative, and locker hints are integrated with immutable historical versions; candidate manifest checksums are validated. |
| #248 | Player award calculation and deterministic recipient identity are integrated; domain award tests pass 8/8. |
| #249 | K3/team-name candidate data is integrated; settings/team-name focused coverage remains green. |
| #251, #254 | Career chronicle and milestone/award dashboard summary are integrated; career index focused test passes 32/32. |
| #252, #253, #256, #257 | Peak evidence, qualitative labels, club-list search, and empty-state presentation are integrated; locker/retirement/season-result focused tests pass 40/40. |
| #161, #162 | Nationality/identity selector behavior is covered without issue-token lint regressions; full web check passes 740/740 with one pre-existing skip. |
| #245 | Promotion-reward decision remains deferred by product policy; no speculative reward rule was added. |
| #259 | Daily/weekly competition delivery is integrated and browser-QA accepted; comments/likes/live-PvP remain explicitly deferred. |

## Version and compatibility contract

New careers use ruleset `3.4.0` and content pack `0.13.0`; historical saves retain their stored versions. The production season remains `svc_season_1`, starts `2026-09-05T15:00:00Z`, has no end date, and uses `challenge_set_id=cs_season_1`. The guarded activation pair is exactly `3.3.0/0.12.0 → 3.4.0/0.13.0`; daily challenge simulation remains pinned to `3.3.0/0.12.0`.

Verified candidate checksums:

- pack `0.13.0`: `ba395ac1dc4f26379fbcc17b60cf132ab987177255bd474c0ef2fd8b6acfb9e6`
- ruleset `3.4.0`: `a94ac12b535b692a6bfa31140a68480642aeb001d0d965b4aad153918f101e2c`

The full command/result record, prior failures, remaining root gates, and final branch SHA are maintained in `/tmp/offside-luna-issues/integration-report.md` for the coordinator handoff.
