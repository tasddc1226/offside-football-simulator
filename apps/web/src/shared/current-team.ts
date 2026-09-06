import type { CareerState, Ruleset } from '@offside/domain';
import { resolveTeamName, type TeamNameOverrides } from './team-names.js';

/**
 * 계약이 있으면 계약 팀 이름, 없으면 배경의 시작 팀 이름. 배경·팀을 못 찾으면 "무소속".
 *
 * `overrides`(UX-001 구단 이름 커스터마이즈)는 배경의 시작 팀 이름 분기에만 적용한다. 계약이 있으면
 * `state.contract.teamName`을 그대로 쓴다 — 이 값은 도메인이 계약 체결 시점에 `team.name`을 이미
 * 문자열로 구워 넣은 스냅샷이라(offers.ts) 여기서 오버라이드해도 이후 재협상·시즌 정산 등 도메인이
 * 이 필드를 다시 읽는 다른 화면과 어긋난다. PR 본문 한계 참고.
 */
export function currentTeamName(
  state: CareerState,
  ruleset: Ruleset,
  overrides: TeamNameOverrides = {},
): string {
  if (state.contract !== null) return state.contract.teamName;
  const recovery = ruleset.transferRules.recovery;
  if (recovery !== undefined && state.age > recovery.youthMaxAge) {
    return state.seasonHistory.length === 0 ? '계약 전 · 다음 팀 준비' : '무소속 · 다음 팀 준비';
  }

  const backgroundId = state.player.profile?.backgroundId ?? state.player.draft.backgroundId;
  const background = backgroundId === null || backgroundId === undefined
    ? undefined
    : ruleset.backgrounds.find((candidate) => candidate.id === backgroundId);
  if (background === undefined) return '무소속';

  return resolveTeamName(ruleset, background.startTeamId, overrides) ?? '무소속';
}

/**
 * UX-010 P5: PlayerBanner의 TeamBadge용 팀 id. `currentTeamName`과 같은 분기를 따르되 화면 표시
 * 문구("계약 전 · 다음 팀 준비" 등) 대신 배지가 그릴 수 있는 팀 id(또는 배지를 그리지 않을 null)를
 * 돌려준다 — 오버라이드는 적용하지 않는다(TeamBadge는 team-identity.ts가 팀 id 기준으로만 정하고
 * 이름 오버라이드에 영향받지 않는다, UX-008 요구사항 4).
 */
export function currentTeamId(state: CareerState, ruleset: Ruleset): string | null {
  if (state.contract !== null) return state.contract.teamId;
  const recovery = ruleset.transferRules.recovery;
  if (recovery !== undefined && state.age > recovery.youthMaxAge) return null;

  const backgroundId = state.player.profile?.backgroundId ?? state.player.draft.backgroundId;
  const background = backgroundId === null || backgroundId === undefined
    ? undefined
    : ruleset.backgrounds.find((candidate) => candidate.id === backgroundId);
  return background?.startTeamId ?? null;
}

/** 룰셋에서 아키타입 한글 이름을 찾는다. id가 없거나 룰셋에 없으면 id를 그대로 돌려준다(방어적). */
export function archetypeName(ruleset: Ruleset, archetypeId: string | null | undefined): string {
  if (archetypeId === null || archetypeId === undefined) return '—';
  return ruleset.archetypes.find((candidate) => candidate.id === archetypeId)?.name ?? archetypeId;
}
