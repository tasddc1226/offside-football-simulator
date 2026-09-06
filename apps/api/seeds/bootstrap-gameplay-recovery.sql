-- 게임성 회복 규칙·콘텐츠의 로컬 격리 QA 전용 시즌. 운영 포인터는 변경하지 않는다.
INSERT INTO service_seasons (id, name, status, starts_at, ends_at, ruleset_version, content_pack_version, challenge_set_id, is_test)
VALUES ('svc_gameplay_recovery_qa', '게임성 회복 QA', 'PRESEASON', '2026-09-06T00:00:00Z', NULL, '1.3.0', '0.5.0', 'cs_gameplay_recovery_qa', 1)
ON CONFLICT(id) DO NOTHING;
