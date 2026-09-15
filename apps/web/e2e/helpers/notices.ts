// 사용자 결정(2026-09-14): 홈 공지사항은 서버 D1 notices 테이블이 정본이다(HOME_NOTICES 상수
// 제거). 기본 e2e 모드(WITH_API=0)는 실제 api를 띄우지 않아 /v1/notices가 연결 거부로 실패해도
// engine/notices.ts의 폴백(kv-store → 빈 배열)이 화면을 정상 렌더하므로, 이 스텁 없이도 기존
// spec은 깨지지 않는다 — 실제 공지 2건이 보이는지 확인하려는 spec만 stubNotices를 쓴다.
import type { Page } from '@playwright/test';
import type { Notice } from '@offside/contracts';
import { fulfillJson, META } from './player-creation.js';

/** apps/api/seeds/local.sql·bootstrap-non-production.sql과 같은 이관 공지 2건. */
export const NOTICES_FIXTURE: readonly Notice[] = [
  {
    id: 'app-experience-2026-09-06',
    title: '화면과 이동 경험을 개선했습니다',
    body: [
      '선택지에 더 빨리 도달할 수 있도록 화면 구조와 정보 밀도를 다듬었습니다.',
      '직접 서명과 상단 고정 메뉴를 적용하고, 밝은 화면과 어두운 화면의 가독성을 함께 개선했습니다.',
    ],
    publishedAt: '2026-09-06T10:00:00Z',
  },
  {
    id: 'domain-and-save',
    title: '새 주소와 게임 기록 저장 안내',
    body: [
      'OFFSIDE의 현재 주소는 offside-lab.com입니다.',
      '다른 기기에서 기록을 이어가려면 기존 기기에서 동기화를 확인한 뒤 Google 계정을 연결하거나 복구 코드를 발급해 주세요. 동기화되지 않은 기기 데이터는 자동으로 옮겨지지 않습니다.',
    ],
    publishedAt: '2026-09-06T09:00:00Z',
  },
];

/** GET /v1/notices를 공지 2건(기본 NOTICES_FIXTURE)으로 스텁한다. */
export async function stubNotices(page: Page, notices: readonly Notice[] = NOTICES_FIXTURE): Promise<void> {
  await page.route('**/v1/notices**', (route) => fulfillJson(route, 200, { data: { items: notices }, meta: META }));
}

/** API 실패(오프라인·장애) 시 홈이 빈 목록 문구로 대체되는지 보는 spec이 쓴다. */
export async function stubNoticesFailure(page: Page): Promise<void> {
  await page.route('**/v1/notices**', (route) =>
    fulfillJson(route, 500, {
      error: { code: 'SERVICE_UNAVAILABLE', message: '서비스를 이용할 수 없습니다.', retryable: true },
      meta: META,
    }),
  );
}
