// T-10-092 팀 응답을 만드는 공통 부분(내 팀 화면 · 공개 팀 프로필).
import type { TeamLines, TeamRecord, TeamSlot, TeamSeasonOption } from '@offside/contracts';
import { openTeamSeasons, teamSeasonName } from '@offside/contracts/service-seasons';
import { synergyApplies } from '@offside/contracts/owner-team';
import type { OwnerTeamRow } from '../db/repos/ownerTeams.js';
import type { Lang } from '../lang.js';
import { anonText } from './anon.js';
import { lineupLines, lineupSynergy, type LineupSlot } from './sim.js';

export const recordOf = (t: Pick<OwnerTeamRow, 'wins' | 'draws' | 'losses'>): TeamRecord => ({
  w: t.wins,
  d: t.draws,
  l: t.losses,
});

/** 선발 11자리 표시 — 이름은 공개 이름, 없으면 익명 표기(유스 선수 포함). */
export const slotsOf = (
  lineup: readonly LineupSlot[],
  players?: ReadonlyMap<string, { nation?: string | null; season?: number }>,
  lang: Lang = 'ko',
): TeamSlot[] =>
  lineup.map((s) => {
    const p = s.careerId ? players?.get(s.careerId) : undefined;
    return {
      slot: s.slot,
      careerId: s.careerId,
      name: s.publicName ?? anonText(s.ref.anon, lang),
      pos: s.pos,
      nation: p?.nation ?? null,
      ...(p?.season !== undefined ? { season: p.season } : {}),
      rating: s.rating,
      fit: s.fit,
    };
  });

/** 줄 힘. 시너지 반영 시즌(T-11-105)이면 경기와 같게 시너지 보정을 더한다. */
export function linesOf(lineup: readonly LineupSlot[], season: number): TeamLines {
  const l = lineupLines(lineup, synergyApplies(season) ? lineupSynergy(lineup) : null);
  return {
    atk: Math.round(l.atk),
    mid: Math.round(l.mid),
    def: Math.round(l.def),
    gk: Math.round(l.gk),
  };
}

/** 고를 수 있는 팀 시즌 목록(프리시즌 + 개막한 시즌). */
export const seasonOptions = (now: string, lang: Lang = 'ko'): TeamSeasonOption[] =>
  openTeamSeasons(now).map((id) => ({ id, name: teamSeasonName(id, lang) }));
