/**
 * 시즌 진행 게이지. 시즌을 정한 날짜에 끊지 않고 유저들이 함께 채운 만큼 진행한다. 서버(5분 cron)가 상태를 굳히고,
 * 홈(웹·앱)이 읽어 게이지·마감 카운트다운을 그린다. zod 없는 서브패스(`@offside/contracts/season-gauge`).
 *
 * - 채우는 값: 이번 시즌 선수가 35세 이상에 은퇴한 커리어 수(리롤용 조기 은퇴는 빼고). 한 유저가 하루(KST)에
 *   보태는 양은 dailyCap까지만 센다.
 * - 목표: 참여 유저(완주 커리어가 하나라도 있는 프로필) 수 × perUser. 유저 규모가 커지면 목표도 커진다.
 * - 새 유저가 들어와 비율이 내려가도 게이지는 뒤로 가지 않는다(지금까지의 최고치를 남긴다).
 * - 시간 하한: 시즌 최대 기간(maxDays)만큼 지나면 다 찬다 — 게이지가 느려도 시즌이 끝없이 늘어지지 않는다.
 * - lockAt에 닿으면 마감 시각을 확정한다: noticeHours 뒤와 개막 + minDays 중 늦은 쪽을 다음 00:00 KST로 올림
 *   (개막 + maxDays를 넘지 않는다). 그 뒤 게이지는 마감 시각에 정확히 100%가 되게 시간으로 찬다.
 * - 그 시즌 컵이 아직 끝나지 않았으면 마감을 컵 마지막 경기 다음 00:00 KST 뒤로 미룬다(최대 기간보다 컵이 먼저다).
 *   확정 뒤에도 컵 일정이 늦춰지면 마감을 늦추기만 하고 당기지는 않는다.
 */

import { DAY_MS as DAY, KST_MS as KST } from './kst.js';

export const SEASON_GAUGE = {
  /**
   * T-11-192 10 → 12: 시즌 1이 4.6일 만에 56%까지 차 2주 남짓이면 끝날 상황이라 목표를 올렸다.
   * T-11-528 12 → 29: 최대 기간을 25일에서 60일로 늘린 만큼(×2.4) 목표도 올려 하루 진행 속도를 그대로 둔다.
   */
  perUser: 29,
  dailyCap: 20,
  /** 이 나이 이상에 은퇴한 커리어만 센다(끝까지 뛴 커리어). */
  fullAge: 35,
  /**
   * T-11-192 7 → 14, 21 → 28: 빨리 차도 2주는 하고, 느려도 4주면 끝난다.
   * T-11-352 28 → 25: 시즌 1 게이지가 하루 1.7%p로 느려져 시간 하한으로 11-03에 끝날 상황이라 사흘 당겼다(10-31 토 개막).
   * T-11-528 14 → 30, 25 → 60: 시즌 2부터 한두 달 운영(2026-10-27 사용자 결정). 시즌 1은 마감(10-31)이 이미 확정돼 바뀌지 않는다.
   */
  minDays: 30,
  maxDays: 60,
  lockAt: 0.9,
  noticeHours: 48,
  /** 1 = 끝나지 않은 컵 · 리그가 있으면 마감을 그 뒤로 미룬다. */
  waitEvents: 1,
} as const;

export type SeasonGaugeRules = {
  readonly [K in keyof typeof SEASON_GAUGE]: number;
};

/**
 * T-11-546 시즌 1은 공지한 대로 옛 규칙(목표 12 · 14~25일, 시간 하한으로 10/31 00:00 KST 마감)으로 끝낸다. 시즌 1 마감은
 * 확정 전이었어서 T-11-528 값을 그대로 쓰면 최대 기간이 60일로 늘어 마감이 12월로 밀린다.
 * T-11-552 제3회 컵(결승 11/6)도 마감을 미루지 않는다. 컵은 시즌 1 팀으로 다음 시즌까지 이어서 치른다.
 */
const SEASON1_GAUGE: SeasonGaugeRules = {
  ...SEASON_GAUGE,
  perUser: 12,
  minDays: 14,
  maxDays: 25,
  waitEvents: 0,
};

/** 그 시즌의 게이지 규칙. */
export const gaugeRules = (season: number): SeasonGaugeRules =>
  season <= 1 ? SEASON1_GAUGE : SEASON_GAUGE;

