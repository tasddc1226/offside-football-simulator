// ───────── SNS 공유 이미지 카드 내용 (웹·앱 공용, T-10-079 · 공용 T-11-005) ─────────
// 은퇴 리포트와 같은 LegendView로 1080×1350(인스타 4:5) 카드에 실을 내용을 만든다(shareCardData — 순수 함수).
// 그리는 쪽은 클라이언트가 한다: 웹은 캔버스(shareCard.ts drawShareCard), 앱은 같은 카드를 RN 뷰로 그려 PNG로 찍는다.
import { styleReport } from '@offside/game/playStyleReport';
import { careerChapters, honoursRoll } from '@offside/game/retirement-report';
import { legendTitle } from '@offside/game/season';
import { POS_LABEL } from '@offside/game/pos-label';
import { titleById } from '@offside/game/titles';
import { totals } from './format.js';
import { RN_DEFAULT, rnColors, type RnColors } from './rnStyle.js';
import type { LegendView } from './state.js';

/** 결번 유니폼 한 벌(이름·번호·구단 색) — 캔버스(웹)·RN 뷰(앱)가 같은 도안(rnStyle JERSEY)으로 그린다. */
export interface JerseyArt {
  name: string;
  number: number;
  colors: RnColors;
}

export const CARD_W = 1080;
export const CARD_H = 1350;
/** 여정에 싣는 구단 수(넘치면 첫 구단과 마지막 구단들만 남기고 가운데를 줄인다). 성향·우승 칸이 있으면 줄어든다. */
const STOPS = { shared: 3, alone: 5 };
/** 성향 칸이 없을 때 여정 아래에 싣는 대표 우승·수상 줄 수. */
const HONOURS = 3;

export interface ShareCardData {
  kicker: string;
  name: string;
  sub: string;
  score: number;
  /** 등급 · 대표 칭호 · 영구결번 배지. tail은 좁으면 text 끝을 줄여도 남기는 뒷부분. */
  pills: { text: string; gold?: boolean; tail?: string }[];
  stats: { value: string; label: string }[];
  /** 커리어 여정(연도 · 구단 · 리그). 가운데를 줄였으면 null 한 칸이 들어간다. */
  stops: ({ years: string; club: string; league: string } | null)[];
  style: { icon: string; name: string; line: string; best: string | null } | null;
  /** 성향 칸이 없을 때 여정 아래 대표 우승·수상(발롱도르 → 많이 든 우승 → 개인상). */
  honours: { count: string; name: string }[];
  /** 영구결번을 받았으면 점수 옆에 세우는 결번 유니폼. */
  jersey: JerseyArt | null;
}

const yy = (from: number, to: number) =>
  from === to ? `${from}` : `${from}–${String(to % 100).padStart(2, '0')}`;

export function shareCardData(v: LegendView, titleId: string | null | undefined): ShareCardData {
  const d = v.d;
  const back = v.pos === 'GK' || v.pos === 'DF';
  const t = d ? totals(d) : null;
  const [y0, y1] = [d?.career[0]?.year, d?.career.at(-1)?.year];
  const span = y0 == null ? null : y0 === y1 ? `${y0}` : `${y0}–${y1}`;
  const main = titleById(titleId);
  const rn = v.rn?.kind === 'granted' ? v.rn : null;
  const pills: ShareCardData['pills'] = [{ text: legendTitle(v.score), gold: true }];
  if (main && main.cat !== 'legend') pills.push({ text: `‘${main.name}’` });
  if (rn) pills.push({ text: `👑 ${rn.club}`, tail: ` 영구결번 ${rn.number}` });
  else pills.push({ text: `최고 OVR ${v.peak}` });

  const stat = (value: number | undefined, label: string) => ({ value: `${value ?? '—'}`, label });
  const stats = [
    stat(d?.career.length, '시즌'),
    stat(t?.p ?? v.totals.apps, '경기'),
    ...(back
      ? [stat(t?.cs, '무실점')]
      : [stat(t?.g ?? v.totals.goals, '골'), stat(t?.a ?? v.totals.assists, '도움')]),
    stat(v.totals.trophies, '트로피'),
  ];

  const r = d ? styleReport(d.style, d.career) : null;
  const all = (d ? careerChapters(d) : []).map((c) => ({
    years: yy(c.from, c.to),
    club: c.club,
    league: c.leagues.at(-1)!,
  }));
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
        .map((h) => ({ count: `×${h.years.length}`, name: h.name }));
  const room = r || honours.length ? STOPS.shared : STOPS.alone;
  const stops = all.length > room ? [all[0]!, null, ...all.slice(-(room - 2))] : all;
  return {
    kicker: `FULL TIME${v.number != null ? ` · NO.${v.number}` : ''}`,
    name: v.name,
    sub: [POS_LABEL[v.pos], span, `${v.age}세 은퇴`].filter(Boolean).join(' · '),
    score: v.score,
    pills,
    stats,
    stops,
    style: r
      ? {
          icon: r.type.icon,
          name: r.type.name,
          line: r.type.line,
          best: r.best ? `성공 확률 ${r.best.pct}%의 ‘${r.best.title}’, 기어이 해냈다` : null,
        }
      : null,
    honours,
    jersey: rn
      ? { name: v.name, number: rn.number, colors: rnColors(rn.clubId) ?? RN_DEFAULT }
      : null,
  };
}

/** 카드 바닥의 한 줄 소개. */
export const TAGLINE = '고3부터 은퇴까지, 한 선수의 인생';
