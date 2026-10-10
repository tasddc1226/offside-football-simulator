// 시즌 진행 게이지(홈) 표시 — 웹·앱 공용. 서버 값(SeasonGaugeView)을 화면 문구로 바꾼다.
import type { SeasonGaugeResponse } from '@offside/contracts';
import { teamSeasonLabel } from './seasonName.js';
import { seasonGaugeText as L } from './i18n/ko/seasonGauge.js';

export type SeasonGauge = NonNullable<SeasonGaugeResponse['gauge']>;

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
}

export function seasonGaugeLines(g: SeasonGauge, now: number): SeasonGaugeLines {
  const season = teamSeasonLabel(g.season);
  const pct = Math.floor(g.progress * 100);
  // T-11-189 시즌 길이가 정해져 있으면(최소 = 최대) 확정 전에도 그 마감으로 센다.
  const endsAt = g.endsAt ?? (g.minEndsAt === g.maxEndsAt ? g.maxEndsAt : null);
  const left = endsAt ? Date.parse(endsAt) - now : null;
  return {
    title: L.title({ season }),
    aria: L.aria({ season, pct }),
    pct,
    countdown: left === null ? null : left > 0 ? L.endsIn({ left: timeLeft(left) }) : L.ended,
  };
}
