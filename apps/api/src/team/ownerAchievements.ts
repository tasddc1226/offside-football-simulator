// T-11-028 구단주 한 명의 시즌 업적을 계산하고 점수를 적는다. 업적 화면(GET)·은퇴·팀 저장·팀 경기 뒤와 매일 cron이
// 같은 길로 센다.
import type { FormationId } from '@offside/contracts/owner-team';
import { detailPosInSeason } from '@offside/contracts/positions';
import { retireAtOf, teamSeasonAt, teamSeasonEndsAt } from '@offside/contracts/service-seasons';
import type { Db } from '../db/client.js';
import {
  ACH_REWARD_FIRST_SEASON,
  ACH_REWARD_SEASON_CAP,
  type AchReward,
} from '@offside/contracts/owner-team';
import type { ClubAchievementGroup } from '@offside/contracts';
import {
  achievementClaimsOf,
  achievementRowOf,
  claimAchievementRewards,
  ownerActivityIn,
  saveAchievementScore,
  staleAchievementOwners,
} from '../db/repos/ownerAchievements.js';
import {
  careersByIds,
  eligibleMap,
  layoutOf,
  myTeamIn,
  proClubsOf,
  seasonCareersOf,
  slotIdsOf,
} from '../db/repos/ownerTeams.js';
import { getProfile, hasAccount } from '../db/repos/profiles.js';
import { seasonManagersOf } from '../db/repos/managers.js';
import {
  achRewardSteps,
  achievementScore,
  clubAchievements,
  teamKeptOf,
  withAchRewards,
  type TeamKept,
} from './achievements.js';
import { buildLineup } from './sim.js';
import { cupBestOf } from './cup.js';
import { kstDay } from '../time.js';

type AchFull = { boost: boolean; scout: boolean };
const NOT_FULL: AchFull = { boost: false, scout: false };

/** 적어 둔 팀 업적 기록(team_kept). 없거나 깨졌으면 빈 기록. */
function keptOf(json: string | null | undefined): TeamKept {
  if (!json) return {};
  try {
    return JSON.parse(json) as TeamKept;
  } catch {
    return {};
  }
}

/**
 * 그 시즌 업적을 계산한다(적지는 않는다). T-11-128 asOf가 있으면 그 시각까지 은퇴한 선수·누른 좋아요·건 경기로만
 * 센다 — 시즌 결산이 마감 시각 기준 점수를 다시 셀 때 쓴다.
 */
export async function computeOwnerAchievements(
  db: Db,
  owner: { id: string; nickname: string | null },
  season: number,
  now: string,
  asOf?: string,
) {
  const [allCareers, [seasonTeam], prev, allManagers] = await Promise.all([
    seasonCareersOf(db, owner.id, season),
    myTeamIn(db, owner.id, season),
    achievementRowOf(db, owner.id, season),
    seasonManagersOf(db, owner.id, season),
  ]);
  const managers = asOf ? allManagers.filter((m) => m.finishedAt <= asOf) : allManagers;
  const careersIn = asOf
    ? allCareers.filter((c) => c.retiredAt !== null && c.retiredAt <= asOf)
    : allCareers;
  const open = season === teamSeasonAt(now);
  // T-11-113 시즌이 끝난 뒤 친선전용으로 처음 만든 팀(최종 기록은 빈 팀)은 그 시즌 팀으로 치지 않는다.
  const end = teamSeasonEndsAt(season);
  const team = seasonTeam && !(end && seasonTeam.createdAt >= end) ? seasonTeam : undefined;
  const ids = team ? slotIdsOf(team).filter((id): id is string => id !== null) : [];
  const [activity, slotRows, clubs, cupBest] = await Promise.all([
    ownerActivityIn(db, owner.id, season, team?.id ?? null, asOf),
    careersByIds(db, ids),
    proClubsOf(db, ids),
    team ? cupBestOf(db, owner.id, team.id) : null,
  ]);
  // T-11-103 선발은 화면과 같이 카드로 판정한다 — 영입한 선수도 들어가고, 지금 시즌은 지금 가진 선수만(eligibleMap).
  const eligible = eligibleMap(slotRows, owner.id, season, open);
  const byId = new Map(slotRows.filter((r) => eligible.has(r.id)).map((r) => [r.id, r]));
  const slots = team
    ? buildLineup(team.formation as FormationId, slotIdsOf(team), eligible, layoutOf(team)).map(
        (s) => {
          const r = s.careerId ? byId.get(s.careerId) : undefined;
          return {
            careerId: r ? s.careerId : null,
            fit: s.fit,
            lastClubId: r?.lastClubId ?? null,
            clubIds: (s.careerId && clubs.get(s.careerId)) || [],
            ballon: r?.ballon ?? 0,
            nation: r?.nation ?? null,
            peak: r?.peak ?? 0,
            caps: r?.caps ?? 0,
            retiredNumber: !!r?.rn,
          };
        },
      )
    : null;
  // 팀이 없는 지금 시즌은 빈 팀으로 판정해 팀 업적을 목표로 보인다. 지난 시즌에 팀이 없었으면 팀 업적을 감춘다.
  const teamInput =
    team && slots
      ? {
          slots,
          wins: team.wins,
          bestStreak: team.bestStreak,
          bestMargin: team.bestMargin,
          goalsFor: team.goalsFor,
          rating: team.rating,
          likes: team.likes,
          cupBest,
          coach: !!team.coachId,
        }
      : open
        ? { slots: [], wins: 0, bestStreak: 0, bestMargin: 0, goalsFor: 0, rating: 0, likes: 0 }
        : null;
  const groups = clubAchievements({
    careers: careersIn,
    managers,
    team: teamInput,
    owner: {
      retireDays: new Set(careersIn.flatMap((c) => (c.retiredAt ? [kstDay(c.retiredAt)] : [])))
        .size,
      matchDays: activity.matchDays,
      likesGiven: activity.likesGiven,
      nickname: !!owner.nickname,
    },
    detail: detailPosInSeason(season),
    retireAt: retireAtOf(season),
    kept: keptOf(prev?.teamKept),
  });
  return { groups, prev, players: careersIn.length };
}

