// UX-001: 구단 이름 커스터마이즈. 오버라이드는 기기 로컬 저장(ui-store.ts의 `teamNameOverrides`)이고
// ProfileSettingsSchema(서버 동기화 대상)에는 없다 — 이 리졸버는 화면이 팀 id를 아는 렌더 시점에만
// 쓴다. 도메인이 커리어 상태에 이미 문자열로 구워 넣은 팀 이름(계약·오퍼·클럽 히스토리의 `teamName`
// 필드 등)은 여기서 손대지 않는다(PR 본문 한계 참고).
import type { Ruleset } from '@offside/domain';

export type TeamNameOverrides = Record<string, string>;

/**
 * `teamId`가 `ruleset.teams`에 있는 팀이면 오버라이드(있으면) 또는 룰셋 기본 이름을 돌려준다.
 * 룰셋에 없는 id(이름 없는 상대·컵 라운드 상대 등)는 오버라이드 대상이 아니므로 `undefined`를
 * 돌려준다 — 호출부가 자기 기존 fallback 문자열을 그대로 쓰면 된다.
 */
export function resolveTeamName(
  ruleset: Ruleset,
  teamId: string,
  overrides: TeamNameOverrides,
): string | undefined {
  const team = ruleset.teams.find((candidate) => candidate.id === teamId);
  if (team === undefined) return undefined;
  return overrides[teamId] ?? team.name;
}
