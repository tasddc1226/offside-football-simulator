// T-11-150 구단주 프로필 — 시즌을 넘어 쌓이는 기록을 모은다. 끝난 시즌은 마감 때 굳힌 결산(owner_season_records), 지금
// 시즌은 지금 업적 점수(owner_achievements)와 지금 팀 순위를 쓴다.
import type { OwnerProfile } from '@offside/contracts';
import { teamSeasonAt, teamSeasonName } from '@offside/contracts/service-seasons';
import { and, count, desc, eq, isNotNull, sql } from 'drizzle-orm';
import type { Lang } from '../../lang.js';
import { cupHonorsOf } from '../../team/cup.js';
import type { Db } from '../client.js';
import {
  careers,
  ownerAchievements,
  ownerSeasonRecords,
  ownerTeams,
  retiredNumbers,
} from '../schema.js';
import { ownerTierOfProfile } from './ownerTiers.js';
import { logoOf, ratingRankOf } from './ownerTeams.js';

export async function ownerProfileOf(
  db: Db,
  profile: { id: string; nickname: string | null; title: string | null },
  now: string,
  lang: Lang,
): Promise<OwnerProfile> {
  const id = profile.id;
  const current = teamSeasonAt(now);
  const [tier, cupHonors, teams, records, [live], [rn], [retired]] = await Promise.all([
    ownerTierOfProfile(db, id, now),
    cupHonorsOf(db, id),
    db
      .select()
      .from(ownerTeams)
      .where(eq(ownerTeams.profileId, id))
      .orderBy(desc(ownerTeams.season))
      .limit(2), // 가장 최근 팀과 지금 시즌 팀이면 된다
    db
      .select()
      .from(ownerSeasonRecords)
      .where(eq(ownerSeasonRecords.profileId, id))
      .orderBy(ownerSeasonRecords.season),
    current === null
      ? []
      : db
          .select({ score: ownerAchievements.score })
          .from(ownerAchievements)
          .where(and(eq(ownerAchievements.profileId, id), eq(ownerAchievements.season, current))),
    db
      .select({ n: count() })
      .from(retiredNumbers)
      .innerJoin(careers, eq(careers.id, retiredNumbers.careerId))
      .where(and(eq(careers.profileId, id), eq(careers.hidden, 0))),
    db
      .select({ n: count() })
      // Avoid the global HOF peak index: this count must scan only this owner's retired players.
      .from(sql`${careers} INDEXED BY careers_profile_status_legend_idx`)
      .where(
        and(
          eq(careers.profileId, id),
          eq(careers.status, 'retired'),
          eq(careers.hidden, 0),
          isNotNull(careers.peak),
        ),
      ),
  ]);
  const latest = teams[0];
  const nowTeam = current === null ? undefined : teams.find((t) => t.season === current);
  const liveRank = nowTeam ? await ratingRankOf(db, nowTeam) : null;
  const seasons: OwnerProfile['seasons'] = records.map((r) => ({
    season: r.season,
    name: teamSeasonName(r.season, lang),
    achScore: r.achScore,
    teamName: r.teamName,
    teamRank: r.teamRank,
    closed: true,
  }));
  if (current !== null && !records.some((r) => r.season === current) && (live || nowTeam))
    seasons.push({
      season: current,
      name: teamSeasonName(current, lang),
      achScore: live?.score ?? null,
      teamName: nowTeam?.name ?? null,
      teamRank: liveRank,
      closed: false,
    });
  const ranks = seasons.flatMap((s) => (s.teamRank ? [s.teamRank] : []));
  return {
    nickname: profile.nickname,
    title: profile.title,
    tier,
    team: latest
      ? {
          id: latest.id,
          name: latest.name,
          manager: latest.manager,
          logo: logoOf(latest),
          season: latest.season,
          seasonName: teamSeasonName(latest.season, lang),
        }
      : null,
    cupHonors,
    seasons,
    stats: {
      retiredNumbers: Number(rn?.n ?? 0),
      retired: Number(retired?.n ?? 0),
      bestTeamRank: ranks.length ? Math.min(...ranks) : null,
    },
  };
}
