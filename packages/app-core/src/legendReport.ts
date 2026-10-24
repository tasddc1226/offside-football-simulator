// ───────── 은퇴 리포트 순수 계산 (웹·앱 공용, T-10-062 · 공용 T-11-005) ─────────
// 리포트(LegendReport)·플레이 성향·영구결번·몸값 그래프·대표 칭호 카드가 같이 쓰는 문구 만들기·데이터 가공.
// 그리는 일(Svelte · React Native)과 분리해 두 클라이언트가 한 벌을 쓴다.
import type { RetiredNumberMiss, RetiredNumberResult } from '@offside/contracts';
import { tn } from '@offside/game/i18n/names';
import { seasonValue } from '@offside/contracts/market-value';
import type { ChapterEvent } from '@offside/game/retirement-report';
import { WALL_OF_HONOR_TITLE_ID } from '@offside/contracts/hof-rules';
import { titleById, type TitleDef } from '@offside/game/titles';
import type { CareerRecord, HofEntry } from '@offside/game/types';
import { totals } from './format.js';
import { legendRnText as RN } from './i18n/ko/legendRn.js';
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

/** T-11-180 결번을 못 받은 이유 한 문장(웹·앱 같이). T-11-264 점수도 시즌도 모자랐으면 둘 다 말한다. */
export const rnMissText = (m: RetiredNumberMiss) =>
  m.reason === 'seasons'
    ? RN.missSeasons({ club: tn(m.club), seasons: m.seasons, need: m.need })
    : m.seasons > 0 && m.seasons < m.need
      ? RN.missScoreSeasons({ club: tn(m.club), band: band(m), seasons: m.seasons, need: m.need })
      : m.close
        ? RN.missScoreClose({ club: tn(m.club) })
        : RN.missScore({ club: tn(m.club), band: band(m) });
/** T-11-429 10% 단위 내림 점수를 구간으로(90 → 90%대). */
const band = (m: RetiredNumberMiss) => RN.pctBand({ pct: m.pct ?? 0 });

/** T-11-264 어디서 모자랐는지 줄별로(라벨 · 값 · 넘었는지). 옛 응답(시즌 0 · pct 없음)은 아는 줄만 돌려준다. */
export type RnMissStat = {
  key: 'seasons' | 'score';
  label: string;
  value: string;
  met: boolean;
  pct: number;
};
export function rnMissStats(m: RetiredNumberMiss): RnMissStat[] {
  const out: RnMissStat[] = [];
  if (m.seasons > 0 || m.reason === 'seasons')
    out.push({
      key: 'seasons',
      label: RN.missStatSeasons,
      value: RN.missStatSeasonsVal({ seasons: m.seasons, need: m.need }),
      met: m.seasons >= m.need,
      pct: Math.min(100, Math.round((m.seasons / m.need) * 100)),
    });
  if (m.pct !== undefined)
    out.push({
      key: 'score',
      label: RN.missStatScore,
      value:
        m.pct >= 100
          ? RN.missStatScoreOver
          : m.close
            ? RN.missStatScoreClose
            : RN.missStatScoreVal({ band: band(m) }),
      met: m.pct >= 100,
      pct: Math.min(100, m.pct),
    });
  return out;
}

/** 결번 구단에서 뛴 시즌(옛 기록은 구단 id가 없어 이름으로 찾는다). */
export function rnClubStats(rnSlot: Pick<Granted, 'clubId' | 'club'>, d: LegendView['d']) {
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
