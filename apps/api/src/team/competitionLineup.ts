// Competition mutation policy. Shared by team, card and market use cases; no router registration.
import {
  cupById,
  cupLineupVerdict,
  fitsDivision,
  pastCardsIn,
  type CupDef,
} from '@offside/contracts/cup';
import type { Db } from '../db/client.js';
import {
  careersByIds,
  cupTeamOf,
  myTeamIn,
  slotIdsOf,
  type OwnerTeamRow,
} from '../db/repos/ownerTeams.js';
import { countOpenListingsAmong } from '../db/repos/market.js';
import { cupKo } from '../cupText.js';
import { conflictError } from '../routes/shared.js';
import {
  activeCupSeasonsQuery,
  activeEntriesOf,
  cupMatchesIn,
  lineupLocked,
  type CupEntryRow,
} from './cup.js';
import { cupSchedule } from './cupSchedule.js';
import { leagueLineupLocked } from './leagueRead.js';

/**
 * T-11-656 이번 시즌 선수 컵이면 명단 카드 중 컵 시즌보다 앞 시즌 카드 수(아니면 0, 조회하지 않는다). 카드 시즌은 cards 행으로
 * 본다(내 선수 판정과 같은 careersByIds, PK 조회).
 */
export async function pastCardsAmong(db: Db, cup: CupDef, ids: readonly string[]) {
  if (!cup.seasonCardsOnly || !ids.length) return 0;
  const rows = await careersByIds(db, [...ids]);
  return pastCardsIn(
    rows.map((r) => ({ season: r.serviceSeason })),
    cup.season,
  );
}

/** 컵에 참가 중인(탈락 전) 이 시즌 대회. 경기 목록은 명단 잠금 검사에서만 읽는다. */
async function activeCups(db: Db, profileId: string, season: number) {
  const rows = await activeEntriesOf(db, profileId);
  if (!rows.length) return [];
  const all = await cupSchedule(db);
  const out: { cup: CupDef; entry: CupEntryRow }[] = [];
  for (const entry of rows) {
    const cup = cupById(entry.cupId, all);
    if (!cup || cup.season !== season) continue;
    out.push({ cup, entry });
  }
  return out;
}

/**
 * T-11-145 팀 저장 검사(R1·R2·R5): 컵 참가 중이면 경기 1시간 전부터 그 경기가 끝날 때까지 명단을 못 바꾸고, 실제 선수가
 * 자격 수보다 적어지거나 이적시장에 내놓은 선수를 선발에 넣을 수 없다.
 */
export async function checkCupLineup(
  db: Db,
  profileId: string,
  season: number,
  ids: readonly string[],
  filled: number,
  now: string,
  ovr: number,
  /**
   * T-11-570 league: 리그 잠금을 본다(팀 명단 · 감독). cup: 이 명단이 컵 명단이다 — 컵 명단 프리셋이 따로 있는 팀의 팀 저장은
   * false로 불러 컵 검사를 건너뛰고, 프리셋 저장은 league를 false로 불러 컵 검사만 한다.
   */
  { league = true, cup = true }: { league?: boolean; cup?: boolean } = {},
) {
  // T-11-418b 리그 경기도 1시간 전부터 끝날 때까지 명단을 잠근다.
  if (league && (await leagueLineupLocked(db, profileId, season, now)))
    throw conflictError(cupKo('leagueLocked'), 'LEAGUE_LINEUP_LOCKED');
  if (!cup) return;
  const active = await activeCups(db, profileId, season);
  if (!active.length) return;
  const matches = await cupMatchesIn(
    db,
    active.map(({ cup }) => cup.id),
  );
  let listed: Promise<number> | undefined;
  for (const { cup, entry } of active) {
    // T-11-436 편성 화면 줄과 같은 판정(cupLineupVerdict). T-11-410 구간 대회는 추첨 뒤 탈락 전까지 상한을 넘는 명단으로
    // 바꿀 수 없다(접수 중에는 신청을 옮기면 된다).
    const verdict = cupLineupVerdict(cup, { ovr, filled }, now);
    if (verdict.capBlocks)
      throw conflictError(
        cupKo('ovrCap', { division: cupKo(cup.division!), n: cup.ovrMax ?? 0 }),
        'CUP_OVR_CAP',
      );
    if (
      lineupLocked(
        matches.filter((m) => m.cupId === cup.id),
        entry.teamId,
        now,
      )
    )
      throw conflictError(cupKo('lineupLocked'), 'CUP_LINEUP_LOCKED');
    if (verdict.short)
      throw conflictError(cupKo('minFilled', { n: cup.minFilled }), 'CUP_MIN_FILLED');
    // T-11-656 이번 시즌 선수 컵이면 컵 명단에 지난 시즌 카드를 넣을 수 없다.
    if ((await pastCardsAmong(db, cup, ids)) > 0)
      throw conflictError(cupKo('pastCards', { season: cup.season }), 'CUP_PAST_CARDS');
    if ((await (listed ??= countOpenListingsAmong(db, ids))) > 0)
      throw conflictError(cupKo('cardListed'), 'CUP_CARD_LISTED');
  }
}

