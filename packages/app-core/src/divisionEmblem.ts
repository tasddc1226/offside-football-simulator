// T-11-375 디비전 엠블럼 — 웹(DivisionEmblem.svelte)과 앱(DivisionEmblem.tsx)이 같은 좌표 · 색을 그린다. SVG 한 벌을
// 디비전마다 색과 갈매기표 수만 바꾼다(웹 번들을 늘리지 않게 그림 파일 없이). 좌표계 0 0 32 36.
import { clampDivision, TEAM_DIVISION_TOP } from '@offside/contracts/team-division';

export const DIVISION_VIEWBOX = '0 0 32 36';
export const DIVISION_SHIELD =
  'M16 1.5 L29.5 6 V17 C29.5 25.5 24 31 16 34.5 C8 31 2.5 25.5 2.5 17 V6 Z';
export const DIVISION_INNER =
  'M16 4.6 L26.6 8.1 V17 C26.6 23.8 22.3 28.4 16 31.3 C9.7 28.4 5.4 23.8 5.4 17 V8.1 Z';
/** 갈매기표(아래에서 위로 쌓는다). */
const CHEVRON = (y: number) => `M9.5 ${y + 4} L16 ${y} L22.5 ${y + 4}`;
const STAR =
  'M16 8.5 L18.2 13.4 L23.5 13.9 L19.5 17.4 L20.7 22.6 L16 19.9 L11.3 22.6 L12.5 17.4 L8.5 13.9 L13.8 13.4 Z';

/** 테 · 바탕 · 문양 색(밝은 · 어두운 화면 모두에서 읽히는 중간 톤). */
const COLORS = [
  { rim: '#8a8f98', fill: '#3b4048', mark: '#d6d9de' }, // 아마추어
  { rim: '#b07a4a', fill: '#4a3424', mark: '#f0c9a0' }, // 세미프로
  { rim: '#b07a4a', fill: '#4a3424', mark: '#f0c9a0' },
  { rim: '#a9b4c2', fill: '#2f3a48', mark: '#e8eef6' }, // 프로
  { rim: '#a9b4c2', fill: '#2f3a48', mark: '#e8eef6' },
  { rim: '#d8a933', fill: '#4a3a12', mark: '#ffe08a' }, // 엘리트
  { rim: '#d8a933', fill: '#4a3a12', mark: '#ffe08a' },
  { rim: '#c48bff', fill: '#2c1846', mark: '#ffe08a' }, // 마스터
] as const;

export type DivisionEmblemParts = {
  rim: string;
  fill: string;
  mark: string;
  /** 선으로 그리는 갈매기표. */
  chevrons: string[];
  /** 채워 그리는 별(마스터). */
  star: string | null;
};

/** 디비전 → 엠블럼. 아마추어는 빈 방패, II는 갈매기표 하나, I은 둘, 마스터는 별. */
export function divisionEmblem(division: number): DivisionEmblemParts {
  const d = clampDivision(division);
  const c = COLORS[d]!;
  if (d === TEAM_DIVISION_TOP) return { ...c, chevrons: [], star: STAR };
  const n = d === 0 ? 0 : d % 2 === 1 ? 1 : 2;
  const chevrons = n === 1 ? [CHEVRON(14)] : n === 2 ? [CHEVRON(17), CHEVRON(11)] : [];
  return { ...c, chevrons, star: null };
}
