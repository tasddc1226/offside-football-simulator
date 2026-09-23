// analyze.ts와 check-parity.ts가 공유하는 통계 헬퍼. 예전에는 두 파일에 각각 따로 구현돼 있었고,
// undefined 값 처리 방식이 서로 어긋나 있었다(analyze.ts의 quantile은 undefined를 걸러내지 않았다).
// 실제 CSV 파싱 결과에는 undefined가 나오지 않으므로 지금까지는 드러나지 않았지만, 이제 한 곳의
// 구현만 쓰도록 통합한다.
export type Row = Record<string, string | number>;

/** rows[key]가 숫자 또는 빈 문자열/undefined일 때, p분위수(0~1)를 구한다. */
export function quantile(values: Array<string | number | undefined>, p: number): number {
  const sorted = (values.filter((x) => x !== '' && x !== undefined) as number[]).sort(
    (a, b) => a - b,
  );
  return sorted[Math.floor((sorted.length - 1) * p)]!;
}

/** 두 컬럼(a, b) 사이의 피어슨 상관계수. */
export function pearson(rows: Row[], a: string, b: string): number {
  const x = rows.map((r) => r[a] as number);
  const y = rows.map((r) => r[b] as number);
  const n = rows.length;
  const mx = x.reduce((s, v) => s + v, 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;
  let sxy = 0;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i]! - mx) * (y[i]! - my);
    sx += (x[i]! - mx) ** 2;
    sy += (y[i]! - my) ** 2;
  }
  return sxy / Math.sqrt(sx * sy);
}

/** predicate를 만족하는 row의 비율(0~100, 퍼센트). */
export function share(rows: Row[], predicate: (r: Row) => boolean): number {
  return (rows.filter(predicate).length / rows.length) * 100;
}
