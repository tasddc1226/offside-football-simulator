-- 사용자 결정(2026-09-14): 홈 공지사항을 코드 상수(HOME_NOTICES)에서 서버 D1 notices 테이블로
-- 옮긴다. 이 파일은 운영 전용 1회성 데이터 이관 seed다 — 오케스트레이터가 마이그레이션 0007
-- (notices 테이블 생성, deploy-production.yml의 db:migrate:production 단계) 적용 뒤 아래 명령으로
-- 직접 실행한다(운영 계정 권한 필요, PR 머지 뒤):
--
--   pnpm --filter @offside/api exec wrangler d1 execute offside-production --remote --env production \
--     --file seeds/notices-production-2026-09-14.sql
--
-- ON CONFLICT DO UPDATE라 재실행해도 안전하다(완전히 같은 값이면 no-op, 운영자가 이후 이 두
-- 공지를 편집했다면 그 편집을 덮어쓰므로 재실행 전 현재 값을 확인한다). 본문은 apps/web/src/
-- shared/home-notices.ts에 있던 HOME_NOTICES 상수 2건, apps/api/seeds/local.sql·
-- bootstrap-non-production.sql과 동일하다.
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