/**
 * 참가 중인(탈락 전) 컵의 선발 선수. 대회 시즌의 팀 명단을 본다 — T-11-552 시즌이 넘어간 뒤에도 끝나지 않은 지난 시즌 컵
 * (시즌 1 제3회)의 선발을 지킨다. T-11-570 컵 명단 프리셋이 있으면 그 프리셋 선발이다.
 */
export async function cupLineupIds(
  db: Db,
  profileId: string,
  known?: { season: number; team: OwnerTeamRow | undefined },
): Promise<Set<string>> {
  const out = new Set<string>();
  for (const { season } of await activeCupSeasonsQuery(db, profileId)) {
    const [team] = known?.season === season ? [known.team] : await myTeamIn(db, profileId, season);
    for (const id of team ? slotIdsOf(cupTeamOf(team)) : []) if (id) out.add(id);
  }
  return out;
}

/** T-11-310 감독 전향 검사: 컵 참가 중이면 선발에 든 선수는 감독이 될 수 없다(명단이 비면 대회 최소 인원이 깨진다). */
export async function checkCupManager(db: Db, profileId: string, careerId: string) {
  if ((await cupLineupIds(db, profileId)).has(careerId))
    throw conflictError(cupKo('cardManager'), 'CUP_CARD_LOCKED');
}

/** T-11-145 판매 등록 검사(R2): 컵 참가 중이면 선발에 든 선수는 내놓을 수 없다. */
export async function checkCupListing(db: Db, profileId: string, careerId: string) {
  if ((await cupLineupIds(db, profileId)).has(careerId))
    throw conflictError(cupKo('cardLocked'), 'CUP_CARD_LOCKED');
}

/** T-11-552 방출 검사: 컵 참가 중이면 선발에 든 선수는 방출할 수 없다(시즌이 넘어간 지난 시즌 컵 명단 포함). */
export async function checkCupRelease(db: Db, profileId: string, careerIds: readonly string[]) {
  const ids = await cupLineupIds(db, profileId);
  if (careerIds.some((id) => ids.has(id)))
    throw conflictError(cupKo('cardReleaseLocked'), 'CUP_CARD_LOCKED');
}

