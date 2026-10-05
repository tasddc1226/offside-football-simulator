// T-11-026 구단주 화면(웹 Owner.svelte · 앱 screens/owner/Owner.tsx 공용) — 화면 맨 위 구단주 요약과 '내 팀' 카드가
// 그리기 전에 계산하는 것만 둔다.
import type { OwnerTeamResponse } from './api/team.js';
import { matchHintOf } from './teamOwner.js';
import { ownerText as L } from './i18n/ko/owner.js';
import { teamSeasonLabel } from './seasonName.js';

/** 구단주 요약 — 은퇴 선수 수 · 레전드 점수 합 · 영구결번 수 · 구단 가치(은퇴 가치 합, 만 원). */
export type OwnerSummary = { players: number; score: number; retired: number; value: number };

export function ownerSummary(
  rows: readonly { stats: { score: number }; rn?: number | null | undefined; value: number }[],
): OwnerSummary {
  return {
    players: rows.length,
    score: rows.reduce((s, r) => s + r.stats.score, 0),
    retired: rows.filter((r) => r.rn != null).length,
    value: rows.reduce((s, r) => s + r.value, 0),
  };
}

/** 구단주 화면 '내 팀' 카드 — 팀 상태 요약과 경기하기를 막는 이유(없으면 바로 경기할 수 있다). */
export type OwnerTeamCard = {
  season: string;
  team: OwnerTeamResponse['team'];
  /** 이번 시즌 팀에 넣을 수 있는 내 은퇴 선수 수. */
  players: number;
  left: number;
  perDay: number;
  playHint: string | null;
};

export function ownerTeamCard(d: OwnerTeamResponse): OwnerTeamCard {
  return {
    season: d.seasons.find((o) => o.id === d.season) ? teamSeasonLabel(d.season) : '',
    team: d.team,
    players: d.players.length,
    left: d.matchesLeft,
    perDay: d.matchesPerDay,
    playHint: matchHintOf(d.team, false, d.matchesLeft, d.season, d.current),
  };
}

/** 팀이 없을 때 '내 팀' 카드의 안내. */
export const ownerTeamEmptyText = (c: OwnerTeamCard) =>
  c.players > 0
    ? L.teamEmptyWith({ season: c.season, n: c.players })
    : L.teamEmptyNone({ season: c.season });

/** 비로그인 구단주에게 보이는 잠긴 '내 팀' 카드의 안내. */
export const ownerLockedText = (players: number) => L.locked({ players });
