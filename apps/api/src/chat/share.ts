import type { ChatShareInput } from '@offside/contracts';
import type { ChatNewsShare, ChatRoomKey, ChatShare } from '@offside/contracts/chat';
import { and, eq } from 'drizzle-orm';
import { leagueMatches } from '../db/schema.js';
import type { FormationId } from '@offside/contracts/owner-team';
import { teamSeasonAt } from '@offside/contracts/service-seasons';
import {
  careersByIds,
  eligibleCareer,
  eligibleMap,
  friendlyTeamOf,
  layoutOf,
  listMyTeams,
  logoOf,
  peakOf,
  slotIdsOf,
  teamLogosByIds,
  teamPlayerCard,
  toLineupCareer,
  type MatchDetail,
} from '../db/repos/ownerTeams.js';
import type { Db } from '../db/client.js';
import { chatShareText as en } from '../i18n/en/chatShare.js';
import { chatShareText as ja } from '../i18n/ja/chatShare.js';
import { chatShareText as ko } from '../i18n/ko/chatShare.js';
import { chatShareText as zh } from '../i18n/zh/chatShare.js';
import { buildLineup } from '../team/sim.js';
import { toOwnerTeam } from '../team/view.js';

const TEXT = { ko, en, ja, zh } as const;

/** 올리는 때의 팀 · 선수 모습과 옛 앱이 대신 그릴 문장(방 언어). 내 것이 아니거나 없으면 null. */
export async function buildChatShare(
  db: Db,
  profileId: string,
  input: ChatShareInput,
  room: ChatRoomKey,
  now: string,
): Promise<{ body: string; share: ChatShare | ChatNewsShare } | null> {
  if (input.kind === 'leagueMatch') return leagueMatchShare(db, input, room);
  const season = teamSeasonAt(now);
  const teams = await listMyTeams(db, profileId);
  // 시즌 사이 휴식기면 가장 최근 팀.
  const found = teams.find((t) => t.season === season) ?? teams.at(-1);
  const t = TEXT[room];
  if (input.kind === 'player') {
    const [row] = await eligibleCareer(db, profileId, input.careerId);
    if (!row) return null;
    const profile = peakOf(row.peakProfile);
    const player = {
      ...teamPlayerCard(row, profile, toLineupCareer(row, profile)),
      cardValue: row.cardValue,
    };
    const name = player.publicName ?? t.unnamed;
    return {
      body: (row.listingId ? t.listing : t.player)({ name, ovr: player.peak }),
      share: {
        kind: 'player',
        teamId: found?.id ?? null,
        teamName: found?.name ?? null,
        name,
        player,
        ...(row.listingId ? { listing: { id: row.listingId, price: row.listPrice! } } : {}),
      },
    };
  }
  if (!found || !found.filled) return null;
  const team = friendlyTeamOf(found);
  const ids = slotIdsOf(team);
  const eligible = eligibleMap(
    await careersByIds(
      db,
      ids.filter((id): id is string => !!id),
    ),
    profileId,
    team.season,
    team.season === season,
  );
  const formation = team.formation as FormationId;
  const view = toOwnerTeam(
    team,
    buildLineup(formation, ids, eligible, layoutOf(team)),
    eligible,
    room,
  );
  return {
    body: t.team({ name: team.name, ovr: view.ovr }),
    share: {
      kind: 'team',
      teamId: team.id,
      name: team.name,
      manager: team.manager,
      formation,
      ovr: view.ovr,
      logo: logoOf(team),
      record: { w: team.wins, d: team.draws, l: team.losses },
      slots: view.slots.map((s) => ({
        slot: s.slot,
        name: s.name,
        rating: s.rating,
        youth: !s.careerId,
      })),
    },
  };
}

/** T-11-652 끝난 리그 경기 기사(누구 경기든). 팀 이름 · OVR은 경기 기록, 로고는 지금 팀. */
async function leagueMatchShare(
  db: Db,
  input: Extract<ChatShareInput, { kind: 'leagueMatch' }>,
  room: ChatRoomKey,
): Promise<{ body: string; share: ChatNewsShare } | null> {
  const [m] = await db
    .select()
    .from(leagueMatches)
    .where(and(eq(leagueMatches.season, input.season), eq(leagueMatches.id, input.matchId)))
    .limit(1);
  if (!m?.playedAt || m.forfeit || !m.detailJson) return null;
  const d = JSON.parse(m.detailJson) as MatchDetail;
  const logos = await teamLogosByIds(db, [d.home.teamId, d.away.teamId]);
  const side = (s: MatchDetail['home'], goals: number) => ({
    teamId: s.teamId,
    name: s.name,
    logo: logos.get(s.teamId) ?? null,
    ovr: s.ovr,
    goals,
  });
  const share: ChatNewsShare = {
    kind: 'leagueMatch',
    season: m.season,
    matchId: m.id,
    tier: m.tier,
    league: m.leagueNo,
    round: m.round,
    home: side(d.home, m.homeGoals ?? 0),
    away: side(d.away, m.awayGoals ?? 0),
  };
  return {
    body: TEXT[room].league({
      tier: m.tier,
      round: m.round,
      home: share.home.name,
      away: share.away.name,
      score: `${share.home.goals}:${share.away.goals}`,
    }),
    share,
  };
}
