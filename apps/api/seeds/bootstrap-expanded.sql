-- Phase 3+4 확장 콘텐츠(0.3.0) 실플레이 QA 전용. 일반 staging bootstrap과 분리해 수동
-- deploy-expanded-staging workflow에서만 staging D1에 upsert한다.
INSERT INTO service_seasons (id, name, status, starts_at, ends_at, ruleset_version, content_pack_version, challenge_set_id, is_test)
VALUES ('svc_phase34_qa', 'PHASE 3+4 QA', 'PRESEASON', '2026-09-05T00:00:00Z', '2026-10-31T23:59:59Z', '1.0.0', '0.3.0', 'cs_phase34_qa', 1)
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  status = excluded.status,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  ruleset_version = excluded.ruleset_version,
  content_pack_version = excluded.content_pack_version,
  challenge_set_id = excluded.challenge_set_id,
  is_test = excluded.is_test;

-- Phase 5 통합 후보. expanded 전용 포인터가 이 PRESEASON 테스트 cohort를 가리킨다.
-- 일반 staging의 svc_line_test와 production 포인터는 이 seed가 변경하지 않는다.
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