/**
 * 그 시즌 업적을 계산해 점수를 적고 업적·점수 행을 돌려준다. touch면 점수가 그대로여도 갱신 시각을 남긴다
 * (saveAchievementScore).
 */
export async function refreshOwnerAchievements(
  db: Db,
  owner: { id: string; nickname: string | null },
  season: number,
  now: string,
  touch: boolean,
) {
  const { groups, prev, players } = await computeOwnerAchievements(db, owner, season, now);
  const kept = teamKeptOf(groups);
  const row = await saveAchievementScore(
    db,
    prev,
    { profileId: owner.id, season },
    {
      ...achievementScore(groups),
      players,
      teamKept: Object.keys(kept).length ? JSON.stringify(kept) : null,
    },
    now,
    touch,
  );
  // T-11-357 지금 시즌이면 새로 달성한 업적의 보상을 준다(지난 시즌은 보상이 끝났다). 보상을 주기 전 시즌은 표시도 없다.
  let shown = groups;
  if (season === teamSeasonAt(now) && season >= ACH_REWARD_FIRST_SEASON) {
    const { got, full } = await settleAchievementRewards(db, owner.id, season, groups, now);
    shown = withAchRewards(groups, got, full);
  }
  return { groups: shown, row, players };
}

/**
 * T-11-357 업적 달성 보상을 맞춘다 — 받은 기록에 없는 달성 업적·단계에 보상을 주고, 업적별로 이 시즌에 받은 보상을
 * 돌려준다. ACH_REWARD_FIRST_SEASON 앞 시즌은 주지 않는다. 보상 칸이 없으면 읽지 않는다. 시즌 상한
 * (ACH_REWARD_SEASON_CAP)을 넘는 칸은 적지도 주지도 않는다 — full은 상한에 닿은 아이템(다음 달성 보상을 감춘다).
 */
export async function settleAchievementRewards(
  db: Db,
  profileId: string,
  season: number,
  groups: readonly ClubAchievementGroup[],
  now: string,
): Promise<{ got: Map<string, AchReward>; full: AchFull }> {
  const steps = achRewardSteps(groups);
  if (season < ACH_REWARD_FIRST_SEASON || !steps.length) return { got: new Map(), full: NOT_FULL };
  const claims = await achievementClaimsOf(db, profileId, season);
  // 이미 받은 만큼을 세고, 새 칸은 상한 안에서 앞에서부터 준다.
  const cap = ACH_REWARD_SEASON_CAP;
  const used = { boost: 0, scout: 0 };
  for (const s of steps) {
    if (!claims.has(s.key)) continue;
    used.boost += s.boost;
    used.scout += s.scout;
  }
  const fresh = steps.filter((s) => {
    if (claims.has(s.key)) return false;
    if (used.boost + s.boost > cap.boost || used.scout + s.scout > cap.scout) return false;
    used.boost += s.boost;
    used.scout += s.scout;
    return true;
  });
  const granted = new Set(
    fresh.length ? await claimAchievementRewards(db, profileId, season, fresh, now) : [],
  );
  const got = new Map<string, AchReward>();
  for (const s of steps) {
    if (!claims.has(s.key) && !granted.has(s.key)) continue;
    const g = got.get(s.id) ?? { boost: 0, scout: 0 };
    got.set(s.id, { boost: g.boost + s.boost, scout: g.scout + s.scout });
  }
  const full = { boost: used.boost >= cap.boost, scout: used.scout >= cap.scout };
  return { got, full };
}

/**
 * 은퇴·팀 저장·팀 경기 뒤에 점수를 다시 센다(응답 뒤 waitUntil). 로그인 수단이 없는 프로필은 구단주가 아니라 건너뛴다.
 * 실패해도 응답에는 영향이 없다 — 다음 업적 화면이나 cron이 다시 센다.
 */
export async function refreshAfterChange(db: Db, profileId: string, season: number | null) {
  if (season === null) return;
  const profile = await getProfile(db, profileId);
  if (!profile || !hasAccount(profile) || profile.deletedAt) return;
  await refreshOwnerAchievements(db, profile, season, new Date().toISOString(), true);
}

/**
 * 매일 cron: 놓친 구단주의 점수를 다시 센다(한 번에 limit명 — 남으면 다음 날 이어서). 구단주마다 D1을 9번쯤
 * 부르므로(T-11-357 업적 보상 읽기·쓰기 포함) 한 번 호출의 하위 요청 한도(1,000) 안에 들도록 80명으로 끊는다.
 */
export async function rebuildStaleAchievements(db: Db, now: string, limit = 80) {
  const season = teamSeasonAt(now);
  if (season === null) return { season, refreshed: 0 };
  const ids = await staleAchievementOwners(db, season, limit);
  for (const id of ids) await refreshAfterChange(db, id, season);
  return { season, refreshed: ids.length };
}
