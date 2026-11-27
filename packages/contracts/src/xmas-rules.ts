// T-11-834 2026 크리스마스 이벤트(docs/tracking/christmas-event-plan.md). 신규 유저가 첫날 끝까지 즐기게 하는 이벤트라
// 양말 세 개(첫 시즌 · 첫 은퇴 · 구단주 팀)와 모두가 함께 채우는 트리, 한정 칭호, 초대 보상 2배로 이뤄진다.
// 서버(판정 · 지급)와 화면(카드 · 시트)이 같은 표를 쓰게 한 곳에 둔다. zod 없는 서브패스(`@offside/contracts/xmas`).
import type { OwnerItem } from './cup.js';
import { XMAS_DATES, xmasPhase } from './xmas-dates.js';

export { XMAS_INVITE_MULT, xmasInviteMult, xmasPhase, type XmasPhase } from './xmas-dates.js';
export { EVENT_TITLE_RE, isEventTitle, XMAS_TITLE } from './owner-title.js';

export type XmasReward = Partial<Record<OwnerItem, number>>;

/** 보상 기록(gift_claims.gift_id) 앞머리. 'xmas26:sock:start' · 'xmas26:tree:3'. */
export const XMAS_CLAIM_PREFIX = 'xmas26:';

export const XMAS_EVENT = {
  ...XMAS_DATES,
  /** 트리에 보태는 은퇴를 세는 KST 날짜(서버 app_meta `retired:<날짜>`). */
  treeDays: [
    '2026-12-19',
    '2026-12-20',
    '2026-12-21',
    '2026-12-22',
    '2026-12-23',
    '2026-12-24',
    '2026-12-25',
  ],
  /** 트리 목표(은퇴 커리어 수). 11월 하루 은퇴 1,500건 안팎 × 7일보다 15%쯤 높게 잡았다. */
  treeGoal: 12_000,
} as const;

export const XMAS_SOCK_KEYS = ['start', 'retire', 'team'] as const;
export type XmasSockKey = (typeof XMAS_SOCK_KEYS)[number];

/** 양말 보상. team(큰 양말)은 한정 칭호(XMAS_TITLE)도 준다. 합계는 출석 도장판 한 판의 절반 안쪽이다. */
export const XMAS_SOCKS: Readonly<Record<XmasSockKey, XmasReward>> = {
  start: { reroll: 3 },
  retire: { reroll: 3, boost: 2 },
  team: { scout: 1, boost: 2 },
};

/** 트리 단계(목표의 25 · 50 · 75 · 100%)와 보상. */
export const XMAS_TREE_STEPS: readonly { pct: number; reward: XmasReward }[] = [
  { pct: 25, reward: { reroll: 2 } },
  { pct: 50, reward: { boost: 1 } },
  { pct: 75, reward: { reroll: 2 } },
  { pct: 100, reward: { scout: 1, boost: 1 } },
];

/** 트리를 아직 세는 중인가(이벤트가 열려 있고 12/25가 지나지 않았다). */
export const xmasTreeCounting = (nowMs: number, off = false) =>
  xmasPhase(nowMs, off) === 'open' && nowMs < Date.parse(XMAS_EVENT.treeEndAt);

/** 트리 진행도(%, 0~100 정수). */
export const xmasTreePct = (count: number) =>
  Math.min(100, Math.floor((count / XMAS_EVENT.treeGoal) * 100));

export const xmasSockClaimKey = (key: XmasSockKey) => `${XMAS_CLAIM_PREFIX}sock:${key}`;
/** step: 1~4(XMAS_TREE_STEPS 순서). */
export const xmasTreeClaimKey = (step: number) => `${XMAS_CLAIM_PREFIX}tree:${step}`;

/** 받기 대상: 'sock:start' · 'tree:2'. */
export const XMAS_TARGET_RE = /^(?:sock:(start|retire|team)|tree:([1-4]))$/;
