INSERT INTO service_seasons (id, name, status, starts_at, ends_at, ruleset_version, content_pack_version, challenge_set_id, is_test)
VALUES ('svc_kickoff', 'Kickoff', 'ACTIVE', '2026-09-01T00:00:00Z', '2026-12-31T23:59:59Z', '2.1.0', '0.8.0', 'cs_kickoff', 0);

-- T-2-012 D-54: E2E_WITH_API 테스트용. local의 ACTIVE_SERVICE_SEASON_ID는 svc_kickoff를 그대로
-- 가리키므로(기존 테스트 불변) 이 행은 SERVICE_SEASON_UNKNOWN·생성 검증 테스트가 참조할 때만 쓰인다.
INSERT INTO service_seasons (id, name, status, starts_at, ends_at, ruleset_version, content_pack_version, challenge_set_id, is_test)
VALUES ('svc_line_test', 'LINE TEST', 'PRESEASON', '2026-09-08T00:00:00Z', '2026-10-31T23:59:59Z', '1.0.0', '0.1.0', 'cs_line_test', 1);

-- 사용자 결정(2026-09-14): 코드 상수 HOME_NOTICES(apps/web/src/shared/home-notices.ts)에 있던
-- 공지 2건을 그대로 옮긴다. body는 문단 배열을 JSON 문자열로 저장한다(schema.ts 주석 근거).
INSERT INTO notices (id, title, body, published_at, is_published, created_at, updated_at)
VALUES (
  'app-experience-2026-09-06',
  '화면과 이동 경험을 개선했습니다',
  '["선택지에 더 빨리 도달할 수 있도록 화면 구조와 정보 밀도를 다듬었습니다.","직접 서명과 상단 고정 메뉴를 적용하고, 밝은 화면과 어두운 화면의 가독성을 함께 개선했습니다."]',
  '2026-09-06T10:00:00Z', 1, '2026-09-06T10:00:00Z', '2026-09-06T10:00:00Z'
);
INSERT INTO notices (id, title, body, published_at, is_published, created_at, updated_at)
VALUES (
  'domain-and-save',
  '새 주소와 게임 기록 저장 안내',
  '["OFFSIDE의 현재 주소는 offside-lab.com입니다.","다른 기기에서 기록을 이어가려면 기존 기기에서 동기화를 확인한 뒤 Google 계정을 연결하거나 복구 코드를 발급해 주세요. 동기화되지 않은 기기 데이터는 자동으로 옮겨지지 않습니다."]',
  '2026-09-06T09:00:00Z', 1, '2026-09-06T09:00:00Z', '2026-09-06T09:00:00Z'
);
