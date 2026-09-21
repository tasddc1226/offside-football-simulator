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
VALUES ('svc_line_test', 'LINE TEST', 'PRESEASON', '2026-09-08T00:00:00Z', '2026-10-31T23:59:59Z', '3.4.0', '0.13.0', 'cs_line_test', 1)
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  status = excluded.status,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  ruleset_version = excluded.ruleset_version,
  content_pack_version = excluded.content_pack_version,
  challenge_set_id = excluded.challenge_set_id,
  is_test = excluded.is_test;

-- 사용자 결정(2026-09-14): 홈 공지사항 이관(local.sql과 같은 본문). main 머지마다 ci.yml이 이
-- 파일을 staging D1에 upsert하므로 ON CONFLICT DO UPDATE로 멱등을 유지한다.
INSERT INTO notices (id, title, body, published_at, is_published, created_at, updated_at)
VALUES (
  'app-experience-2026-09-06',
  '화면과 이동 경험을 개선했습니다',
  '["선택지에 더 빨리 도달할 수 있도록 화면 구조와 정보 밀도를 다듬었습니다.","직접 서명과 상단 고정 메뉴를 적용하고, 밝은 화면과 어두운 화면의 가독성을 함께 개선했습니다."]',
  '2026-09-06T10:00:00Z', 1, '2026-09-06T10:00:00Z', '2026-09-06T10:00:00Z'
)
ON CONFLICT(id) DO UPDATE SET
  title = excluded.title,
  body = excluded.body,
  published_at = excluded.published_at,
  is_published = excluded.is_published,
  updated_at = excluded.updated_at;
INSERT INTO notices (id, title, body, published_at, is_published, created_at, updated_at)
VALUES (
  'domain-and-save',
  '새 주소와 게임 기록 저장 안내',
  '["OFFSIDE의 현재 주소는 offside-lab.com입니다.","다른 기기에서 기록을 이어가려면 기존 기기에서 동기화를 확인한 뒤 Google 계정을 연결하거나 복구 코드를 발급해 주세요. 동기화되지 않은 기기 데이터는 자동으로 옮겨지지 않습니다."]',
  '2026-09-06T09:00:00Z', 1, '2026-09-06T09:00:00Z', '2026-09-06T09:00:00Z'
)
ON CONFLICT(id) DO UPDATE SET
  title = excluded.title,
  body = excluded.body,
  published_at = excluded.published_at,
  is_published = excluded.is_published,
  updated_at = excluded.updated_at;
