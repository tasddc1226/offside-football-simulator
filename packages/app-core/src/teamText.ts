// T-10-092 팀 화면(내 팀 · 랭킹 · 팀 프로필)이 같이 쓰는 표기.
import type { TeamRecord } from './api/team.js';
import { teamCoreText as L } from './i18n/ko/teamCore.js';
import { teamMatchText as TM } from './i18n/ko/teamMatch.js';
import { intlLocale } from './i18n/core.js';

export const num = (v: number) => v.toLocaleString(intlLocale());
/** 레이팅 변화처럼 부호를 붙여 보이는 수(+16 · −8 · ±0). */
export const signedNum = (v: number) => (v > 0 ? `+${num(v)}` : v === 0 ? '±0' : num(v));
export const recordText = (r: TeamRecord) => L.record(r);
/** T-11-269 통계의 하루(한국 시각 'YYYY-MM-DD') → "10/15". 경기 기록 한 줄(kstMonthDayTime)과 같은 월/일 표기. */
export const statsDayLabel = (day: string) => {
  const [, m, d] = day.split('-');
  return `${Number(m)}/${Number(d)}`;
};

/**
 * T-11-443 상대 고르기의 레이팅 차이(상대 − 내 팀). 승률은 서버 경기 계산이 정하므로 여기서는 차이만 보인다.
 * text는 레이팅 아래 짧은 표시(+32 · −15 · ±0), aria는 스크린리더 문장.
 */
export function ratingGap(mine: number, theirs: number) {
  const d = theirs - mine;
  return {
    d,
    text: d < 0 ? `−${num(-d)}` : signedNum(d),
    aria:
      d > 0 ? TM.oppGapUp({ n: num(d) }) : d < 0 ? TM.oppGapDown({ n: num(-d) }) : TM.oppGapEven,
  };
}
