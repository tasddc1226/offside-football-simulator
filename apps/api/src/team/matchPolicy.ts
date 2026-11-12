import { teamSeasonAt } from '@offside/contracts/service-seasons';
import { TEAM_REPEAT_WINDOW_DAYS, teamMatchAllowance } from '@offside/contracts/owner-team';
import { kstDays, kstTodayStart } from '../time.js';
import { conflictError } from '../routes/shared.js';

/** 지금 고치고 겨루는 팀 시즌. 시즌 사이 휴식기면 409 SEASON_CLOSED. */
export function currentSeasonOrThrow(now: string): number {
  const season = teamSeasonAt(now);
  if (season === null) {
    throw conflictError(
      '지금은 시즌 사이 휴식기예요. 다음 시즌이 열리면 새 팀을 꾸릴 수 있어요.',
      'SEASON_CLOSED',
    );
  }
  return season;
}

/** 재대결 감쇠를 세는 기간의 시작(오늘 포함 TEAM_REPEAT_WINDOW_DAYS일, 한국 시각 자정 기준). */
export const repeatWindowStart = (now: string) =>
  kstDays(new Date(now), TEAM_REPEAT_WINDOW_DAYS).startIso;

/** 오늘 건 경기로 센 남은 경기 수와 다음 충전 시각(응답에 그대로 펼친다). */
export const matchAllowance = (
  played: readonly { createdAt: string }[],
  now: string,
  rechargeMin: number,
) => {
  const { left, nextAt } = teamMatchAllowance(
    played.map((m) => m.createdAt),
    now,
    kstTodayStart(now),
    rechargeMin,
  );
  return { matchesLeft: left, matchesNextAt: nextAt };
};

export const teamRequired = () =>
  conflictError('먼저 이번 시즌 팀을 만들어 주세요.', 'TEAM_REQUIRED');
