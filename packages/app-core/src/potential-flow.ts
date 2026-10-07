// T-11-141 은퇴 리포트의 '잠재력이 바뀐 과정' 문구(웹 LegendReport.svelte · 앱 LegendReport.tsx). 첫 화면 청크에
// 문구가 실리지 않도록 potential-view.ts(데이터)와 나눴다.
import { gamePotentialText as P } from './i18n/ko/gamePotential';
import type { PotentialFlow } from './potential-view';

/** 은퇴 리포트에 그릴 줄(처음 → 변동 → 강화 → 은퇴 시). end는 화면의 은퇴 잠재력과 같은 값이다. */
export function potentialFlowLines(
  f: PotentialFlow,
  end: { real: string; value: number },
): string[] {
  const sign = (d: number) => (d > 0 ? `+${d}` : d < 0 ? `−${-d}` : '±0');
  return [
    ...(f.start ? [P.flowStart(f.start)] : []),
    ...(f.drift !== undefined ? [P.flowDrift({ d: sign(f.drift) })] : []),
    ...(f.boost ? [P.flowBoost({ n: f.boost })] : []),
    P.flowEnd({ grade: end.real, value: end.value }),
  ];
}
/** 시드·밸런스 버전 줄과(시드가 있으면) 그 설명. */
export const potentialSeedLines = (f: PotentialFlow): string[] =>
  f.seed !== undefined
    ? [P.seedLine({ seed: f.seed, v: f.bal }), P.seedNote]
    : [P.balLine({ v: f.bal })];
