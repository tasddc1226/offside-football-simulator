/**
 * 시즌 진행 게이지. 서버(5분 cron)가 상태를 굳히고, 홈(웹·앱)이 읽어 게이지·마감 카운트다운을 그린다.
 * zod 없는 서브패스(`@offside/contracts/season-gauge`).
 *
 * - T-11-189 시즌은 개막부터 정확히 5주(minDays = maxDays = 35일)다. 게이지는 지난 시간 ÷ 35일로만 찬다.
 *   유저들이 함께 채우던 방식(완주 수 ÷ 참여 유저 × perUser)은 유저가 4천 명을 넘자 시즌 1이 열흘 만에 끝날 만큼 빨라
 *   진행률에서 뺐다. 완주 수·참여 유저·목표는 참고 지표로만 계속 센다(응답의 contributed · participants · target).
 * - 완주 수: 이번 시즌 선수가 35세 이상에 은퇴한 커리어 수(리롤용 조기 은퇴는 빼고). 한 유저가 하루(KST)에
 *   보태는 양은 dailyCap까지만 센다.
 * - lockAt에 닿으면 마감 시각을 확정한다: noticeHours 뒤와 개막 + minDays 중 늦은 쪽을 다음 00:00 KST로 올림
 *   (개막 + maxDays를 넘지 않는다). 그 뒤 게이지는 마감 시각에 정확히 100%가 되게 시간으로 찬다.
 * - 그 시즌 컵이 아직 끝나지 않았으면 마감을 컵 마지막 경기 다음 00:00 KST 뒤로 미룬다(최대 기간보다 컵이 먼저다).
 *   확정 뒤에도 컵 일정이 늦춰지면 마감을 늦추기만 하고 당기지는 않는다.
 */

import { DAY_MS as DAY, KST_MS as KST } from './kst.js';

export const SEASON_GAUGE = {
  /** 참고 지표 목표(참여 유저 × perUser). T-11-189부터 진행률에는 쓰지 않는다. */
  perUser: 10,
  dailyCap: 20,
  /** 이 나이 이상에 은퇴한 커리어만 센다(끝까지 뛴 커리어). */
  fullAge: 35,
  /** T-11-189 시즌 길이 5주. 둘이 같으면 마감은 늘 개막 + 35일(끝나지 않은 컵이 있으면 그 뒤)이다. */
  minDays: 35,
  maxDays: 35,
  lockAt: 0.9,
  noticeHours: 48,
} as const;

/** 서버가 app_meta에 굳혀 두는 게이지 상태. */
export interface SeasonGaugeState {
  season: number;
  /** 게이지에 들어간 완주 커리어 수(유저·하루 상한 적용). */
  contributed: number;
  /** 참여 유저 수(완주 커리어가 하나라도 있는 프로필). */
  participants: number;
  /** 확정 전 진행률(0~1). T-11-189부터 지난 시간 ÷ 최대 기간이다(완주 수로 찬 옛 값은 다음 cron이 덮는다). */
  peak: number;
  /** 마감을 확정한 시각(UTC ISO). 확정 전이면 null. */
  lockedAt: string | null;
  /** 확정한 마감 시각(UTC ISO, 00:00 KST). 확정 전이면 null. */
  endsAt: string | null;
  updatedAt: string;
}

/** 홈이 읽는 게이지(GET /v1/season/gauge). progress는 응답 시각 기준으로 다시 계산한 값이다. */
export interface SeasonGaugeView {
  season: number;
  startsAt: string;
  progress: number;
  contributed: number;
  participants: number;
  target: number;
  endsAt: string | null;
  /** 아무리 빨리 차도 이보다 먼저 끝나지 않고, 아무리 느려도 이때는 끝난다. */
  minEndsAt: string;
  maxEndsAt: string;
  updatedAt: string;
}

const HOUR = 3_600_000;
const ms = (iso: string) => Date.parse(iso);
const iso = (t: number) => new Date(t).toISOString();
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** 다음 00:00 KST로 올린다(이미 자정이면 그대로). */
export const ceilKstMidnight = (t: number): number => Math.ceil((t + KST) / DAY) * DAY - KST;

export const gaugeTarget = (participants: number): number =>
  Math.max(1, participants) * SEASON_GAUGE.perUser;

