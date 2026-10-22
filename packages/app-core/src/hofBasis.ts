// T-11-441 명예의 전당 순위 기준 한 줄 설명(웹 HallOfFame.svelte · 앱 components/HallOfFame 공용).
// 득점 · 도움처럼 이름만으로 뜻이 보이는 기준은 설명을 두지 않는다.
import type { HofSort } from '@offside/contracts';
import { hofText as L } from './i18n/ko/hof.js';

export function hofBasisNote(sort: HofSort): string | null {
  switch (sort) {
    case 'score':
      return L.basisScore;
    case 'value':
      return L.basisValue;
    case 'ga':
      return L.basisGa;
    case 'peak':
      return L.basisPeak;
    default:
      return null;
  }
}
