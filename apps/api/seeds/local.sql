INSERT INTO service_seasons (id, name, status, starts_at, ends_at, ruleset_version, content_pack_version, challenge_set_id, is_test)
VALUES ('svc_kickoff', 'Kickoff', 'ACTIVE', '2026-09-01T00:00:00Z', '2026-12-31T23:59:59Z', '1.0.0', '0.1.0', 'cs_kickoff', 0);

-- T-2-012 D-54: E2E_WITH_API 테스트용. local의 ACTIVE_SERVICE_SEASON_ID는 svc_kickoff를 그대로
-- 가리키므로(기존 테스트 불변) 이 행은 SERVICE_SEASON_UNKNOWN·생성 검증 테스트가 참조할 때만 쓰인다.
INSERT INTO service_seasons (id, name, status, starts_at, ends_at, ruleset_version, content_pack_version, challenge_set_id, is_test)
VALUES ('svc_line_test', 'LINE TEST', 'PRESEASON', '2026-09-08T00:00:00Z', '2026-10-31T23:59:59Z', '1.0.0', '0.1.0', 'cs_line_test', 1);
