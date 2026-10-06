// T-11-028 구단주 한 명의 시즌 업적을 계산하고 점수를 적는다. 업적 화면(GET)·은퇴·팀 저장·팀 경기 뒤와 매일 cron이
// 같은 길로 센다.
import type { FormationId } from '@offside/contracts/owner-team';
import { detailPosInSeason } from '@offside/contracts/positions';
import { retireAtOf, teamSeasonAt, teamSeasonEndsAt } from '@offside/contracts/service-seasons';
import type { Db } from '../db/client.js';
import {
  achievementRowOf,
  ownerActivityIn,
  saveAchievementScore,
  staleAchievementOwners,
} from '../db/repos/ownerAchievements.js';
import {
  careersByIds,
  eligibleMap,
  layoutOf,
  myTeamIn,
  seasonCareersOf,
  slotIdsOf,
} from '../db/repos/ownerTeams.js';
import { getProfile, hasAccount } from '../db/repos/profiles.js';
import { achievementScore, clubAchievements, teamKeptOf, type TeamKept } from './achievements.js';
import { buildLineup } from './sim.js';
import { kstDay } from '../time.js';

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
  const [careersIn, [seasonTeam], prev] = await Promise.all([
    seasonCareersOf(db, owner.id, season),
    myTeamIn(db, owner.id, season),
    achievementRowOf(db, owner.id, season),
  ]);
  const open = season === teamSeasonAt(now);
  // T-11-113 시즌이 끝난 뒤 친선전용으로 처음 만든 팀(최종 기록은 빈 팀)은 그 시즌 팀으로 치지 않는다.
  const end = teamSeasonEndsAt(season);
  const team = seasonTeam && !(end && seasonTeam.createdAt >= end) ? seasonTeam : undefined;
  const ids = team ? slotIdsOf(team).filter((id): id is string => id !== null) : [];
  const [activity, slotRows] = await Promise.all([
    ownerActivityIn(db, owner.id, season, team?.id ?? null),
    careersByIds(db, ids),
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
        }
      : open
        ? { slots: [], wins: 0, bestStreak: 0, bestMargin: 0, goalsFor: 0, rating: 0, likes: 0 }
        : null;
  const groups = clubAchievements({
    careers: careersIn,
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
  const kept = teamKeptOf(groups);
  const row = await saveAchievementScore(
    db,
    prev,
    { profileId: owner.id, season },
    {
      ...achievementScore(groups),
      players: careersIn.length,
      teamKept: Object.keys(kept).length ? JSON.stringify(kept) : null,
    },
    now,
    touch,
  );
  return { groups, row, players: careersIn.length };
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
 * 매일 cron: 놓친 구단주의 점수를 다시 센다(한 번에 limit명 — 남으면 다음 날 이어서). 구단주마다 D1을 7번쯤 부르므로
 * 한 번 호출의 하위 요청 한도(1,000) 안에 들도록 100명으로 끊는다.
 */
export async function rebuildStaleAchievements(db: Db, now: string, limit = 100) {
  const season = teamSeasonAt(now);
  if (season === null) return { season, refreshed: 0 };
  const ids = await staleAchievementOwners(db, season, limit);
  for (const id of ids) await refreshAfterChange(db, id, season);
  return { season, refreshed: ids.length };
}
