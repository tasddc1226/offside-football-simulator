import type { Ruleset } from './ruleset.js';
import type { CareerState, SquadRole } from './types.js';

/**
 * 이슈 #145: 시즌 진행 중 "출전 약속 이행 전망". 결산(`buildSeasonResult` → `computePromiseFulfilment`)이
 * 쓰는 것과 같은 정의 — 약속 기준은 `promiseMinutesShareBp[contract.rolePromise]`, 분모는 컵 탈락으로
 * 건너뛴 일정을 뺀 경기 수 × 90 — 로 렌더 시점에 순수하게 파생한다. 도메인 상태·rng를 바꾸지 않는다.
 *
 * - SECURED: 이미 확보한 분(minutes / possibleMinutes)이 약속 기준 이상 → 결장해도 이행.
 * - ON_TRACK: 지금까지 비율은 기준 이상이지만 아직 확정은 아니다.
 * - RECOVERABLE: 지금은 기준 미만이지만 남은 경기를 전부 풀타임으로 뛰면 닿을 수 있다.
 * - UNRECOVERABLE: 남은 경기를 전부 뛰어도 기준에 못 미친다(미이행 확정).
 */
export type AppearancePromiseOutlookStatus = 'SECURED' | 'ON_TRACK' | 'RECOVERABLE' | 'UNRECOVERABLE';

export type AppearancePromiseOutlook = {
  promisedRole: SquadRole;
  promisedShareBp: number;
  minutes: number;
  /** 지금까지 기록된 경기 수(결장 포함). */
  playedMatches: number;
  /** 아직 치르지 않은 일정 수(컵 탈락으로 건너뛴 라운드 제외). */
  remainingMatches: number;
  /** 결산 분모와 같은 정의: 건너뛰지 않은 일정 × 90. */
  possibleMinutes: number;
  /** minutes / (playedMatches × 90). 경기가 없으면 0. */
  currentShareBp: number;
  /** minutes / possibleMinutes — 남은 경기를 전부 결장해도 남는 비율. */
  securedShareBp: number;
  /** (minutes + remainingMatches × 90) / possibleMinutes — 남은 경기를 전부 풀타임으로 뛸 때. */
  maxShareBp: number;
  status: AppearancePromiseOutlookStatus;
};

const FULL_MATCH_MINUTES = 90;

function shareBp(minutes: number, possibleMinutes: number): number {
  return possibleMinutes === 0 ? 0 : Math.round((minutes * 10000) / possibleMinutes);
}

/** 진행 중 시즌·계약이 없으면 null. */
export function computeAppearancePromiseOutlook(state: CareerState, ruleset: Ruleset): AppearancePromiseOutlook | null {
  const season = state.season;
  const contract = state.contract;
  if (season === null || contract === null) return null;

  const promisedRole = contract.rolePromise;
  const promisedShareBp = ruleset.contractRules.promiseMinutesShareBp[promisedRole];
  const scheduled = season.schedule.filter((entry) => entry.skipped === undefined).length;
  const playedMatches = season.matches.length;
  const remainingMatches = Math.max(0, scheduled - playedMatches);
  const possibleMinutes = scheduled * FULL_MATCH_MINUTES;
  const minutes = season.playerStats.minutes;

  const currentShareBp = shareBp(minutes, playedMatches * FULL_MATCH_MINUTES);
  const securedShareBp = shareBp(minutes, possibleMinutes);
  const maxShareBp = shareBp(minutes + remainingMatches * FULL_MATCH_MINUTES, possibleMinutes);

  const status: AppearancePromiseOutlookStatus =
    securedShareBp >= promisedShareBp
      ? 'SECURED'
      : maxShareBp < promisedShareBp
        ? 'UNRECOVERABLE'
        : currentShareBp >= promisedShareBp
          ? 'ON_TRACK'
          : 'RECOVERABLE';

  return {
    promisedRole,
    promisedShareBp,
    minutes,
    playedMatches,
    remainingMatches,
    possibleMinutes,
    currentShareBp,
    securedShareBp,
    maxShareBp,
    status,
  };
}
