// ───────── 구단 유니폼 (T-11-120) ─────────
// 정의(kits-data.ts)가 있는 구단은 그 홈·원정을, 없는 구단(고교·대학)은 엠블럼 색·무늬에서 만든다.
// 도트 아바타 몸통(가로 7~16, 세로 13~19)에 무늬를 칠하는 규칙도 여기 둔다.
import { dist, lum } from './color.js';
import { crestOf } from './crests.js';
import type { Club } from './data.js';
import { KIT_SPECS } from './kits-data.js';

/** 상의 무늬(몸통 10×7칸에서 알아볼 수 있는 것만). 엠블럼 무늬 키와 겹치는 건 같은 뜻이다. */
export const KIT_PATTERNS = [
  '-',
  'v',
  'v1',
  'h',
  'hoop',
  'half',
  'hh',
  'band',
  'sash',
  'ch',
  'q',
  'cr',
  'dz',
  'tri',
  'yoke',
  'side',
] as const;
type KitPattern = (typeof KIT_PATTERNS)[number];
const isKitPattern = (p: string): p is KitPattern =>
  (KIT_PATTERNS as readonly string[]).includes(p);
export interface KitSpec {
  body: string;
  pat: KitPattern;
  pc: string;
  pc2?: string | undefined;
  sleeve: string;
  collar: string;
  shorts: string;
  socks: string;
  cuff: string;
}
export type KitSide = 'home' | 'away';

function parseKit(line: string): KitSpec {
  const [body, pat, pc, sleeve, collar, shorts, socks, cuff, pc2] = line.split(' ') as string[];
  if (!pat || !isKitPattern(pat)) throw new Error(`유니폼 무늬 오류: ${line}`); // i18n-ignore 개발용 오류
  const c = (h: string | undefined) => `#${h}`;
  return {
    body: c(body),
    pat,
    pc: c(pc),
    ...(pc2 ? { pc2: c(pc2) } : {}),
    sleeve: c(sleeve),
    collar: c(collar),
    shorts: c(shorts),
    socks: c(socks),
    cuff: c(cuff),
  };
}

const neutral = (c: string) => {
  const l = lum(c);
  return l > 0.8 || l < 0.03;
};

/** 유니폼 정의가 없는 구단(고교·대학): 엠블럼 바탕·강조색으로 홈을, 그 반대 밝기의 단색으로 원정을 만든다. */
function autoKit(club: Pick<Club, 'id' | 'name'>, side: KitSide): KitSpec {
  const cr = crestOf(club);
  const base = cr.base;
  if (side === 'away') {
    const ab = lum(base) > 0.5 ? '#1c2333' : '#f4f4ef';
    return {
      body: ab,
      pat: '-',
      pc: ab,
      sleeve: ab,
      collar: base,
      shorts: ab,
      socks: ab,
      cuff: base,
    };
  }
  const p = cr.patKey;
  const plain = p === '-';
  let trim = plain ? (cr.edge ?? cr.motifColor) : cr.accent;
  if (dist(trim, base) < 60) trim = lum(base) > 0.4 ? '#1c1c1f' : '#f4f4ef';
  const acc = plain ? base : cr.accent;
  return {
    body: base,
    // sl(소매 색)은 무늬가 아니라 소매로 칠한다.
    pat: isKitPattern(p) ? p : '-',
    pc: acc,
    ...(cr.third ? { pc2: cr.third } : {}),
    sleeve: p === 'sl' ? cr.accent : base,
    collar: trim,
    shorts: p === 'hh' ? acc : plain ? (neutral(trim) ? trim : base) : neutral(acc) ? acc : base,
    socks: base,
    cuff: trim,
  };
}

/** 구단의 홈·원정 유니폼. */
export function kitOf(club: Pick<Club, 'id' | 'name'>, side: KitSide = 'home'): KitSpec {
  const spec = KIT_SPECS[club.id];
  return spec ? parseKit(spec[side === 'home' ? 0 : 1]) : autoKit(club, side);
}

/** 도트 아바타 상의 한 칸의 색. 소매는 가로 6 이하·17 이상, 몸통은 7~16 × 13~19. */
export function kitColorAt(k: KitSpec, x: number, y: number): string {
  const { body, pc } = k;
  if (x <= 6 || x >= 17) return k.pat === 'half' && x >= 17 && k.sleeve === body ? pc : k.sleeve;
  switch (k.pat) {
    case 'v':
      return (x - 7) % 4 >= 2 ? pc : body;
    case 'v1':
      return (x - 7) % 3 === 1 ? pc : body;
    case 'h':
      return y === 15 || y === 16 || y === 18 || y === 19 ? pc : body;
    case 'hoop':
      return y === 16 || y === 17 ? pc : body;
    case 'half':
      return x >= 12 ? pc : body;
    case 'hh':
      return y >= 17 ? pc : body;
    case 'band':
      return x >= 10 && x <= 13 ? pc : body;
    case 'sash':
      return Math.abs(x - (7 + (y - 13) * 1.5)) <= 1.1 ? pc : body;
    case 'ch': {
      const yc = 14 + (5.5 - Math.abs(x - 11.5)) * 0.55;
      return y >= yc && y < yc + 2 ? pc : body;
    }
    case 'q':
      return x >= 12 !== y >= 16 ? pc : body;
    case 'cr':
      return x === 11 || x === 12 || y === 16 ? pc : body;
    case 'dz':
      return ((x + y) & 2) ^ ((x - y + 40) & 2) ? pc : body;
    case 'tri':
      return x <= 9 ? body : x <= 13 ? pc : (k.pc2 ?? pc);
    case 'yoke':
      return y <= 14 ? pc : body;
    case 'side':
      return x === 7 || x === 16 ? pc : body;
    default:
      return body;
  }
}
