import { PutOwnerTeamBodySchema } from '@offside/contracts';
import { isAcceptablePublicName, isReservedNickname } from '@offside/contracts/content-filter';
import { teamSeasonAt } from '@offside/contracts/service-seasons';
import type { Db } from '../db/client.js';
import { newId } from '../db/ids.js';
import { ownerTeams } from '../db/schema.js';
import {
  careersByIds,
  eligibleMap,
  myTeamIn,
  friendlyTeamOf,
  layoutOf,
  cupPresetOf,
  type FriendlyLineup,
} from '../db/repos/ownerTeams.js';
import { teamCoachOf } from '../db/repos/managers.js';
import { AppError } from '../errors.js';
import { conflictError } from '../routes/shared.js';
import { activeCompetitionSeasonsQuery } from './cup.js';
import { buildLineup, filledCount, lineupOvr } from './sim.js';

// Injected seasonal/competition policy keeps this save use case independent of orchestration.
type SaveRules = {
  currentSeasonOrThrow(now: string): number;
  checkCupLineup(
    db: Db,
    profileId: string,
    season: number,
    ids: readonly string[],
    filled: number,
    now: string,
    ovr: number,
    options?: { league?: boolean; cup?: boolean },
  ): Promise<void>;
};
const coachOf = teamCoachOf;
export const coachNotEligible = () =>
  conflictError('감독 커리어를 끝낸 감독만 감독 칸에 넣을 수 있어요.', 'COACH_NOT_ELIGIBLE');

const PAST_SEASON_TEXT = '지난 시즌 팀은 고칠 수 없어요.';

/**
 * 지금 시즌 팀만 고친다(프리시즌 팀은 친선전용으로). T-11-552 끝나지 않은 컵·리그에 참가 중인 지난 시즌 팀은 컵 명단으로
 * 고친다(시즌 1 제3회 컵은 시즌 2 개막 뒤에도 시즌 1 팀으로 치른다). 컵 팀이면 true.
 */
export async function checkEditableSeason(
  db: Db,
  profileId: string,
  season: number,
  current: number | null,
) {
  if (season === current || season === 0) return false;
  if (
    current !== null &&
    season < current &&
    (await activeCompetitionSeasonsQuery(db, profileId)).some((r) => r.season === season)
  )
    return true;
  throw conflictError(PAST_SEASON_TEXT, 'SEASON_CLOSED');
}

/** 팀·감독 이름 검사(욕설·운영자 사칭). */
function checkName(value: string, what: string) {
  // '로고 글자'처럼 받침이 없는 이름도 오므로 문장은 조사 없이 잇는다(errorText의 번역 패턴과 같이 바꾼다).
  if (isReservedNickname(value)) {
    throw new AppError({
      code: 'VALIDATION_FAILED',
      message: `${what}에 '운영자'처럼 운영진으로 보이는 말은 쓸 수 없어요.`,
      details: { reason: 'RESERVED_NAME' },
    });
  }
  if (!isAcceptablePublicName(value)) {
    throw new AppError({
      code: 'VALIDATION_FAILED',
      message: `${what}에 쓸 수 없는 말이 들어 있어요.`,
      details: { reason: 'BLOCKED_WORD' },
    });
  }
}

/**
 * 저장할 선발 검사(팀 저장 · T-11-570 컵 명단 프리셋): 한 선수는 한 자리, 지금 가진 내 선수만.
 */
export async function checkLineupPlayers(
  db: Db,
  profileId: string,
  season: number,
  current: number | null,
  slots: readonly (string | null)[],
) {
  const ids = slots.filter((x): x is string => x !== null);
  if (new Set(ids).size !== ids.length) {
    throw new AppError({
      code: 'VALIDATION_FAILED',
      message: '한 선수는 한 자리에만 넣을 수 있어요.',
      details: { reason: 'DUPLICATE_PLAYER' },
    });
  }
  const eligible = eligibleMap(await careersByIds(db, ids), profileId, season, true);
  if (ids.some((id) => !eligible.has(id))) {
    throw new AppError({
      code: 'VALIDATION_FAILED',
      message:
        season === current
          ? '지금 가진 내 선수만 팀에 넣을 수 있어요.'
          : '지금 가진 프리시즌 선수만 프리시즌 팀에 넣을 수 있어요.',
      details: { reason: 'PLAYER_NOT_ELIGIBLE' },
    });
  }
  return { ids, eligible };
}

