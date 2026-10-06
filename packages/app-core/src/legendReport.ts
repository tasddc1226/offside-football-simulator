// ───────── 은퇴 리포트 순수 계산 (웹·앱 공용, T-10-062 · 공용 T-11-005) ─────────
// 리포트(LegendReport)·플레이 성향·영구결번·몸값 그래프·대표 칭호 카드가 같이 쓰는 문구 만들기·데이터 가공.
// 그리는 일(Svelte · React Native)과 분리해 두 클라이언트가 한 벌을 쓴다.
import type { RetiredNumberResult } from '@offside/contracts';
import { seasonValue } from '@offside/contracts/market-value';
import type { ChapterEvent } from '@offside/game/retirement-report';
import { WALL_OF_HONOR_TITLE_ID } from '@offside/contracts/hof-rules';
import { titleById, type TitleDef } from '@offside/game/titles';
import type { CareerRecord, HofEntry } from '@offside/game/types';
import { totals } from './format.js';
import { legendStyleText as L } from './i18n/ko/legendStyle.js';
import type { LegendView } from './state.js';

/** 2036 · 37 · 39 — 첫 해만 네 자리. */
export const yearsOf = (ys: number[]): string =>
  ys.map((y, i) => (i ? String(y % 100).padStart(2, '0') : y)).join(' · ');

export const EVENT_ICON: Record<ChapterEvent['kind'], string> = {
  trophy: '🏆',
  mile: '◆',
  story: '✦',
};

type Granted = Extract<RetiredNumberResult, { kind: 'granted' }>;

/** 결번 장면에 그릴 슬롯: 심사 중이 아니고, 이름을 숨긴 결번(anonymous)은 내 선수에게만 보인다. */
export function rnSlotOf(
  rn: RetiredNumberResult | null,
  own: LegendView['own'],
): Exclude<RetiredNumberResult, { kind: 'pending' }> | null {
  return rn && rn.kind !== 'pending' && (rn.kind !== 'anonymous' || own) ? rn : null;
}

/** 결번 구단에서 뛴 시즌(옛 기록은 구단 id가 없어 이름으로 찾는다). */
export function rnClubStats(rnSlot: Granted, d: LegendView['d']) {
  if (!d) return null;
  const recs = d.career.filter((r) =>
    r.clubId ? r.clubId === rnSlot.clubId : r.club === rnSlot.club,
  );
  if (!recs.length) return null;
  const t = totals({ career: recs });
  return {
    from: recs[0]!.year,
    to: recs.at(-1)!.year,
    seasons: recs.length,
    apps: t.p,
    goals: t.g,
    assists: t.a,
  };
}

// ───────── 플레이 성향 문구 ─────────
export const pct = (n: number, of: number): number => (of ? Math.round((n / of) * 100) : 0);
export const luckText = (l: number): string => (l > 0 ? `+${l}` : l < 0 ? `${l}` : '±0');
export const luckNote = (l: number): string =>
  l > 0 ? L.luckUp({ n: l }) : l < 0 ? L.luckDown({ n: -l }) : L.luckEven;

// ───────── 몸값 그래프 좌표 ─────────
/** 시즌별 몸값 점: x는 0~1(첫~마지막 시즌), y는 위 0 ~ 아래 100(맨 위 20%는 최고 몸값 꼬리표 자리로 비운다). */
export function valuePoints(rows: CareerRecord[], peak: number) {
  const max = peak || 1;
  const n = rows.length;
  return rows.map((r, i) => {
    const v = seasonValue(r);
    return { r, v, x: n > 1 ? i / (n - 1) : 0.5, y: 100 - (v / max) * 80 };
  });
}

// ───────── 대표 칭호 ─────────
/** 받은 칭호를 희귀한 것부터, 같으면 최근 것부터. */
export function earnedTitles(h: HofEntry, rn = h.rn): { d: TitleDef; year: number }[] {
  const titles = (h.detail?.titles ?? []).filter((t) => t.id !== WALL_OF_HONOR_TITLE_ID);
  if (rn?.kind === 'taken' && rn.wallOfHonor) titles.push({ id: WALL_OF_HONOR_TITLE_ID, year: 0 });
  return titles
    .map((e) => ({ d: titleById(e.id), year: e.year }))
    .filter((x): x is { d: TitleDef; year: number } => !!x.d)
    .sort((a, b) => b.d.rarity - a.d.rarity || b.year - a.year);
}
