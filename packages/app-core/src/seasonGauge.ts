// 시즌 진행 게이지(홈) 표시 — 웹·앱 공용. 서버 값(SeasonGaugeView)을 화면 문구로 바꾼다.
import type { SeasonGaugeResponse } from '@offside/contracts';
import { KST_MS } from '@offside/contracts/kst';
import { SEASON_GAUGE } from '@offside/contracts/season-gauge';
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
  /** T-11-352 마감 확정 전에만: 참여자 수와 목표가 같이 커진다는 한 줄(게이지가 느려 보이는 까닭). */
  why: string | null;
  /** T-11-224 종료 날짜. 마감 전엔 가장 이른·늦은 날, 확정되면 그날. 끝났으면 null. */
  endDate: string | null;
}

/** 마감 시각(00:00 KST)의 전날을 KST 날짜로 적는다 — 그날까지 시즌이 열려 있다. */
function lastDay(iso: string): string {
  const d = new Date(Date.parse(iso) + KST_MS - 1);
  return L.date({ m: d.getUTCMonth() + 1, d: d.getUTCDate(), w: d.getUTCDay() });
}

export function seasonGaugeLines(g: SeasonGauge, now: number): SeasonGaugeLines {
  const season = teamSeasonLabel(g.season);
  const pct = Math.floor(g.progress * 100);
  const left = g.endsAt ? Date.parse(g.endsAt) - now : null;
  return {
    title: L.title({ season }),
    aria: L.aria({ season, pct }),
    pct,
    countdown: left === null ? null : left > 0 ? L.endsIn({ left: timeLeft(left) }) : L.ended,
    endDate: g.endsAt
      ? left! > 0
        ? L.endsOn({ date: lastDay(g.endsAt) })
        : null
      : // 마감은 90%에 닿고 48시간 뒤라, 가장 이른 날이 그보다 가까우면 늦은 날만 적는다.
        Date.parse(g.minEndsAt) - now > SEASON_GAUGE.noticeHours * 3_600_000
        ? L.endsBetween({ from: lastDay(g.minEndsAt), to: lastDay(g.maxEndsAt) })
        : L.endsBy({ date: lastDay(g.maxEndsAt) }),
    why: g.endsAt ? null : L.why({ n: g.participants.toLocaleString('en-US') }),
  };
}

/** T-11-435 게이지 카드를 누르면 여는 설명 창의 단락(웹 · 앱 같은 내용). 수치는 SEASON_GAUGE에서 가져와 문구와 어긋나지 않는다. */
export function seasonGaugeInfo(): { head: string; body: string }[] {
  const G = SEASON_GAUGE;
  return [
    { head: L.infoWhatHead, body: L.infoWhat },
    {
      head: L.infoFillHead,
      body: L.infoFill({ age: G.fullAge, cap: G.dailyCap, per: G.perUser }),
    },
    {
      head: L.infoEndHead,
      body: L.infoEnd({ lock: Math.round(G.lockAt * 100), min: G.minDays, max: G.maxDays }),
    },
    { head: L.infoCareerHead, body: L.infoCareer },
    { head: L.infoWhereHead, body: L.infoWhere },
  ];
}
