// T-10-092 구단주 팀 화면의 순수 로직(웹 team/Team.svelte · 앱 screens/owner/Team.tsx 공용, T-11-005).
// 편성(자동 배치·자리 바꾸기)·선수 고르기 후보·업적 표기·경기 결과 표기처럼 화면이 그리기 전에 계산하는 것만 둔다.
import { FACE_ABBR, GK_ABBR } from '@offside/game/attributes';
import { ATTR_KEYS } from '@offside/game/data';
import {
  LINEUP_SIZE,
  YOUTH_OVR,
  slotFit,
  slotRating,
  type DetailPos,
} from '@offside/contracts/owner-team';
import type { ClubAchievement, OwnerTeam, TeamMatch, TeamPlayer } from './api/team.js';
import { num } from './teamText.js';

/** 선수 고르기 정렬 — 그 자리 실력 · 레전드 점수 · 최고 OVR. */
export type PickSort = 'fit' | 'score' | 'peak';
export const PICK_SORTS = [
  ['fit', '자리 실력'],
  ['score', '레전드 점수'],
  ['peak', '최고 OVR'],
] as const satisfies readonly (readonly [PickSort, string])[];

export type PickCandidate = {
  p: TeamPlayer;
  /** 그 자리에서의 실력. */
  rating: number;
  /** 그 자리 적합도(0~1). */
  fit: number;
  /** 이미 편성된 자리(없으면 -1). */
  at: number;
};

/** 고른 자리(picking)에 넣을 수 있는 선수 목록을 정렬해 돌려준다. */
export function pickCandidates(
  slotCodes: readonly DetailPos[],
  picking: number,
  players: readonly TeamPlayer[],
  slots: readonly (string | null)[],
  sort: PickSort,
): PickCandidate[] {
  const slot = slotCodes[picking]!;
  return players
    .map((p) => {
      const rating = slotRating(slot, p);
      return { p, rating, fit: slotFit(slot, p, rating), at: slots.indexOf(p.careerId) };
    })
    .sort((a, b) =>
      sort === 'score'
        ? (b.p.legendScore ?? 0) - (a.p.legendScore ?? 0) || b.rating - a.rating
        : sort === 'peak'
          ? b.p.peak - a.p.peak || b.rating - a.rating
          : b.rating - a.rating || b.p.peak - a.p.peak,
    );
}

/** 최고 시점 대표 능력치 한 줄(골키퍼는 골키퍼 능력치 이름). */
export const attrLine = (p: TeamPlayer): string | null =>
  p.attrs
    ? ATTR_KEYS.map((k) => `${(p.pos === 'GK' ? GK_ABBR : FACE_ABBR)[k]} ${p.attrs![k]}`).join(
        ' · ',
      )
    : null;

/** 고른 자리에 선수를 넣는다. 이미 다른 자리에 있던 선수면 두 자리를 맞바꾼다. */
export function assignSlot(
  slots: readonly (string | null)[],
  picking: number,
  id: string | null,
): (string | null)[] {
  const next = [...slots];
  const from = id ? next.indexOf(id) : -1;
  if (from >= 0) next[from] = next[picking] ?? null;
  next[picking] = id;
  return next;
}

/** 실력이 같으면 먼저 채울 자리(스트라이커·골키퍼·센터백 …). */
const FILL_ORDER = ['ST', 'GK', 'CB', 'CM', 'AM', 'DM', 'W', 'FB'];

/** 자리마다 가장 잘 맞는 선수부터 채운다(유스 선수보다 나을 때만). */
export function autoFillSlots(
  slotCodes: readonly DetailPos[],
  players: readonly TeamPlayer[],
): (string | null)[] {
  const next: (string | null)[] = Array(LINEUP_SIZE).fill(null);
  const order = slotCodes
    .map((slot, i) => ({ slot, i }))
    .sort((a, b) => FILL_ORDER.indexOf(a.slot) - FILL_ORDER.indexOf(b.slot));
  for (;;) {
    let best: { i: number; id: string; r: number } | null = null;
    for (const { slot, i } of order) {
      if (next[i] !== null) continue;
      for (const p of players) {
        if (next.includes(p.careerId)) continue;
        const r = slotRating(slot, p);
        if (r > YOUTH_OVR && (!best || r > best.r)) best = { i, id: p.careerId, r };
      }
    }
    if (!best) break;
    next[best.i] = best.id;
  }
  return next;
}

/** 경기하기 버튼 밑에 보이는 못 하는 이유(할 수 있으면 null). */
export function playHintOf(
  team: OwnerTeam | null,
  dirty: boolean,
  matchesLeft: number,
): string | null {
  return !team
    ? '팀을 저장하면 경기할 수 있어요.'
    : dirty
      ? '바꾼 편성을 저장해야 경기할 수 있어요.'
      : team.slots.every((s) => s.careerId === null)
        ? '은퇴 선수를 한 명 이상 넣어야 경기할 수 있어요.'
        : matchesLeft === 0
          ? '오늘 경기는 모두 치렀어요. 한국 시각 자정에 다시 열려요.'
          : null;
}

// ───────── 시즌 업적 ─────────
export const achDone = (items: ClubAchievement[]) => items.filter((i) => i.done).length;
/** 업적 한 줄의 오른쪽 표시. */
export const achState = (i: ClubAchievement): string =>
  i.level !== undefined
    ? `${i.level}단계 · ${num(i.cur ?? 0)}${i.unit ?? ''}${i.next != null ? ` · NEXT ${num(i.next)}` : ' · 최고 단계'}`
    : i.max !== undefined
      ? `${i.cur ?? 0} / ${i.max}`
      : i.done
        ? '달성 완료'
        : '미달성';

// ───────── 경기 결과 ─────────
export type Outcome = '승' | '무' | '패';
export const outcomeOf = (m: TeamMatch): Outcome => {
  const mine = m[m.mine].goals;
  const theirs = m[m.mine === 'home' ? 'away' : 'home'].goals;
  return mine > theirs ? '승' : mine < theirs ? '패' : '무';
};
export const OUTCOME_TITLE = { 승: '승리', 무: '무승부', 패: '패배' } as const;
export const pct = (f: number) => `${Math.round(f * 100)}%`;