/** 서버가 app_meta에 굳혀 두는 게이지 상태. */
export interface SeasonGaugeState {
  season: number;
  /** 게이지에 들어간 완주 커리어 수(유저·하루 상한 적용). */
  contributed: number;
  /** 참여 유저 수(완주 커리어가 하나라도 있는 프로필). */
  participants: number;
  /** 지금까지 가장 높았던 진행률(0~1) — 게이지는 뒤로 가지 않는다. */
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

export const gaugeTarget = (participants: number, rules: SeasonGaugeRules = SEASON_GAUGE): number =>
  Math.max(1, participants) * rules.perUser;

export const seasonBounds = (startsAt: string, rules: SeasonGaugeRules = SEASON_GAUGE) => ({
  minEndsAt: iso(ms(startsAt) + rules.minDays * DAY),
  maxEndsAt: iso(ms(startsAt) + rules.maxDays * DAY),
});

/** 시간 하한: 개막부터 지난 시간 ÷ 최대 기간. */
const timeShare = (startsAt: string, now: string, rules: SeasonGaugeRules) =>
  clamp01((ms(now) - ms(startsAt)) / (rules.maxDays * DAY));

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
  rules: SeasonGaugeRules = SEASON_GAUGE,
): string {
  const { minEndsAt, maxEndsAt } = seasonBounds(startsAt, rules);
  const t = Math.max(ms(lockedAt) + rules.noticeHours * HOUR, ms(minEndsAt));
  const base = Math.min(ceilKstMidnight(t), ms(maxEndsAt));
  return iso(
    cupEndsAt && rules.waitEvents
      ? Math.max(base, ceilKstMidnight(ms(cupEndsAt) + CUP_SETTLE_MS))
      : base,
  );
}

/**
 * cron 한 번: 새로 센 값으로 상태를 앞으로 민다. 마감이 확정된 뒤에는 숫자만 고치고, 마감은 끝나지 않은 컵(cupEndsAt)
 * 때문에 늦춰야 할 때만 늦춘다(당기지 않는다).
 */
export function stepSeasonGauge(
  prev: SeasonGaugeState | null,
  season: { id: number; startsAt: string },
  counted: { contributed: number; participants: number },
  now: string,
  cupEndsAt: string | null = null,
): SeasonGaugeState {
  const rules = gaugeRules(season.id);
  const raw = counted.contributed / gaugeTarget(counted.participants, rules);
  const peak = Math.min(1, Math.max(prev?.peak ?? 0, raw, timeShare(season.startsAt, now, rules)));
  let lockedAt = prev?.lockedAt ?? null;
  let endsAt = prev?.endsAt ?? null;
  if (!lockedAt && peak >= rules.lockAt) {
    lockedAt = now;
    endsAt = seasonDeadline(season.startsAt, now, cupEndsAt, rules);
  } else if (endsAt && cupEndsAt && now < endsAt) {
    const later = seasonDeadline(season.startsAt, lockedAt!, cupEndsAt, rules);
    if (later > endsAt) endsAt = later;
  }
  return { season: season.id, ...counted, peak, lockedAt, endsAt, updatedAt: now };
}

/** 응답 시각의 진행률. 확정 전에는 최고치(시간 하한 포함, lockAt 아래), 확정 뒤에는 마감 시각에 100%가 되게 시간으로. */
export function seasonGaugeProgress(
  state: SeasonGaugeState,
  startsAt: string,
  now: string,
): number {
  const rules = gaugeRules(state.season);
  const { lockAt } = rules;
  if (state.lockedAt && state.endsAt) {
    const span = ms(state.endsAt) - ms(state.lockedAt);
    const done = span > 0 ? clamp01((ms(now) - ms(state.lockedAt)) / span) : 1;
    return lockAt + (1 - lockAt) * done;
  }
  return Math.min(lockAt, Math.max(state.peak, timeShare(startsAt, now, rules)));
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
    target: gaugeTarget(state.participants, gaugeRules(state.season)),
    endsAt: state.endsAt,
    ...seasonBounds(startsAt, gaugeRules(state.season)),
    updatedAt: state.updatedAt,
  };
}
