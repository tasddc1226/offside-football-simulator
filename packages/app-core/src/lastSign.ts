// ───────── 마지막 계약서 사인 (T-11-412) ─────────
// 계약서 시트에서 받은 사인을 이 기기에 하나만 남겨, 홈 '진행 중인 커리어' 카드에서 다시 그려 보인다.
// 세이브(GameState)에 넣지 않는 화면 연출 값이라 커리어가 바뀌면(cid가 다르면) 보이지 않는다.

/** 저장하는 사인. 손 사인은 패드 크기(w·h, px)와 획마다 [x, y, x, y, …](정수 px). 이름 사인은 이름만. */
export type SignMark =
  { kind: 'ink'; w: number; h: number; strokes: number[][] } | { kind: 'name'; name: string };

export type LastSign = { cid: string; club: string; mark: SignMark };

export const LAST_SIGN_KEY = 'ft_last_sign';
/** 저장할 점 수 상한(모든 획 합). 넘으면 뒤 점을 버린다. */
const MAX_POINTS = 600;
/** 이보다 가까운 점은 버린다(px). */
const MIN_STEP = 2;

/** 그은 점(px)을 정수로 줄이고 가까운 점 · 점 수를 덜어 낸다. */
export function packInk(w: number, h: number, strokes: { x: number; y: number }[][]): SignMark {
  let left = MAX_POINTS;
  const out: number[][] = [];
  for (const s of strokes) {
    if (left <= 0) break;
    const flat: number[] = [];
    let px = NaN,
      py = NaN;
    for (const p of s) {
      if (left <= 0) break;
      const x = Math.round(p.x),
        y = Math.round(p.y);
      if (Math.hypot(x - px, y - py) < MIN_STEP) continue;
      flat.push(x, y);
      px = x;
      py = y;
      left--;
    }
    if (flat.length) out.push(flat);
  }
  return { kind: 'ink', w: Math.round(w), h: Math.round(h), strokes: out };
}

const isInt = (v: unknown): v is number => Number.isInteger(v);

/** 저장값을 읽는다. 모양이 다르면 null. */
export function parseLastSign(raw: string | null): LastSign | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<LastSign>;
    if (typeof v.cid !== 'string' || typeof v.club !== 'string' || !v.mark) return null;
    const m = v.mark as Partial<SignMark> & Record<string, unknown>;
    if (m.kind === 'name') return typeof m.name === 'string' && m.name ? (v as LastSign) : null;
    if (m.kind !== 'ink' || !isInt(m.w) || !isInt(m.h) || m.w <= 0 || m.h <= 0) return null;
    const strokes = m.strokes;
    if (!Array.isArray(strokes) || !strokes.length) return null;
    if (
      !strokes.every(
        (s) => Array.isArray(s) && s.length >= 2 && s.length % 2 === 0 && s.every(isInt),
      )
    )
      return null;
    return v as LastSign;
  } catch {
    return null;
  }
}

/** 손 사인 획을 SVG 경로로(두 점 가운데를 잇는 부드러운 곡선 — 계약서 펜과 같은 모양). 길이는 그리는 시간 배분용. */
export function inkPaths(mark: Extract<SignMark, { kind: 'ink' }>): { d: string; len: number }[] {
  return mark.strokes.map((s) => {
    if (s.length === 2) return { d: `M${s[0]},${s[1]}l0.1,0`, len: 1 };
    let d = `M${s[0]},${s[1]}`;
    let len = 0;
    for (let i = 2; i < s.length; i += 2) {
      const x0 = s[i - 2]!,
        y0 = s[i - 1]!,
        x1 = s[i]!,
        y1 = s[i + 1]!;
      len += Math.hypot(x1 - x0, y1 - y0);
      d +=
        i + 2 < s.length
          ? `Q${x0},${y0} ${(x0 + x1) / 2},${(y0 + y1) / 2}`
          : `Q${x0},${y0} ${x1},${y1}`;
    }
    return { d, len: Math.max(1, len) };
  });
}