export async function saveOwnerTeam(
  db: Db,
  profileId: string,
  input: ReturnType<typeof PutOwnerTeamBodySchema.parse>,
  now: string,
  rules: SaveRules,
) {
  const current = teamSeasonAt(now);
  const season = input.season ?? rules.currentSeasonOrThrow(now);
  const cupTeam = await checkEditableSeason(db, profileId, season, current);
  const friendly = season !== current && !cupTeam;
  checkName(input.name, '팀 이름');
  checkName(input.manager, '감독 이름');
  if (input.logo?.text) checkName(input.logo.text, '로고 글자');
  const { ids, eligible } = await checkLineupPlayers(db, profileId, season, current, input.slots);
  // 이전 클라이언트가 좌표를 보내지 않으면 기존 자유 편성을 보존한다.
  // 포메이션을 바꾼 요청만 새 기본 배치로 돌아간다. T-11-570 컵 명단 프리셋이 있는지도 이 행에서 본다.
  const [stored] = await myTeamIn(db, profileId, season);
  const previous = stored ? friendlyTeamOf(stored) : null;
  // T-11-310 감독 칸: 보내지 않으면(옛 클라이언트) 그대로 둔다. 끝낸 내 감독만 넣는다.
  const coachId = input.coach === undefined ? (previous?.coachId ?? null) : input.coach;
  const coach = coachId ? await coachOf(db, { coachId, profileId }) : null;
  if (input.coach && !coach) throw coachNotEligible();
  const layout =
    input.layout === undefined
      ? previous?.formation === input.formation
        ? layoutOf(previous)
        : null
      : input.layout;
  const lineup = buildLineup(input.formation, input.slots, eligible, layout);
  // T-11-570 컵 명단 프리셋이 따로 있으면 팀 명단은 컵에 나가지 않으므로 리그 잠금만 본다.
  if (!friendly)
    await rules.checkCupLineup(
      db,
      profileId,
      season,
      ids,
      filledCount(lineup),
      now,
      lineupOvr(lineup),
      {
        cup: !(stored && cupPresetOf(stored)),
      },
    );
  const values = {
    name: input.name,
    manager: input.manager,
    formation: input.formation,
    slotsJson: JSON.stringify(input.slots),
    layoutJson: layout ? JSON.stringify(layout) : null,
    // 로고를 모르는 이전 클라이언트의 저장은 기존 로고를 보존한다.
    ...(input.logo !== undefined
      ? { logoJson: input.logo ? JSON.stringify(input.logo) : null }
      : {}),
    filled: filledCount(lineup),
    ovr: lineupOvr(lineup),
    coachId: coach ? coachId : null,
  };
  if (friendly) {
    const lineupJson = JSON.stringify({
      logoJson: previous?.logoJson ?? null,
      ...values,
    } satisfies FriendlyLineup);
    const [row] = await db
      .insert(ownerTeams)
      .values({
        id: newId('tem'),
        profileId,
        season,
        name: input.name,
        manager: input.manager,
        formation: input.formation,
        slotsJson: JSON.stringify(input.slots.map(() => null)),
        filled: 0,
        ovr: 0,
        friendlyJson: lineupJson,
        createdAt: now,
        updatedAt: now,
        nameChangedAt: now,
      })
      .onConflictDoUpdate({
        target: [ownerTeams.profileId, ownerTeams.season],
        set: { friendlyJson: lineupJson },
      })
      .returning();
    return {
      row: friendlyTeamOf(row!),
      lineup,
      eligible,
      coach,
      season,
      friendly,
    };
  }
  const [row] = await db
    .insert(ownerTeams)
    .values({
      id: newId('tem'),
      profileId,
      season,
      createdAt: now,
      updatedAt: now,
      nameChangedAt: now,
      ...values,
    })
    .onConflictDoUpdate({
      target: [ownerTeams.profileId, ownerTeams.season],
      // T-11-616 이름이나 감독 이름이 바뀐 저장만 새 이름 점검 대상으로 표시한다(선발만 고친 저장은 건드리지 않는다).
      set: {
        ...values,
        updatedAt: now,
        ...(stored && stored.name === input.name && stored.manager === input.manager
          ? {}
          : { nameChangedAt: now }),
      },
    })
    .returning();
  return { row: row!, lineup, eligible, coach, season, friendly };
}
