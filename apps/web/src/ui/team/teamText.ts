// T-10-092 팀 화면(내 팀 · 랭킹 · 팀 프로필)이 같이 쓰는 표기.
import type { TeamRecord } from '../../api/team.js';

export const num = (v: number) => v.toLocaleString('ko-KR');
export const recordText = (r: TeamRecord) => `${r.w}승 ${r.d}무 ${r.l}패`;
