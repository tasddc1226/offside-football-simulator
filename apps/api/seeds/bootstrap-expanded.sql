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
