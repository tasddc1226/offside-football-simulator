import type { CareerState, Ruleset } from '@offside/domain';

/** 계약이 있으면 계약 팀 이름, 없으면 배경의 시작 팀 이름. 배경·팀을 못 찾으면 "무소속". */
export function currentTeamName(state: CareerState, ruleset: Ruleset): string {
  if (state.contract !== null) return state.contract.teamName;

  const backgroundId = state.player.profile?.backgroundId ?? state.player.draft.backgroundId;
  const background = backgroundId === null || backgroundId === undefined
    ? undefined
    : ruleset.backgrounds.find((candidate) => candidate.id === backgroundId);
  if (background === undefined) return '무소속';

  const team = ruleset.teams.find((candidate) => candidate.id === background.startTeamId);
  return team?.name ?? '무소속';
}
