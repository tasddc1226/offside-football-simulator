INSERT INTO service_seasons (id, name, status, starts_at, ends_at, ruleset_version, content_pack_version, challenge_set_id, is_test)
VALUES ('svc_kickoff', 'Kickoff', 'ACTIVE', '2026-09-01T00:00:00Z', '2026-12-31T23:59:59Z', '1.0.0', '0.1.0', 'cs_kickoff', 0)
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  status = excluded.status,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  ruleset_version = excluded.ruleset_version,
  content_pack_version = excluded.content_pack_version,
  challenge_set_id = excluded.challenge_set_id,
  is_test = excluded.is_test;

-- Phase 5 밸런스·엔딩 통합 후보. 전체 모집단 인수 전에는 PRESEASON 테스트 시즌으로만 유지하며,
-- 일반 staging의 ACTIVE_SERVICE_SEASON_ID 포인터는 별도 승인 없이 이 행으로 바꾸지 않는다.
INSERT INTO service_seasons (id, name, status, starts_at, ends_at, ruleset_version, content_pack_version, challenge_set_id, is_test)
VALUES ('svc_phase5_qa', 'PHASE 5 QA', 'PRESEASON', '2026-09-06T00:00:00Z', '2026-12-31T23:59:59Z', '1.1.0', '0.3.0', 'cs_phase5_qa', 1)
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  status = excluded.status,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  ruleset_version = excluded.ruleset_version,
  content_pack_version = excluded.content_pack_version,
  challenge_set_id = excluded.challenge_set_id,
  is_test = excluded.is_test;

-- T-2-012 D-54·D-55: staging의 ACTIVE_SERVICE_SEASON_ID가 가리키는 PRESEASON 테스트 시즌.
-- 룰셋·팩은 운영 승격 목표 manifest(tooling/scripts/production-release.mjs PRODUCTION_SEASON)와 맞춘다.
-- main 머지마다 ci.yml이 이 파일을 staging D1에 upsert하므로 별도 수동 적용은 없다.
INSERT INTO service_seasons (id, name, status, starts_at, ends_at, ruleset_version, content_pack_version, challenge_set_id, is_test)
VALUES ('svc_line_test', 'LINE TEST', 'PRESEASON', '2026-09-08T00:00:00Z', '2026-10-31T23:59:59Z', '1.5.0', '0.6.0', 'cs_line_test', 1)
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  status = excluded.status,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  ruleset_version = excluded.ruleset_version,
  content_pack_version = excluded.content_pack_version,
  challenge_set_id = excluded.challenge_set_id,
  is_test = excluded.is_test;
