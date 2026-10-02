// T-11-028 구단주 한 명의 시즌 업적을 계산하고 점수를 적는다. 업적 화면(GET)·은퇴·팀 저장·팀 경기 뒤와 매일 cron이
// 같은 길로 센다.
import type { FormationId } from '@offside/contracts/owner-team';
import { detailPosInSeason } from '@offside/contracts/positions';
import { teamSeasonAt } from '@offside/contracts/service-seasons';
import type { Db } from '../db/client.js';
import {
  achievementRowOf,
  ownerActivityIn,
  saveAchievementScore,
  staleAchievementOwners,
} from '../db/repos/ownerAchievements.js';
import { myTeamIn, seasonCareersOf, slotIdsOf } from '../db/repos/ownerTeams.js';
import { getProfile, hasAccount } from '../db/repos/profiles.js';
import { achievementScore, clubAchievements } from './achievements.js';
import { buildLineup } from './sim.js';
import { kstDay } from '../time.js';

/** 한국 시각 날짜(YYYY-MM-DD). */

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
  const [careersIn, [team], prev] = await Promise.all([
    seasonCareersOf(db, owner.id, season),
    myTeamIn(db, owner.id, season),
    achievementRowOf(db, owner.id, season),
  ]);
  const activity = await ownerActivityIn(db, owner.id, season, team?.id ?? null);
  // 그 시즌 팀에 넣을 수 있는 선수 = 이 시즌 은퇴 선수라 선발도 careersIn에서 만든다.
  const byId = new Map(careersIn.map((r) => [r.id, r]));
  const slots = team
    ? buildLineup(
        team.formation as FormationId,
        slotIdsOf(team),
        new Map(careersIn.map((r) => [r.id, r.lineup])),
      ).map((s) => {
        const r = s.careerId ? byId.get(s.careerId) : undefined;
        return {
          careerId: r ? s.careerId : null,
          fit: s.fit,
          lastClubId: r?.lastClubId ?? null,
          caps: r?.caps ?? 0,
          retiredNumber: r?.retiredNumber ?? false,
        };
      })
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
      : season === teamSeasonAt(now)
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
  });
  const row = await saveAchievementScore(
    db,
    prev,
    { profileId: owner.id, season },
    { ...achievementScore(groups), players: careersIn.length },
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
 * 매일 cron: 놓친 구단주의 점수를 다시 센다(한 번에 limit명 — 남으면 다음 날 이어서). 구단주마다 D1을 6번쯤 부르므로
 * 한 번 호출의 하위 요청 한도(1,000) 안에 들도록 100명으로 끊는다.
 */
export async function rebuildStaleAchievements(db: Db, now: string, limit = 100) {
  const season = teamSeasonAt(now);
  if (season === null) return { season, refreshed: 0 };
  const ids = await staleAchievementOwners(db, season, limit);
  for (const id of ids) await refreshAfterChange(db, id, season);
  return { season, refreshed: ids.length };
}
