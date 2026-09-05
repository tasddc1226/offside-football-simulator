import type { Ruleset } from './ruleset.js';
import { compareCodePoints } from './canonical.js';
import { findTacticalStyle } from './selection.js';
import type { Position, SeasonManager, SeasonSummary, TimelineEntry } from './types.js';

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

export function codePointSum(value: string): number {
  let sum = 0;
  for (const ch of value) {
    sum += ch.codePointAt(0)!;
  }
  return sum;
}

function managerName(id: string, names: readonly string[]): string {
  if (names.length === 0) throw new RangeError('managerName: managerRules.names가 비어 있다.');
  return names[codePointSum(id) % names.length]!;
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
  timeline?: readonly TimelineEntry[];
}): SeasonManager {
  const style = findTacticalStyle(input.ruleset, input.tacticalStyleId);
  const names = input.ruleset.managerRules.names;
  // 기존 첫 감독 생성 규칙은 팀 id 해시를 유지한다. 교체 감독만 감독 id 해시를 쓴다.
  const generation =
    (input.timeline?.filter(
      (entry) => entry.kind === 'MANAGER_CHANGED' && entry.refId?.startsWith(`${input.teamId}-mgr-`),
    ).length ?? 0) + 1;
  const id = `${input.teamId}-mgr-${generation}`;
  // Preserve the historical first-manager name seed; only replacement
  // generations derive their name from the generation-specific id.
  const name = managerName(generation === 1 ? input.teamId : id, names);
  return {
    id,
    name,
    preferredArchetypeIds: style.preferredArchetypeIds[input.primaryPosition] ?? [],
    tenureSeasons: managerTenureSeasons(input.seasonHistory, input.teamId),
    trustBase: input.ruleset.managerRules.trustBase,
  };
}

function sameIdSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const left = [...a].sort(compareCodePoints);
  const right = [...b].sort(compareCodePoints);
  return left.every((id, index) => id === right[index]);
}

function cyclicArchetypeIds(ids: readonly string[], start: number, count: number): string[] {
  if (ids.length === 0 || count === 0) return [];
  return Array.from({ length: Math.min(count, ids.length) }, (_, index) => ids[(start + index) % ids.length]!);
}

/**
 * T-4-003: 결산에서 교체가 확정된 뒤 예약할 새 감독을 만든다. 포지션 아키타입은 id 오름차순으로
 * 정렬한 원형 목록에서 id 해시 위치부터 고르고, 이전 감독과 같은 집합이면 한 칸 이동한다.
 */
export function buildReplacementManager(input: {
  teamId: string;
  primaryPosition: Position;
  previousManager: SeasonManager;
  timeline: readonly TimelineEntry[];
  ruleset: Ruleset;
}): SeasonManager {
  const generation =
    input.timeline.filter(
      (entry) => entry.kind === 'MANAGER_CHANGED' && entry.refId !== null && entry.refId.startsWith(`${input.teamId}-mgr-`),
    ).length +
    2;
  const id = `${input.teamId}-mgr-${generation}`;
  const candidateIds = input.ruleset.archetypes
    .filter((archetype) => archetype.position === input.primaryPosition)
    .map((archetype) => archetype.id)
    .sort(compareCodePoints);
  const preferredCount = Math.min(input.ruleset.managerRules.preferredArchetypeCount, candidateIds.length);
  let start = candidateIds.length === 0 ? 0 : codePointSum(id) % candidateIds.length;
  let preferredArchetypeIds = cyclicArchetypeIds(candidateIds, start, preferredCount);
  if (sameIdSet(preferredArchetypeIds, input.previousManager.preferredArchetypeIds) && candidateIds.length > 1) {
    start = (start + 1) % candidateIds.length;
    preferredArchetypeIds = cyclicArchetypeIds(candidateIds, start, preferredCount);
  }

  return {
    id,
    name: managerName(id, input.ruleset.managerRules.names),
    preferredArchetypeIds,
    tenureSeasons: 1,
    trustBase: input.ruleset.managerRules.trustBase,
  };
}
