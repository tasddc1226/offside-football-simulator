// T-11-511 시즌 패스. 한 시즌 동안 쓰는 유료 패스(자동 갱신 없음)로, 사면 바로 첫 단계를 받고 그 시즌에 은퇴시킨 커리어 수만큼
// 단계가 열려 단계마다 아이템을 받는다. 진행도는 시즌 게이지와 같은 기준이다: 그 시즌 선수가 fullAge 이상에 은퇴한 커리어를 (구단주, KST 날짜)마다
// dailyCap까지 센다. 패스를 시즌 중간에 사도 그 시즌 처음부터 센다.
// 서버(지급)와 화면(단계표 · 받을 보상)이 같은 규칙을 쓰게 한 곳에 둔다. zod 없는 서브패스(`@offside/contracts/season-pass`).
import type { AttendanceReward } from './attendance-rules.js';
import { OWNER_ITEMS } from './cup.js';
import { activeSeason, SERVICE_SEASONS } from './service-seasons.js';

/** 앱 스토어 · Play에 같은 ID로 만드는 소모성 상품. 같은 시즌에 두 번 사면 다음 시즌 패스가 된다. */
export const SEASON_PASS_PRODUCT_ID = 'com.offsidelab.app.season_pass';
/**
 * 화면에 패스 입구를 보이는지. 스토어 상품 심사가 끝나 출시할 때 true로 바꾼다(그 전에는 개발 빌드에서만 보인다). 판매 자체는
 * 서버 SEASON_PASS_ENABLED가 정한다.
 */
export const SEASON_PASS_LIVE = false;
/** 한국 기준가(원). 실제 결제 금액은 스토어가 나라에 맞춰 보인다. */
export const SEASON_PASS_PRICE_KRW = 9900;

export type SeasonPassTier = { tier: number; need: number; reward: AttendanceReward };

/**
 * 단계: 그 시즌 은퇴 커리어 need개를 채우면 열린다. 1단계(need 0)는 사면 바로 받는 보상, 2~11단계가 기본 단계(은퇴 25명까지),
 * 그 뒤(PASS_BONUS_FROM명부터)는 많이 뛰는 구단주를 위한 보너스 단계다(T-11-519). 스카우트권을 패스의 대표 보상으로 둔다.
 */
export const SEASON_PASS_TIERS: readonly SeasonPassTier[] = [
  { tier: 1, need: 0, reward: { scout: 2, boost: 10, reroll: 10 } },
  { tier: 2, need: 1, reward: { reroll: 5 } },
  { tier: 3, need: 2, reward: { boost: 3 } },
  { tier: 4, need: 3, reward: { reroll: 5, scout: 1 } },
  { tier: 5, need: 5, reward: { boost: 5 } },
  { tier: 6, need: 7, reward: { reroll: 6, scout: 1 } },
  { tier: 7, need: 9, reward: { boost: 5, rename: 1 } },
  { tier: 8, need: 12, reward: { reroll: 7, scout: 1 } },
  { tier: 9, need: 15, reward: { boost: 7, scout: 1 } },
  { tier: 10, need: 20, reward: { reroll: 8, boost: 5, scout: 1 } },
  { tier: 11, need: 25, reward: { scout: 3, boost: 10, rename: 1 } },
  { tier: 12, need: 30, reward: { reroll: 8, boost: 5 } },
  { tier: 13, need: 40, reward: { scout: 2, boost: 5 } },
  { tier: 14, need: 50, reward: { scout: 2, boost: 10, reroll: 10 } },
];
/** 이 은퇴 수부터는 보너스 단계다(화면에서 따로 표시한다). */
export const PASS_BONUS_FROM = 30;

/** 진행도(그 시즌 은퇴 커리어 수)로 열린 단계 수(0~10). */
export const passTierOf = (progress: number) =>
  SEASON_PASS_TIERS.filter((t) => progress >= t.need).length;

/** (from, to] 단계 보상을 합친다. 받을 게 없으면 빈 객체. */
export function passRewardBetween(from: number, to: number): AttendanceReward {
  const sum: AttendanceReward = {};
  for (const t of SEASON_PASS_TIERS) {
    if (t.tier <= from || t.tier > to) continue;
    for (const k of OWNER_ITEMS) if (t.reward[k]) sum[k] = (sum[k] ?? 0) + t.reward[k]!;
  }
  return sum;
}

/** 모든 단계 보상 합계(판매 화면). */
export const passRewardTotal = () => passRewardBetween(0, SEASON_PASS_TIERS.length);

/** 패스를 처음 파는 시즌. 시즌 1에는 팔지 않고 시즌 2 개막부터 연다. */
export const SEASON_PASS_FIRST_SEASON = 2;

/** 일정상 지금 시즌: 진행 중인 시즌, 시즌 사이면 다음에 열 시즌. */
function scheduleSeason(now: string): number {
  const active = activeSeason(now);
  if (active) return active.id;
  const next = SERVICE_SEASONS.find((s) => s.startsAt > now);
  return next?.id ?? Math.max(0, ...SERVICE_SEASONS.map((s) => s.id)) + 1;
}

/** 지금 새로 파는지: 시즌 2가 열린 뒤부터. */
export const passSaleOpen = (now: string) => scheduleSeason(now) >= SEASON_PASS_FIRST_SEASON;

/**
 * 화면에 패스 입구를 보이는지(T-11-519). 시즌 패스는 시즌마다 파는 상품이라 출시(SEASON_PASS_LIVE) 뒤에도 시즌 2가 열려야 보인다.
 * 웹 · 앱이 시작 때 받아 둔 시즌 일정을 쓰므로 개막 시각에 앱 업데이트 없이 열린다.
 */
export const passEntryOpen = (now: string, live: boolean = SEASON_PASS_LIVE) =>
  live && passSaleOpen(now);

/** 지금 패스를 파는 시즌(화면 · 지급 기준). 시즌 2가 열리기 전에는 시즌 2다. */
export const passSaleSeason = (now: string): number =>
  Math.max(SEASON_PASS_FIRST_SEASON, scheduleSeason(now));

/** 이번 거래로 여는 시즌: 파는 시즌을 이미 가졌으면 그다음 시즌(같은 시즌에 두 번 사도 결제가 버려지지 않는다). */
export function passSeasonFor(now: string, owned: readonly number[]): number {
  let s = passSaleSeason(now);
  while (owned.includes(s)) s++;
  return s;
}
