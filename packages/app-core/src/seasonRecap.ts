// T-11-128 시즌 결산 화면이 그리기 전에 만드는 문구(웹·앱 공용). 결산 값은 서버가 굳힌 그대로 쓴다.
import type { OwnerHonor, SeasonRecap, SeasonRecapResponse } from '@offside/contracts';
import { loadKey, saveKey } from '@offside/game/storage';
import { intlLocale } from './i18n/core.js';
import { seasonRecapText as L } from './i18n/ko/seasonRecap.js';
import { teamSeasonLabel } from './seasonName.js';
import { num } from './teamText.js';

/** 휘장 보여 줄 순서(작은 값이 먼저). */
const ORDER: Record<OwnerHonor['kind'], number> = {
  achievements: 0,
  team: 1,
  hof: 2,
  'wall-of-honor': 3,
  'retired-number': 4,
  first: 5,
  pioneer: 6,
};

export type HonorView = {
  kind: OwnerHonor['kind'];
  season: number;
  title: string;
  /** 리본 글자 — 단계 · 개수(1위 · TOP 10 · ×3). */
  ribbon: string;
  /** 허브 카드 알약 — '명예의 전당 1위' · '업적 랭킹 TOP 10'. */
  chip: string;
  /** 리본 아래 한 줄 — 실제 순위 · 개수(5위로 마감 · 2개). */
  detail: string;
  /** 1위 · 상위 10이면 금 · 은, 그 밖은 동(메달 색). */
  medal: 'gold' | 'silver' | 'bronze';
};

const TITLE: Record<OwnerHonor['kind'], (season: number) => string> = {
  pioneer: (s) =>
    s === 0 ? L.honorPioneerPreseason : L.honorPioneer({ season: teamSeasonLabel(s) }),
  achievements: () => L.honorAchievements,
  team: () => L.honorTeam,
  hof: () => L.honorHof,
  'retired-number': () => L.honorRetiredNumber,
  'wall-of-honor': () => L.honorWallOfHonor,
  first: () => L.honorFirst,
};

function ribbonOf(h: OwnerHonor): string {
  if (h.band !== null) return h.band === 1 ? L.bandFirst : L.ribbonTop({ band: h.band });
  return h.kind === 'pioneer' ? teamSeasonLabel(h.season) : L.ribbonCount({ n: h.value ?? 0 });
}

function detailOf(h: OwnerHonor): string {
  if (h.band !== null)
    return h.rank === null ? L.bandTop({ band: h.band }) : L.rankFinal({ rank: num(h.rank) });
  const n = h.value ?? 0;
  if (h.kind === 'pioneer') return L.pioneerDetail({ n });
  return h.kind === 'wall-of-honor' ? L.countPlayers({ n }) : L.countNumbers({ n });
}

const medalOf = (h: OwnerHonor): HonorView['medal'] =>
  h.band === 1 ? 'gold' : h.band !== null && h.band <= 10 ? 'silver' : 'bronze';

const MEDALS: Record<HonorView['medal'], number> = { gold: 0, silver: 1, bronze: 2 };

/** 휘장을 보여 줄 순서대로(시즌 최신 순 → 금 · 은 · 동 → 종류 순). */
export function honorViews(honors: readonly OwnerHonor[]): HonorView[] {
  return [...honors]
    .map((h) => ({
      kind: h.kind,
      season: h.season,
      title: TITLE[h.kind](h.season),
      ribbon: ribbonOf(h),
      chip:
        h.kind === 'pioneer'
          ? TITLE.pioneer(h.season)
          : `${TITLE[h.kind](h.season)} ${ribbonOf(h)}`,
      detail: detailOf(h),
      medal: medalOf(h),
    }))
    .sort(
      (a, b) =>
        b.season - a.season || MEDALS[a.medal] - MEDALS[b.medal] || ORDER[a.kind] - ORDER[b.kind],
    );
}

/** 결산 상태 한 줄(준비 중 · 기록 없음 · 결산이 나왔어요). */
export function recapStatusText(res: Pick<SeasonRecapResponse, 'season' | 'status'>): string {
  const season = teamSeasonLabel(res.season);
  if (res.status === 'pending') return L.cardPending({ season });
  return res.status === 'none' ? L.cardNone({ season }) : L.cardReady({ season });
}

/** 구단주 화면 결산 카드(웹 · 앱 공용): 한 줄 문구 · 휘장 알약 3개 · 아직 안 열어 봤는지. */
export function recapCardView(res: SeasonRecapResponse) {
  const n = res.honors.length;
  return {
    line:
      res.status === 'ready' && n > 0
        ? `${recapStatusText(res)} · ${L.cardHonors({ n })}`
        : recapStatusText(res),
    chips: honorViews(res.honors).slice(0, 3),
    isNew: res.status === 'ready' && !recapSeen(res.season),
  };
}

/** 결산 기준 날짜 — 마감 시각 바로 앞(한국 시각) 날짜. 프리시즌이면 개막 전날. */
export const recapCutoffText = (r: Pick<SeasonRecap, 'cutoff'>): string =>
  L.cutoff({
    day: new Date(Date.parse(r.cutoff) - 1).toLocaleDateString(intlLocale(), {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
  });

/** '3위 / 1,818' — 순위가 없으면 '순위 밖'. */
export const rankText = (rank: number | null, total: number): string =>
  rank === null ? L.unranked : L.rankOf({ rank, total: num(total) });

const SEEN_KEY = 'ft_recap_seen';
const seenSeasons = (): number[] => {
  const raw = loadKey<unknown>(SEEN_KEY);
  return Array.isArray(raw) ? raw.filter((n): n is number => Number.isInteger(n)) : [];
};
/** 그 시즌 결산을 이 기기에서 열어 봤는가(카드의 NEW 표시). */
export const recapSeen = (season: number): boolean => seenSeasons().includes(season);
export function markRecapSeen(season: number): void {
  const seen = seenSeasons();
  if (!seen.includes(season)) saveKey(SEEN_KEY, [...seen, season].slice(-20));
}
