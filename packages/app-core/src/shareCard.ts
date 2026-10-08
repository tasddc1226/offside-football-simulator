// ───────── SNS 공유 이미지 카드 내용 (웹·앱 공용, T-10-079 · 공용 T-11-005) ─────────
// 은퇴 리포트와 같은 LegendView로 1080×1350(인스타 4:5) 카드에 실을 내용을 만든다(shareCardData — 순수 함수).
// 그리는 쪽은 클라이언트가 한다: 웹은 캔버스(shareCard.ts drawShareCard), 앱은 같은 카드를 RN 뷰로 그려 PNG로 찍는다.
import { WALL_OF_HONOR_TITLE_ID } from '@offside/contracts/hof-rules';
import { styleReport } from '@offside/game/playStyleReport';
import { careerClubs, honoursRoll } from '@offside/game/retirement-report';
import { flagOf, NATION_BY_CODE } from '@offside/contracts/nations';
import { legendTitle } from '@offside/game/season';
import { POS_LABEL } from '@offside/game/pos-label';
import { titleById } from '@offside/game/titles';
import { tn } from '@offside/game/i18n/names';
import { totals } from './format.js';
import type { LegendView } from './state.js';
import { shareText as L } from './i18n/ko/share.js';

/** 결번 액자 한 점(번호·구단) — 캔버스(웹)·RN 뷰(앱)가 같은 도트 액자(@offside/game/rnFrame)로 그린다. */
export interface JerseyArt {
  number: number;
  clubId: string | null;
}

export const CARD_W = 1080;
export const CARD_H = 1350;
/** 성향 칸이 없을 때 그 자리에 싣는 대표 우승·수상 줄 수. */
const HONOURS = 3;

// ───────── 도안 자리(px) — 웹 캔버스·앱 RN 뷰가 같은 값으로 그린다 ─────────
/** 배지 아래 엠블럼 줄의 위 끝. 엠블럼 아래에 구단 이름이 붙는다. */
export const CLUB_ROW_TOP = 672;
/** 엠블럼 줄: 한 칸 폭·엠블럼 크기. 칸이 좁으면(구단이 아주 많으면) 이름은 빼고 엠블럼만. */
export function clubRowLayout(n: number) {
  const slot = Math.min(170, (CARD_W - 160) / Math.max(1, n));
  return { slot, crest: Math.min(84, slot - 18), names: slot >= 96 };
}
/** 통산 기록 칸의 위 끝(엠블럼 줄이 있으면 그만큼 내린다). */
export const statsTop = (c: Pick<ShareCardData, 'clubs'>): number => (c.clubs.length ? 836 : 680);
/** 통산 기록 아래~바닥 줄 사이 가운데에 놓는 성향(또는 대표 우승) 칸의 제목 baseline. */
export function lowerBlockY(c: Pick<ShareCardData, 'clubs' | 'style' | 'honours'>): number {
  const top = statsTop(c) + 148;
  const h = c.style ? 150 : 22 + 56 + (c.honours.length - 1) * 52 + 10;
  return Math.round(top + (CARD_H - 100 - top - h) / 2 + 22);
}

export interface ShareCardData {
  kicker: string;
  name: string;
  /** 국적 국기(이모지). 국적을 모르는 옛 기록은 null. */
  flag: string | null;
  sub: string;
  score: number;
  /** 등급 · 대표 칭호 · 영구결번 배지. tail은 좁으면 text 끝을 줄여도 남기는 뒷부분. */
  pills: { text: string; gold?: boolean; tail?: string }[];
  stats: { value: string; label: string }[];
  /** 거쳐 간 구단(처음 뛴 순서, 한 번씩) — 배지와 통산 기록 사이 엠블럼 줄. name은 보여 줄 이름. */
  clubs: { club: string; clubId: string | null; name: string }[];
  style: { icon: string; name: string; line: string; best: string | null } | null;
  /** 성향 칸이 없을 때 그 자리에 싣는 대표 우승·수상(발롱도르 → 많이 든 우승 → 개인상). */
  honours: { count: string; name: string }[];
  /** 영구결번을 받았으면 점수 옆에 세우는 결번 유니폼. */
  jersey: JerseyArt | null;
}

export function shareCardData(v: LegendView, titleId: string | null | undefined): ShareCardData {
  const d = v.d;
  const back = v.pos === 'GK' || v.pos === 'DF';
  const t = d ? totals(d) : null;
  const [y0, y1] = [d?.career[0]?.year, d?.career.at(-1)?.year];
  const span = y0 == null ? null : y0 === y1 ? `${y0}` : `${y0}–${y1}`;
  const main = titleById(titleId);
  const rn = v.rn?.kind === 'granted' ? v.rn : null;
  const pills: ShareCardData['pills'] = [{ text: legendTitle(v.score, v.dpos), gold: true }];
  if (main && (main.cat !== 'legend' || main.id === WALL_OF_HONOR_TITLE_ID))
    pills.push({ text: `‘${main.name}’` });
  if (rn) pills.push({ text: `👑 ${tn(rn.club)}`, tail: L.cardRnTail({ number: rn.number }) });
  else pills.push({ text: L.cardPeak({ peak: v.peak }) });

  const stat = (value: number | undefined, label: string) => ({ value: `${value ?? '—'}`, label });
  const stats = [
    stat(d?.career.length, L.cardSeasons),
    stat(t?.p ?? v.totals.apps, L.cardApps),
    ...(back
      ? [stat(t?.cs, L.cardCleanSheets)]
      : [stat(t?.g ?? v.totals.goals, L.cardGoals), stat(t?.a ?? v.totals.assists, L.cardAssists)]),
    stat(v.totals.trophies, L.cardTrophies),
  ];

  const r = d ? styleReport(d.style, d.career) : null;
  // 시즌별 기록이 없는 옛 기록은 마지막 구단만 안다.
  const clubs = (
    d ? careerClubs(d) : [{ club: v.lastClub, clubId: v.lastClubId ?? undefined }]
  ).map((c) => ({ club: c.club, clubId: c.clubId ?? null, name: tn(c.club) }));
  const awards = d ? honoursRoll(d.awards) : [];
  const ballon = (h: { name: string }) => h.name.includes('발롱도르');
  const honours = r
    ? []
    : [
        ...awards.filter(ballon),
        ...(d ? honoursRoll(d.trophies) : []),
        ...awards.filter((h) => !ballon(h)),
      ]
        .slice(0, HONOURS)
        .map((h) => ({ count: `×${h.years.length}`, name: tn(h.name) }));
  return {
    kicker: `FULL TIME${v.number != null ? ` · NO.${v.number}` : ''}`,
    name: v.name,
    flag: v.nation && NATION_BY_CODE.has(v.nation) ? flagOf(v.nation) : null,
    sub: [tn(POS_LABEL[v.pos]), span, L.cardRetiredAge({ age: v.age })].filter(Boolean).join(' · '),
    score: v.score,
    pills,
    stats,
    clubs,
    style: r
      ? {
          icon: r.type.icon,
          name: r.type.name,
          line: r.type.line,
          best: r.best ? L.cardBest({ pct: r.best.pct, title: r.best.title }) : null,
        }
      : null,
    honours,
    jersey: rn ? { number: rn.number, clubId: rn.clubId ?? null } : null,
  };
}

/** 카드 바닥의 한 줄 소개·게임 이름. 언어를 바꾸면 달라져야 하므로 읽을 때 고른다. */
export const tagline = (): string => L.cardTagline;
export const cardBrand = (): string => L.cardBrand;
