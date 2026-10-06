// T-11-128 시즌 결산 화면이 그리기 전에 만드는 문구(웹·앱 공용). 결산 값은 서버가 굳힌 그대로 쓴다.
import type { OwnerHonor, SeasonRecap, SeasonRecapResponse } from '@offside/contracts';
import { CARD_TIERS, type CardTier } from '@offside/contracts/card-tier';
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

/** 구단주 화면 결산 카드(웹 · 앱 공용): 한 줄 문구 · 기록 배지 알약 3개 · 아직 안 열어 봤는지. */
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

// ── 결산 화면 · 공유 카드(웹 · 앱 공용) ──

/** 순위를 '상위 N%'로(1% 아래는 1%). 순위가 없으면 null. */
export const topPercent = (rank: number | null, total: number): number | null =>
  rank === null || total <= 0 ? null : Math.min(100, Math.max(1, Math.ceil((rank / total) * 100)));

export type RecapNumber = { key: string; label: string; value: number };

/** 큰 숫자 칸 — 그 시즌 은퇴한 선수들의 통산 합. 기록 묶음이 없으면 선수 수만. */
export function recapNumbers(r: SeasonRecap): RecapNumber[] {
  const s = r.stats;
  const base: RecapNumber[] = [
    { key: 'players', label: L.players, value: r.players },
    { key: 'retired', label: L.retired, value: r.retired },
  ];
  if (!s) return base;
  return [
    ...base,
    { key: 'goals', label: L.numGoals, value: s.goals },
    { key: 'assists', label: L.numAssists, value: s.assists },
    { key: 'apps', label: L.numApps, value: s.apps },
    { key: 'trophies', label: L.numTrophies, value: s.trophies },
    { key: 'caps', label: L.numCaps, value: s.caps },
    { key: 'ballon', label: L.numBallon, value: s.ballon },
  ];
}

/** 카드 등급 색(웹 PlayerCard.svelte · 앱 PlayerCard.tsx와 같은 값) — 결산의 등급 막대 · 대표 선수 카드. */
export const CARD_TIER_SWATCH: Record<
  CardTier,
  { base: string; dark: string; ink: string; line: string }
> = {
  icon: { base: '#1d2547', dark: '#0a0f26', ink: '#ffe9b0', line: '#e6c369' },
  legend: { base: '#28382e', dark: '#101e17', ink: '#fce7b1', line: '#d1ac5f' },
  elite: { base: '#f1c654', dark: '#a36f12', ink: '#3b2604', line: '#d99a1e' },
  gold: { base: '#e8d5a8', dark: '#8a6324', ink: '#392b14', line: '#b79654' },
  silver: { base: '#d6dfe0', dark: '#83989c', ink: '#243339', line: '#9fb3b6' },
  bronze: { base: '#d7a27a', dark: '#7d4a29', ink: '#3a1f0e', line: '#a86e45' },
};

export type RecapTierBar = { tier: CardTier; label: string; n: number; pct: number };

/** 카드 등급별 선수 수(높은 등급부터, 0명 등급도 자리를 지킨다). 은퇴 선수가 없으면 빈 배열. */
export function recapTierBars(r: SeasonRecap): RecapTierBar[] {
  const tiers = r.stats?.tiers;
  if (!tiers) return [];
  const total = CARD_TIERS.reduce((sum, t) => sum + tiers[t], 0);
  if (total === 0) return [];
  return CARD_TIERS.map((tier) => ({
    tier,
    label: L.cardTierName({ tier }),
    n: tiers[tier],
    pct: (tiers[tier] / total) * 100,
  }));
}

/** 팀 시즌 요약 — 경기 수 · 승률(%) · 득실차. */
export function recapTeamSummary(t: NonNullable<SeasonRecap['team']>) {
  const played = t.wins + t.draws + t.losses;
  return {
    played,
    winRate: played > 0 ? Math.round((t.wins / played) * 100) : 0,
    goalDiff: t.goalsAgainst === null ? null : t.goalsFor - t.goalsAgainst,
  };
}

/** 득실차 '+12' · '-3' · '0'. */
export const signed = (n: number): string => (n > 0 ? `+${num(n)}` : num(n));

/** 이 시즌 자랑거리 — 결산 맨 위 알약과 공유 카드에 쓴다(값이 있는 것만, 무게 순으로 여섯 개까지). */
export function recapHighlights(r: SeasonRecap): string[] {
  const s = r.stats;
  const out: string[] = [];
  if (r.hofRank !== null && r.hofRank <= 100) out.push(L.hlHof({ rank: num(r.hofRank) }));
  if (s && s.ballon > 0) out.push(L.hlBallon({ n: s.ballon }));
  if (s && s.tiers.icon > 0) out.push(L.hlIcon({ n: s.tiers.icon }));
  if (r.team?.rank != null && r.team.rank <= 50) out.push(L.hlTeamRank({ rank: num(r.team.rank) }));
  if (r.firsts > 0) out.push(L.hlFirsts({ n: r.firsts }));
  if (r.retiredNumbers > 0) out.push(L.hlRetiredNumbers({ n: r.retiredNumbers }));
  if (r.team && r.team.bestStreak >= 3) out.push(L.hlStreak({ n: r.team.bestStreak }));
  if (s && s.trophies > 0) out.push(L.hlTrophies({ n: num(s.trophies) }));
  return out.slice(0, 6);
}

/** 결산 첫 줄 — 그 시즌을 한 문장으로. */
export function recapHeadline(r: SeasonRecap): string {
  if (r.retired > 0 && r.stats && r.stats.goals > 0)
    return L.headlineGoals({ n: num(r.retired), goals: num(r.stats.goals) });
  if (r.retired > 0) return L.headlineRetired({ n: num(r.retired) });
  if (r.team) return L.headlineTeam({ name: r.team.name });
  return L.headlinePlayers({ n: num(r.players) });
}
