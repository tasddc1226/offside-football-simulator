// ───────── 연도별 우승 묶음 (T-11-695) ─────────
// 트로피 탭 · 은퇴 화면이 같은 해에 받은 우승 · 수상을 한 묶음으로 그린다. 한 해에 리그 · 컵 · 대륙 대회를 함께 들면
// 줄이 서너 개씩 이어져 목록이 길어 보였다. 최근 해가 먼저, 같은 해 안에서는 나중에 받은 것이 먼저(예전 목록 순서 그대로).

export interface YearGroup<T> {
  year: number;
  items: T[];
}

/** 받은 순서대로 쌓인 목록(오래된 것 먼저)을 최근 해부터 연도별로 묶는다. */
export function groupByYear<T extends { year: number }>(list: readonly T[]): YearGroup<T>[] {
  const out: YearGroup<T>[] = [];
  for (let i = list.length - 1; i >= 0; i--) {
    const x = list[i]!;
    const last = out.at(-1);
    if (last && last.year === x.year) last.items.push(x);
    else out.push({ year: x.year, items: [x] });
  }
  return out;
}

/** 묶음 안에서 구단 이름을 다시 적을지: 바로 앞 줄과 같은 구단이면 적지 않는다(한 해에 이적하면 다시 적는다). */
export const showClub = <T extends { club: string }>(items: readonly T[], i: number): boolean =>
  i === 0 || items[i - 1]!.club !== items[i]!.club;
