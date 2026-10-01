// T-11-026 구단주 화면(웹 Owner.svelte · 앱 screens/owner/Owner.tsx 공용) — 화면 맨 위 구단주 요약과 '내 팀' 카드가
// 그리기 전에 계산하는 것만 둔다.
import type { OwnerTeamResponse } from './api/team.js';
import { matchHintOf } from './teamOwner.js';

/** 구단주 요약 — 은퇴 선수 수 · 레전드 점수 합 · 영구결번 수. */
export type OwnerSummary = { players: number; score: number; retired: number };

export function ownerSummary(
  rows: readonly { stats: { score: number }; rn?: number | null | undefined }[],
): OwnerSummary {
  return {
    players: rows.length,
    score: rows.reduce((s, r) => s + r.stats.score, 0),
    retired: rows.filter((r) => r.rn != null).length,
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
    season: d.seasons.find((o) => o.id === d.season)?.name ?? '',
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
    ? `${c.season}에 은퇴한 내 선수 ${c.players}명으로 팀을 꾸릴 수 있어요. 빈 자리는 유스 선수가 채워요.`
    : `${c.season}에 뛰고 은퇴한 선수가 생기면 팀을 꾸릴 수 있어요. 커리어를 끝까지 뛰어 보세요.`;

/** 비로그인 구단주에게 보이는 잠긴 '내 팀' 카드의 안내. */
export const ownerLockedText = (players: number) =>
  `로그인하면 ${players > 0 ? `은퇴한 선수 ${players}명으로` : '은퇴한 선수로'} 팀을 꾸려 다른 구단주와 겨뤄요. 하루 경기와 라이브 랭킹, 시즌 업적이 열려요.`;
