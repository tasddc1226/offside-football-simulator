import type { ChatShareInput } from '@offside/contracts';
import type { ChatRoomKey, ChatShare } from '@offside/contracts/chat';
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
  teamPlayerCard,
  toLineupCareer,
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
): Promise<{ body: string; share: ChatShare } | null> {
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
