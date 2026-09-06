-- 현실적 출발 서사의 로컬·격리 QA 전용 시즌. 운영 포인터는 변경하지 않는다.
INSERT INTO service_seasons (id, name, status, starts_at, ends_at, ruleset_version, content_pack_version, challenge_set_id, is_test)
VALUES ('svc_realistic_story_qa', '현실적 커리어 서사 QA', 'PRESEASON', '2026-09-06T00:00:00Z', NULL, '1.2.0', '0.4.1', 'cs_realistic_story_qa', 1)
ON CONFLICT(id) DO NOTHING;
