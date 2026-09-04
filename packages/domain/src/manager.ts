import type { Ruleset } from './ruleset.js';
import { findTacticalStyle } from './selection.js';
import type { Position, SeasonManager, SeasonSummary } from './types.js';

/**
 * T-4-001 D-50: `seasonHistory` 끝에서부터 같은 `teamId`가 연속된 시즌 수 + 1(감독 교체가 아직
 * 모델링되지 않아 "같은 팀 = 같은 감독"으로 본다 — 실제 교체 판정은 T-4-003).
 */
export function managerTenureSeasons(seasonHistory: readonly SeasonSummary[], teamId: string): number {
  let count = 0;
  for (let i = seasonHistory.length - 1; i >= 0; i--) {
    if (seasonHistory[i]!.teamId !== teamId) break;
    count += 1;
  }
  return count + 1;
}

function codePointSum(value: string): number {
  let sum = 0;
  for (const ch of value) {
    sum += ch.codePointAt(0)!;
  }
  return sum;
}

/**
 * T-4-001 D-50: `START_SEASON`이 rng 없이 만드는 기본 감독. 교체 판정·새 감독 생성·`managerTrust`
 * 재평가는 T-4-003 몫이다 — 이 함수는 결정론적 자리표시자 감독 1명만 만든다.
 */
export function buildDefaultManager(input: {
  teamId: string;
  tacticalStyleId: string;
  primaryPosition: Position;
  seasonHistory: readonly SeasonSummary[];
  ruleset: Ruleset;
}): SeasonManager {
  const style = findTacticalStyle(input.ruleset, input.tacticalStyleId);
  const names = input.ruleset.managerRules.names;
  const name = names[codePointSum(input.teamId) % names.length]!;
  return {
    id: `${input.teamId}-mgr-1`,
    name,
    preferredArchetypeIds: style.preferredArchetypeIds[input.primaryPosition] ?? [],
    tenureSeasons: managerTenureSeasons(input.seasonHistory, input.teamId),
    trustBase: input.ruleset.managerRules.trustBase,
  };
}
