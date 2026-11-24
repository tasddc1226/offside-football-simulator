/**
 * T-11-825 원정 투어 편성 계산(서버 · 웹 · 앱 공용, zod 없음). 제한 아래에서 뛸 수 있는 카드를 가르고, 자리마다 가장 잘 맞는 선수를
 * 놓는 자동 편성을 만든다. 서버의 편성 검사 · 경기 계산은 apps/api/src/team/squadTour.ts.
 */
import { FORMATIONS, slotRating, type FormationId, type SlotPlayer } from './owner-team.js';
import {
  TOUR_LIVE,
  tourCapKey,
  tourCapMax,
  tourEligible,
  tourPlain,
  tourStarterOk,
  type TourCard,
  type TourRule,
} from './squad-tour.js';

/** 편성에 쓰는 카드 값: 자리 실력을 잴 값 + 제한을 따질 값. */
export type TourPick = SlotPlayer & { id: string } & Omit<TourCard, 'peak' | 'enhance' | 'type'>;

export const tourPickCard = (c: TourPick): TourCard => ({
  peak: c.peak,
  enhance: c.enhance ?? 0,
  season: c.season,
  nation: c.nation,
  type: c.type ?? null,
  mainLeague: c.mainLeague,
});

/** 카드 한 장이 그 경기에 뛸 수 있는가(카드 한 장으로 가르는 제한만 본다). */
export const tourPlayable = (rules: readonly TourRule[], c: TourPick, season: number): boolean =>
  rules.every((r) => tourEligible(r, tourPickCard(c), season));

/** 선발로 세울 수 있는가: 그 경기에 뛸 수 있고 이번 시즌 카드다. */
export const tourStartable = (rules: readonly TourRule[], c: TourPick, season: number): boolean =>
  tourStarterOk(c, season) && tourPlayable(rules, c, season);

/** 강화 OVR을 빼고 재는 경기면 강화 단계를 0으로 본 자리 실력. */
export const tourSlotRating = (
  slot: Parameters<typeof slotRating>[0],
  c: TourPick,
  rules: readonly TourRule[],
): number => slotRating(slot, tourPlain(rules) ? { ...c, enhance: 0 } : c);

/**
 * 자동 편성: 선발로 세울 수 있는(이번 시즌) 카드로 자리 실력이 높은 조합부터 놓는다(욕심쟁이). 선발 전체 제한(같은 유형 · 국적 · 리그 인원)을 넘기지
 * 않고, 용병보다 못한 자리는 비워 둔다(현지 용병이 뛴다). 실력이 같으면 내 카드를 세운다.
 */
export function tourAutoPick(
  formation: FormationId,
  cards: readonly TourPick[],
  rules: readonly TourRule[],
  season: number,
  merc: number,
): (string | null)[] {
  const slots = FORMATIONS[formation];
  const pool = cards.filter((c) => tourStartable(rules, c, season));
  const pairs: { i: number; c: TourPick; r: number }[] = [];
  slots.forEach((slot, i) => {
    for (const c of pool) {
      const r = tourSlotRating(slot, c, rules);
      if (r >= merc) pairs.push({ i, c, r });
    }
  });
  pairs.sort((a, b) => b.r - a.r);
  const out: (string | null)[] = slots.map(() => null);
  const used = new Set<string>();
  const counts = rules.map(() => new Map<string, number>());
  for (const p of pairs) {
    if (out[p.i] !== null || used.has(p.c.id)) continue;
    const card = tourPickCard(p.c);
    const keys = rules.map((r) => (tourCapMax(r) === null ? null : tourCapKey(r, card)));
    if (keys.some((k, j) => k !== null && (counts[j]!.get(k) ?? 0) >= tourCapMax(rules[j]!)!))
      continue;
    keys.forEach((k, j) => k !== null && counts[j]!.set(k, (counts[j]!.get(k) ?? 0) + 1));
    out[p.i] = p.c.id;
    used.add(p.c.id);
  }
  return out;
}

/** 자동 교체 명단: 선발에 없는 뛸 수 있는 카드 가운데 최고 OVR 순으로 TOUR_LIVE.bench명. */
export function tourAutoBench(
  slotIds: readonly (string | null)[],
  cards: readonly TourPick[],
  rules: readonly TourRule[],
  season: number,
): string[] {
  const on = new Set(slotIds);
  return cards
    .filter((c) => !on.has(c.id) && tourPlayable(rules, c, season))
    .sort((a, b) => b.peak - a.peak)
    .slice(0, TOUR_LIVE.bench)
    .map((c) => c.id);
}

/** 선발 전체 제한에서 이 카드를 더 넣을 수 없는가(이미 max명이 찬 묶음). */
export function tourCapBlocked(
  rules: readonly TourRule[],
  on: readonly TourPick[],
  c: TourPick,
): boolean {
  const card = tourPickCard(c);
  return rules.some((r) => {
    const max = tourCapMax(r);
    const key = max === null ? null : tourCapKey(r, card);
    if (max === null || key === null) return false;
    return on.filter((x) => x.id !== c.id && tourCapKey(r, tourPickCard(x)) === key).length >= max;
  });
}
