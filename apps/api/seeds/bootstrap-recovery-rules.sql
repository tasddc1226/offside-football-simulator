-- 회복 규칙 1.4.0(T-7-001)의 로컬·격리 QA 전용 시즌. 운영 포인터는 변경하지 않는다.
INSERT INTO service_seasons (id, name, status, starts_at, ends_at, ruleset_version, content_pack_version, challenge_set_id, is_test)
VALUES ('svc_recovery_rules_qa', '회복 규칙 1.4.0 QA', 'PRESEASON', '2026-09-07T00:00:00Z', NULL, '1.4.0', '0.5.0', 'cs_recovery_rules_qa', 1)
ON CONFLICT(id) DO NOTHING;
