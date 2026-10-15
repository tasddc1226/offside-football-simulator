// T-10-092 팀 화면(내 팀 · 랭킹 · 팀 프로필)이 같이 쓰는 표기.
import type { TeamRecord } from './api/team.js';
import { teamCoreText as L } from './i18n/ko/teamCore.js';
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
