import { PutOwnerTeamBodySchema, type OwnerTeam, type PutOwnerTeamBody } from '@offside/contracts';
import { MANAGER_NAME_MAX, TEAM_NAME_MAX } from '@offside/contracts/owner-team';

export type TeamDraft = { base: string; value: PutOwnerTeamBody };
import { kv } from '../../platform/setup';

const memory = new Map<string, TeamDraft>();
const keyOf = (id: string) => `ft_team_draft_v1:${id}`;

/** 경기 전적 갱신은 편집 초안의 충돌로 보지 않는다. */
export function teamDraftBase(team: OwnerTeam | null): string {
  return JSON.stringify(
    team
      ? {
          name: team.name,
          manager: team.manager,
          logo: team.logo ?? null,
          formation: team.formation,
          slots: team.slots.map((s) => s.careerId),
          layout: team.layout ?? null,
        }
      : null,
  );
}

/** 게임 세이브와 별개인 기기 초안. 저장소를 못 쓰면 화면 왕복만 복원한다. */
export function readTeamDraft(id: string): TeamDraft | null {
  try {
    const raw: unknown = JSON.parse(kv.getString(keyOf(id)) ?? 'null');
    if (
      raw &&
      typeof raw === 'object' &&
      'base' in raw &&
      'value' in raw &&
      typeof raw.base === 'string'
    ) {
      const value = raw.value;
      if (
        value &&
        typeof value === 'object' &&
        'name' in value &&
        'manager' in value &&
        typeof value.name === 'string' &&
        value.name.length <= TEAM_NAME_MAX &&
        typeof value.manager === 'string' &&
        value.manager.length <= MANAGER_NAME_MAX
      ) {
        // 이름 입력 중에는 빈 문자열도 복원한다. 나머지는 서버 계약으로 검증한다.
        const parsed = PutOwnerTeamBodySchema.safeParse({
          ...value,
          name: '초안팀',
          manager: '감독',
        });
        if (parsed.success)
          return {
            base: raw.base,
            value: { ...parsed.data, name: value.name, manager: value.manager },
          };
      }
    }
  } catch {
    /* 메모리 초안으로 복원 */
  }
  return memory.get(id) ?? null;
}

export function writeTeamDraft(id: string, draft: TeamDraft | null): void {
  if (draft) memory.set(id, JSON.parse(JSON.stringify(draft)) as TeamDraft);
  else memory.delete(id);
  try {
    if (draft) kv.set(keyOf(id), JSON.stringify(draft));
    else kv.remove(keyOf(id));
  } catch {
    /* 저장소 오류에도 편집은 계속 */
  }
}