export const seasonBounds = (startsAt: string) => ({
  minEndsAt: iso(ms(startsAt) + SEASON_GAUGE.minDays * DAY),
  maxEndsAt: iso(ms(startsAt) + SEASON_GAUGE.maxDays * DAY),
});

/** 진행률: 개막부터 지난 시간 ÷ 최대 기간. */
const timeShare = (startsAt: string, now: string) =>
  clamp01((ms(now) - ms(startsAt)) / (SEASON_GAUGE.maxDays * DAY));

/** 컵 마지막 경기 뒤 결과·보상을 굳힐 여유(5분 cron 몇 번). */
const CUP_SETTLE_MS = HOUR;

/**
 * 마감 시각: 예고 시간 뒤와 최소 기간 중 늦은 쪽을 다음 00:00 KST로, 최대 기간을 넘지 않게. 끝나지 않은 컵이 있으면
 * (cupEndsAt = 마지막 경기 시각) 그 다음 00:00 KST보다 앞서지 않게 미룬다.
 */
export function seasonDeadline(
  startsAt: string,
  lockedAt: string,
  cupEndsAt: string | null = null,
): string {
  const { minEndsAt, maxEndsAt } = seasonBounds(startsAt);
  const t = Math.max(ms(lockedAt) + SEASON_GAUGE.noticeHours * HOUR, ms(minEndsAt));
  const base = Math.min(ceilKstMidnight(t), ms(maxEndsAt));
  return iso(cupEndsAt ? Math.max(base, ceilKstMidnight(ms(cupEndsAt) + CUP_SETTLE_MS)) : base);
}

/**
 * cron 한 번: 진행률(시간)과 참고 지표(완주 수 · 참여 유저)를 새로 적는다. 마감이 확정된 뒤에는 숫자만 고치고, 마감은
 * 끝나지 않은 컵(cupEndsAt) 때문에 늦춰야 할 때만 늦춘다(당기지 않는다).
 */
export function stepSeasonGauge(
  prev: SeasonGaugeState | null,
  season: { id: number; startsAt: string },
  counted: { contributed: number; participants: number },
  now: string,
  cupEndsAt: string | null = null,
): SeasonGaugeState {
  // T-11-189 완주 수는 진행률에 넣지 않는다. 시간은 뒤로 가지 않으니 옛 최고치(prev.peak)도 보지 않는다 — 완주 수로
  // 앞서 있던 값은 여기서 시간 기준으로 돌아간다.
  const peak = timeShare(season.startsAt, now);
  let lockedAt = prev?.lockedAt ?? null;
  let endsAt = prev?.endsAt ?? null;
  if (!lockedAt && peak >= SEASON_GAUGE.lockAt) {
    lockedAt = now;
    endsAt = seasonDeadline(season.startsAt, now, cupEndsAt);
  } else if (endsAt && cupEndsAt && now < endsAt) {
    const later = seasonDeadline(season.startsAt, lockedAt!, cupEndsAt);
    if (later > endsAt) endsAt = later;
  }
  return { season: season.id, ...counted, peak, lockedAt, endsAt, updatedAt: now };
}

/** 응답 시각의 진행률. 확정 전에는 지난 시간 ÷ 최대 기간(lockAt 아래), 확정 뒤에는 마감 시각에 100%가 되게 시간으로. */
export function seasonGaugeProgress(
  state: SeasonGaugeState,
  startsAt: string,
  now: string,
): number {
  const { lockAt } = SEASON_GAUGE;
  if (state.lockedAt && state.endsAt) {
    const span = ms(state.endsAt) - ms(state.lockedAt);
    const done = span > 0 ? clamp01((ms(now) - ms(state.lockedAt)) / span) : 1;
    return lockAt + (1 - lockAt) * done;
  }
  return Math.min(lockAt, timeShare(startsAt, now));
}

export function seasonGaugeView(
  state: SeasonGaugeState,
  startsAt: string,
  now: string,
): SeasonGaugeView {
  return {
    season: state.season,
    startsAt,
    progress: seasonGaugeProgress(state, startsAt, now),
    contributed: state.contributed,
    participants: state.participants,
    target: gaugeTarget(state.participants),
    endsAt: state.endsAt,
    ...seasonBounds(startsAt),
    updatedAt: state.updatedAt,
  };
}
