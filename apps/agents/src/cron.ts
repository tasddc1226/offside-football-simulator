// 5필드 cron(분 시 일 월 요일, UTC)의 다음 실행 시각. GitHub Actions · Workers cron이 쓰는 꼴(*, */n, a-b, a-b/n, 목록)만 읽는다.
const RANGES: [number, number][] = [
  [0, 59],
  [0, 23],
  [1, 31],
  [1, 12],
  [0, 6],
];

function field(spec: string, [lo, hi]: [number, number]): Set<number> {
  const out = new Set<number>();
  for (const part of spec.split(',')) {
    const [range, stepText] = part.split('/');
    const step = stepText ? Number(stepText) : 1;
    const [a, end] = range === '*' ? [lo, hi] : range!.split('-').map(Number);
    const b = end ?? (stepText ? hi : a);
    if (!Number.isInteger(a) || !Number.isInteger(b) || !Number.isInteger(step) || step < 1)
      throw new Error(`cron 필드를 읽지 못했어요: ${spec}`);
    for (let v = a!; v <= b!; v += step) out.add(v === 7 && hi === 6 ? 0 : v);
  }
  return out;
}

/** from(ms) 뒤 n번의 실행 시각(ms). 48시간 안만 찾는다. */
export function nextRuns(expr: string, from: number, n = 3): number[] {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) throw new Error(`cron은 5필드여야 해요: ${expr}`);
  const [mi, h, dom, mon, dow] = parts.map((p, i) => field(p, RANGES[i]!));
  // 일 · 요일이 둘 다 제한되면 둘 중 하나만 맞아도 돈다(표준 cron).
  const domAny = parts[2] === '*';
  const dowAny = parts[4] === '*';
  const out: number[] = [];
  let t = Math.floor(from / 60_000) * 60_000 + 60_000;
  for (const end = from + 48 * 3600_000; t <= end && out.length < n; t += 60_000) {
    const d = new Date(t);
    const dayOk =
      domAny && dowAny
        ? true
        : domAny
          ? dow!.has(d.getUTCDay())
          : dowAny
            ? dom!.has(d.getUTCDate())
            : dom!.has(d.getUTCDate()) || dow!.has(d.getUTCDay());
    if (
      mi!.has(d.getUTCMinutes()) &&
      h!.has(d.getUTCHours()) &&
      mon!.has(d.getUTCMonth() + 1) &&
      dayOk
    )
      out.push(t);
  }
  return out;
}

export const kstText = (ms: number) =>
  new Date(ms + 9 * 3600_000).toISOString().replace('T', ' ').slice(0, 16);
