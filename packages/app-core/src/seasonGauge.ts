// 시즌 진행 게이지(홈) 표시 — 웹·앱 공용. 서버 값(SeasonGaugeView)을 화면 문구로 바꾼다.
import type { SeasonGaugeResponse } from '@offside/contracts';
import { teamSeasonLabel } from './seasonName.js';
import { seasonGaugeText as L } from './i18n/ko/seasonGauge.js';

export type SeasonGauge = NonNullable<SeasonGaugeResponse['gauge']>;

const KST = 9 * 3_600_000;
/** 마감은 언제나 KST 자정이라 날짜도 KST로 적는다. */
const kstDate = (iso: string) => {
  const d = new Date(Date.parse(iso) + KST);
  return L.date({ m: d.getUTCMonth() + 1, d: d.getUTCDate() });
};

/** 남은 시간: 하루 넘으면 '2일 5시간', 아니면 '5시간 12분', 한 시간 안이면 '12분'. */
export function timeLeft(ms: number): string {
  const min = Math.max(0, Math.floor(ms / 60_000));
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  if (d > 0) return L.days({ d, h });
  if (h > 0) return L.hours({ h, m: min % 60 });
  return L.minutes({ m: min });
}

export interface SeasonGaugeLines {
  title: string;
  aria: string;
  /** 0~100 정수(막대 폭). */
  pct: number;
  /** 마감이 정해졌으면 카운트다운. */
  countdown: string | null;
  /** 막대 아래 첫 줄(숫자)과 둘째 줄(안내). */
  stats: string;
  note: string;
}

export function seasonGaugeLines(
  g: SeasonGauge,
  now: number,
  fmt: (n: number) => string,
): SeasonGaugeLines {
  const season = teamSeasonLabel(g.season);
  const pct = Math.floor(g.progress * 100);
  const left = g.endsAt ? Date.parse(g.endsAt) - now : null;
  return {
    title: L.title({ season }),
    aria: L.aria({ season, pct }),
    pct,
    countdown: left === null ? null : left > 0 ? L.endsIn({ left: timeLeft(left) }) : L.ended,
    stats: `${L.filled({ count: fmt(g.contributed), target: fmt(g.target) })} · ${L.owners({ n: fmt(g.participants) })}`,
    note: g.endsAt
      ? L.endsAt({ date: kstDate(g.endsAt) })
      : `${L.howTo} ${L.window({ min: kstDate(g.minEndsAt), max: kstDate(g.maxEndsAt) })}`,
  };
}
