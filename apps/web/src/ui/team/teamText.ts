// T-10-092 팀 화면(내 팀 · 랭킹 · 팀 프로필)이 같이 쓰는 표기.
import type { TeamRecord } from '../../api/team.js';

export const num = (v: number) => v.toLocaleString('ko-KR');
/** 레이팅 변화처럼 부호를 붙여 보이는 수(+16 · −8 · ±0). */
export const signedNum = (v: number) => (v > 0 ? `+${num(v)}` : v === 0 ? '±0' : num(v));
export const recordText = (r: TeamRecord) => `${r.w}승 ${r.d}무 ${r.l}패`;