/**
 * T-11-373 카드 강화 검사. T-11-655 컵 명단 선수도 리그와 같이 경기 1시간 전부터 그 경기가 끝날 때까지만 막는다 — 그 밖에는
 * 명단에서 빼고 강화한 뒤 다시 넣을 수 있어 막아도 지키는 게 없다. 지키는 것은 둘이다: 예상(배당)이 고정되는 잠금 시간에는
 * 명단과 강화가 함께 묶이고, 추첨 뒤에는 강화에 성공했을 때 컵 명단 OVR이 구간 상한을 넘는 시도를 막는다(명단을 다시 저장할
 * 때와 같은 상한 검사). 끝나지 않은 지난 시즌 컵의 명단은 그 시즌 팀으로 다시 셀 수 없어 지금처럼 대회 끝까지 막는다.
 * cupOvrAfter: 이번 시즌 팀에서 강화에 성공했을 때의 컵 명단 OVR(그 카드가 이번 시즌 컵 명단에 없으면 null).
 */
export async function checkCupEnhance(
  db: Db,
  profileId: string,
  careerId: string,
  season: number | null,
  now: string,
  team: OwnerTeamRow | undefined,
  cupOvrAfter: () => number | null = () => null,
) {
  const cap = await cupEnhanceGuard(db, profileId, careerId, season, now, team);
  const after = cap.capped ? cupOvrAfter() : null;
  if (after !== null) cap.check(after);
}

/**
 * T-11-679 checkCupEnhance의 본체. 잠금(컵 · 리그)은 바로 던지고, 추첨 뒤 컵 구간 상한은 OVR을 받아 재는 함수로 돌려준다 —
 * 자동 강화가 단계마다 DB를 다시 읽지 않고 '성공하면 상한을 넘는가'를 잰다. capped가 false면 상한을 잴 컵이 없다.
 */
export async function cupEnhanceGuard(
  db: Db,
  profileId: string,
  careerId: string,
  season: number | null,
  now: string,
  team: OwnerTeamRow | undefined,
) {
  const capCups: NonNullable<ReturnType<typeof cupById>>[] = [];
  const entries = await activeEntriesOf(db, profileId);
  if (entries.length) {
    const all = await cupSchedule(db);
    const mine = entries.flatMap((entry) => {
      const cup = cupById(entry.cupId, all);
      return cup ? [{ cup, entry }] : [];
    });
    const teams = new Map<number, OwnerTeamRow | undefined>();
    const teamIn = async (s: number) => {
      if (!teams.has(s)) teams.set(s, s === season ? team : (await myTeamIn(db, profileId, s))[0]);
      return teams.get(s);
    };
    let matches: Awaited<ReturnType<typeof cupMatchesIn>> | undefined;
    for (const { cup, entry } of mine) {
      const row = await teamIn(cup.season);
      if (!row || !slotIdsOf(cupTeamOf(row)).includes(careerId)) continue;
      if (cup.season !== season) throw conflictError(cupKo('cardEnhance'), 'CUP_CARD_LOCKED');
      matches ??= await cupMatchesIn(
        db,
        mine.map(({ cup: c }) => c.id),
      );
      if (
        lineupLocked(
          matches.filter((m) => m.cupId === cup.id),
          entry.teamId,
          now,
        )
      )
        throw conflictError(cupKo('cardEnhance'), 'CUP_CARD_LOCKED');
      if (now >= cup.drawAt) capCups.push(cup);
    }
  }
  if (season !== null && (await leagueLineupLocked(db, profileId, season, now))) {
    if (team && slotIdsOf(team).includes(careerId))
      throw conflictError(cupKo('leagueEnhance'), 'LEAGUE_LINEUP_LOCKED');
  }
  const over = (ovr: number) => capCups.find((cup) => !fitsDivision(cup, ovr));
  return {
    capped: capCups.length > 0,
    /** 이 컵 명단 OVR이 어느 컵 구간 상한을 넘으면 true. */
    exceeds: (ovr: number) => !!over(ovr),
    /** 넘으면 강화 한 번과 같은 409를 던진다. */
    check(ovr: number) {
      const cup = over(ovr);
      if (cup)
        throw conflictError(
          cupKo('enhanceCap', { division: cupKo(cup.division!), n: cup.ovrMax ?? 0 }),
          'CUP_OVR_CAP',
        );
    },
  };
}
