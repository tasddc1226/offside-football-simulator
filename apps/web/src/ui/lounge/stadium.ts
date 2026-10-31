// T-11-600 라운지 필드 경기장 — 빨간 계단식 관중석 · 좌석 글자 · 캔틸레버 지붕 · 조명 · LED 광고판 · 벤치.
// 카메라에서 먼 쪽(화면 위)은 높은 관중석, 카메라 쪽(화면 아래)은 선수가 가려지지 않게 낮은 몇 줄만 둔다.
// 카메라를 돌리면 어느 변이 먼 쪽인지가 바뀌므로 그릴 때마다 정한다.
import {
  APRON,
  PITCH_L,
  PITCH_W,
  depthOf,
  hash,
  toScreen,
  tracePath,
  zScale,
  type View,
} from './field.js';

type P3 = [number, number, number];
/** 관중석 하나의 좌표계: u는 경기장 변을 따라, d는 경기장에서 멀어지는 쪽, z는 높이. */
type Frame = (u: number, d: number, z: number) => P3;

interface Side {
  seed: string;
  frame: Frame;
  /** 경기장 바깥쪽 방향 · u가 자라는 방향(월드). */
  normal: [number, number];
  along: [number, number];
  /** 변 길이. 관중석의 곧은 부분은 u가 -APRON부터 len + APRON까지다. */
  len: number;
  /** u 시작 끝 · 끝 끝에서 만나는 변(SIDES 순번). 모서리를 누가 덮을지 정한다. */
  ends: [number, number];
  lettering: string;
  /** 변 가운데(그리는 순서용). */
  mid: [number, number];
}

const SIDES: Side[] = [
  {
    seed: 'fy',
    frame: (u, d, z) => [u, -APRON - d, z],
    normal: [0, -1],
    along: [1, 0],
    len: PITCH_L,
    ends: [2, 3],
    lettering: 'OFFSIDE',
    mid: [PITCH_L / 2, -APRON],
  },
  {
    seed: 'ny',
    frame: (u, d, z) => [u, PITCH_W + APRON + d, z],
    normal: [0, 1],
    along: [1, 0],
    len: PITCH_L,
    ends: [2, 3],
    lettering: 'OFFSIDE',
    mid: [PITCH_L / 2, PITCH_W + APRON],
  },
  {
    seed: 'fx',
    frame: (u, d, z) => [-APRON - d, u, z],
    normal: [-1, 0],
    along: [0, 1],
    len: PITCH_W,
    ends: [0, 1],
    lettering: 'FULL TIME',
    mid: [-APRON, PITCH_W / 2],
  },
  {
    seed: 'nx',
    frame: (u, d, z) => [PITCH_L + APRON + d, u, z],
    normal: [1, 0],
    along: [0, 1],
    len: PITCH_W,
    ends: [0, 1],
    lettering: 'FULL TIME',
    mid: [PITCH_L + APRON, PITCH_W / 2],
  },
];

const SEAT = '#c8102e';
const SEAT_DARK = '#8f0b20';
const CONCRETE = '#5b6170';
const CONCRETE_DARK = '#3d424e';
const ROOF = '#d5d9e0';
const ROOF_EDGE = '#9aa1ad';

/** 먼 관중석 치수. */
const FAR = { rows: 12, rd: 0.75, rh: 0.55, base: 1.2, gap: 0.5, roofZ: 10.5, roofFrom: 6.2 };
/** 가까운 관중석 치수. */
const NEAR = { rows: 3, rd: 1, rh: 0.45, base: 0.9, gap: 0.3 };

/**
 * 관중석 끝이 모서리에서 어떻게 끝나는지. 'miter'면 같은 높이의 이웃 관중석과 45도로 맞물리고(깊이 d만큼 늘어난다),
 * 숫자면 그만큼 곧게 늘어나 모서리를 덮는다(낮은 이웃 옆의 높은 관중석). 0이면 모서리에서 멈춘다.
 */
type End = number | 'miter';
/** u 범위와 두 끝. 깊이 d에서 실제로 덮는 u 구간을 준다. */
interface Span {
  a: number;
  b: number;
  e0: End;
  e1: End;
}
const at = (s: Span, d: number): [number, number] => [
  s.a - (s.e0 === 'miter' ? d : s.e0),
  s.b + (s.e1 === 'miter' ? d : s.e1),
];
/** 깊이 d0~d1, 높이 z0 → z1 띠. 모서리 끝은 Span을 따라 잘린다. */
function band(s: Span, d0: number, d1: number, z0: number, z1 = z0): [number, number, number][] {
  const [p0, p1] = at(s, d0);
  const [q0, q1] = at(s, d1);
  return [
    [p0, d0, z0],
    [p1, d0, z0],
    [q1, d1, z1],
    [q0, d1, z1],
  ];
}
/** 깊이 d에 선 벽(높이 z0~z1). */
function wall(s: Span, d: number, z0: number, z1: number): [number, number, number][] {
  const [p0, p1] = at(s, d);
  return [
    [p0, d, z0],
    [p1, d, z0],
    [p1, d, z1],
    [p0, d, z1],
  ];
}

function quad(
  ctx: CanvasRenderingContext2D,
  v: View,
  f: Frame,
  pts: [number, number, number][],
  fill: string,
  stroke?: string,
) {
  if (
    !tracePath(
      ctx,
      v,
      pts.map(([u, d, z]) => f(u, d, z)),
    )
  )
    return;
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

/** 글자를 그릴 기준 크기(px). 실제 크기는 글자마다 그 자리의 화면 축척으로 맞춘다. */
const GLYPH_PX = 100;

/**
 * 관중석 · 광고판 면 위에 글을 붙인다. (u, d, z)가 글 시작점(align이 center면 가운데)의 글줄 바닥, u쪽으로 쓰고
 * up(d, z 방향 1미터)이 글자의 위쪽이다. 1인칭 원근에서도 맞게 글자마다 그 자리의 기울기로 따로 그린다.
 */
function planeString(
  ctx: CanvasRenderingContext2D,
  v: View,
  f: Frame,
  at: [number, number, number],
  up: [number, number],
  text: string,
  size: number,
  weight: number,
  align: 'left' | 'center' = 'left',
) {
  ctx.font = `${weight} ${GLYPH_PX}px system-ui, sans-serif`;
  // 이름표 등이 남긴 정렬이 이어지면 좁은 글자(I)가 옆 글자 밑에 묻히고 글줄이 아래로 처진다.
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const m = size / GLYPH_PX;
  const total = ctx.measureText(text).width * m;
  let u = at[0] - (align === 'center' ? total / 2 : 0);
  const [, d, z] = at;
  for (const ch of text) {
    const w = ctx.measureText(ch).width * m;
    const o = toScreen(v, ...f(u, d, z));
    // 1인칭에서 카메라에 바짝 붙은 글자는 화면을 덮으므로 건너뛴다.
    if (o.ok && o.s < 300 && ch.trim()) {
      const e = 0.05;
      const pu = toScreen(v, ...f(u + e, d, z));
      const pv = toScreen(v, ...f(u, d + up[0] * e, z + up[1] * e));
      if (!pu.ok || !pv.ok) {
        u += w;
        continue;
      }
      const k = m / e;
      ctx.save();
      // 캔버스 y는 아래로 자라므로 글자의 위쪽(-y)이 up 방향이 되게 뒤집는다.
      ctx.transform(
        (pu.sx - o.sx) * k,
        (pu.sy - o.sy) * k,
        (o.sx - pv.sx) * k,
        (o.sy - pv.sy) * k,
        o.sx,
        o.sy,
      );
      ctx.fillText(ch, 0, 0);
      ctx.restore();
    }
    u += w;
  }
}

const CROWD_SHIRTS = ['#c8102e', '#c8102e', '#ffffff', '#111111', '#c8102e', '#fbe122'];
const SKINS = ['#f1c7a5', '#e0ac85', '#c68b62', '#8d5a3b'];

/** 좌석 한 줄의 관중(머리 + 상의). cheer면 들썩인다. */
function crowdRow(
  ctx: CanvasRenderingContext2D,
  v: View,
  f: Frame,
  u0: number,
  u1: number,
  d: number,
  z: number,
  row: number,
  now: number,
  cheer: boolean,
  seed: string,
) {
  for (let u = u0 + 0.3; u < u1 - 0.2; u += 0.55) {
    const hv = hash(`${seed}:${row}:${Math.round(u * 10)}`);
    if (hv % 100 < 28) continue;
    const jump = cheer ? Math.abs(Math.sin(now / 110 + (hv % 17))) * 0.35 : 0;
    const p = toScreen(v, ...f(u, d, z + jump));
    if (!p.ok) continue;
    const w = Math.max(1.5, p.s * 0.26);
    const h = Math.max(1.5, p.s * 0.3);
    ctx.fillStyle = CROWD_SHIRTS[hv % CROWD_SHIRTS.length]!;
    ctx.fillRect(p.sx - w / 2, p.sy - h, w, h);
    ctx.fillStyle = SKINS[(hv >>> 4) % SKINS.length]!;
    ctx.fillRect(p.sx - w * 0.35, p.sy - h - w * 0.75, w * 0.7, w * 0.7);
  }
}

const LED = [
  { text: 'OFFSIDE', color: '#fbe122' },
  { text: 'FULL TIME', color: '#ffffff' },
  { text: 'OFFSIDE-LAB.COM', color: '#38bdf8' },
  { text: 'WHISTLE TO WHISTLE', color: '#ff4d6d' },
];
const LED_H = 0.9;
const LED_SIZE = 0.55;
const LED_GAP = 2.5;
/** 문구마다 차지하는 폭(미터)을 한 번만 잰다 — 흐르는 동안 간격이 바뀌지 않게. */
let ledWidths: number[] | null = null;

/** 경기장 쪽을 보는 LED 광고판. 같은 순서의 문구가 끊김 없이 일정한 속도로 흐르고, 판 밖은 잘라 낸다. */
function ledBoard(
  ctx: CanvasRenderingContext2D,
  v: View,
  f: Frame,
  u0: number,
  u1: number,
  now: number,
) {
  const face: [number, number, number][] = [
    [u0, 0, 0],
    [u1, 0, 0],
    [u1, 0, LED_H],
    [u0, 0, LED_H],
  ];
  quad(ctx, v, f, face, '#0b0f19');
  if (!ledWidths) {
    ctx.font = `900 ${GLYPH_PX}px system-ui, sans-serif`;
    ledWidths = LED.map((l) => (ctx.measureText(l.text).width * LED_SIZE) / GLYPH_PX + LED_GAP);
  }
  const period = ledWidths.reduce((a, b) => a + b, 0);
  const offset = ((now / 1000) * 1.2) % period;
  ctx.save();
  if (
    tracePath(
      ctx,
      v,
      face.map(([u, d, z]) => f(u, d, z)),
    )
  ) {
    ctx.clip();
    for (let start = u0 - offset; start < u1; start += period) {
      let u = start;
      LED.forEach((l, i) => {
        const w = ledWidths![i]!;
        if (u + w > u0 && u < u1) {
          ctx.fillStyle = l.color;
          planeString(
            ctx,
            v,
            f,
            [u, 0, (LED_H - LED_SIZE * 0.72) / 2],
            [0, 1],
            l.text,
            LED_SIZE,
            900,
          );
        }
        u += w;
      });
    }
  }
  ctx.restore();
  quad(
    ctx,
    v,
    f,
    [
      [u0, 0, LED_H],
      [u1, 0, LED_H],
      [u1, 0.12, LED_H],
      [u0, 0.12, LED_H],
    ],
    '#1f2937',
  );
}

/** 먼 쪽 높은 관중석: 계단 좌석 · 관중 · 앞벽 · 광고판, 끝의 옆면, 지붕과 조명. */
function farStand(
  ctx: CanvasRenderingContext2D,
  v: View,
  f: Frame,
  span: Span,
  now: number,
  cheer: boolean,
  seed: string,
  lettering: string | null,
  /** 화면 쪽을 보는 끝(옆면을 그릴 쪽). */
  endAt: 'u0' | 'u1',
) {
  const { rows, rd, rh, base, gap, roofZ, roofFrom } = FAR;
  const depth = gap + rows * rd;
  for (let i = rows - 1; i >= 0; i--) {
    const d0 = gap + i * rd;
    const d1 = d0 + rd;
    const z = base + (i + 1) * rh;
    quad(ctx, v, f, band(span, d0, d1, z), i % 2 ? SEAT : '#b50e29');
    const [c0, c1] = at(span, d0 + rd * 0.45);
    crowdRow(ctx, v, f, c0, c1, d0 + rd * 0.45, z, i, now, cheer, seed);
    quad(ctx, v, f, wall(span, d0, z - rh, z), SEAT_DARK);
  }
  // 좌석 글자(관중 위에 흰 좌석으로).
  if (lettering) {
    const n = Math.hypot(rd, rh);
    ctx.fillStyle = '#ffffff';
    planeString(
      ctx,
      v,
      f,
      [(span.a + span.b) / 2, gap + rd * 2.5, base + rh * 2.9],
      [rd / n, rh / n],
      lettering,
      3.4,
      900,
      'center',
    );
  }
  // 앞벽(경기장과 첫 줄 사이).
  quad(ctx, v, f, wall(span, gap, 0, base), CONCRETE);
  quad(ctx, v, f, band(span, 0, gap, 0), CONCRETE_DARK);
  // 광고판은 경기장 변 길이만큼만(모서리 관중석 앞으로 삐져나오지 않게).
  ledBoard(ctx, v, f, span.a, span.b, now);
  // 화면 쪽을 보는 끝 옆면(계단 모양). 이웃과 맞물린 끝은 옆면이 없다.
  const end = endAt === 'u0' ? span.e0 : span.e1;
  if (end !== 'miter') {
    const ue = endAt === 'u0' ? span.a - end : span.b + end;
    const pts: [number, number, number][] = [
      [ue, 0, 0],
      [ue, gap, 0],
      [ue, gap, base],
    ];
    for (let i = 0; i < rows; i++) {
      const z = base + (i + 1) * rh;
      pts.push([ue, gap + i * rd, z], [ue, gap + (i + 1) * rd, z]);
    }
    pts.push([ue, depth, roofZ], [ue, depth, 0]);
    quad(ctx, v, f, pts, CONCRETE_DARK);
  }
  // 캔틸레버 지붕: 위에서 보이는 윗면 · 앞 가장자리 · 조명.
  quad(ctx, v, f, band(span, roofFrom, depth + 0.3, roofZ), ROOF, ROOF_EDGE);
  for (let d = roofFrom + 0.8; d < depth; d += 0.8)
    quad(ctx, v, f, band(span, d, d + 0.05, roofZ), ROOF_EDGE);
  quad(ctx, v, f, wall(span, roofFrom, roofZ - 0.6, roofZ), '#e9ecf1', ROOF_EDGE);
  const [l0, l1] = at(span, roofFrom);
  for (let u = l0 + 2; u < l1 - 1; u += 3.5) {
    const p = toScreen(v, ...f(u, roofFrom - 0.02, roofZ - 0.3));
    if (!p.ok) continue;
    const k = p.s;
    const g = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, k * 1.6);
    g.addColorStop(0, 'rgba(255,255,240,0.55)');
    g.addColorStop(1, 'rgba(255,255,240,0)');
    ctx.fillStyle = g;
    ctx.fillRect(p.sx - k * 1.6, p.sy - k * 1.6, k * 3.2, k * 3.2);
    ctx.fillStyle = '#fffef2';
    ctx.fillRect(p.sx - k * 0.35, p.sy - k * 0.12, k * 0.7, k * 0.24);
  }
}

/** 가까운 쪽 낮은 관중석: 광고판 뒷면 · 낮은 좌석 몇 줄 · 바깥 벽. */
function nearStand(
  ctx: CanvasRenderingContext2D,
  v: View,
  f: Frame,
  span: Span,
  now: number,
  cheer: boolean,
  seed: string,
) {
  const { rows, rd, rh, base, gap } = NEAR;
  quad(ctx, v, f, wall(span, 0, 0, 0.9), '#1f2937');
  quad(ctx, v, f, band(span, 0, 0.12, 0.9), '#374151');
  quad(ctx, v, f, band(span, 0.12, gap, 0), CONCRETE_DARK);
  for (let i = 0; i < rows; i++) {
    const d0 = gap + i * rd;
    const z = base + i * rh;
    quad(ctx, v, f, band(span, d0, d0 + rd, z), i % 2 ? SEAT : '#b50e29');
    const [c0, c1] = at(span, d0 + rd * 0.5);
    crowdRow(ctx, v, f, c0, c1, d0 + rd * 0.5, z, i, now, cheer, seed);
  }
  const back = gap + rows * rd;
  const top = base + (rows - 1) * rh;
  quad(ctx, v, f, wall(span, back, 0, top), CONCRETE);
  quad(ctx, v, f, band(span, back, back + 0.2, top), CONCRETE_DARK);
}

/** 벤치(먼 쪽 하프라인 양옆): 뒷벽 · 빨간 좌석 · 투명 지붕. */
function dugout(ctx: CanvasRenderingContext2D, v: View, x0: number, x1: number) {
  const f = SIDES[0]!.frame;
  // 먼 긴 변(y=0 쪽) 좌표계의 d는 경기장 반대쪽이라, 걸어 다니는 여백 안쪽은 음수 d다.
  const back = -0.25;
  const front = -1.5;
  const H = 1.3;
  quad(
    ctx,
    v,
    f,
    [
      [x0, back, 0],
      [x1, back, 0],
      [x1, back, H],
      [x0, back, H],
    ],
    '#1f2937',
  );
  quad(
    ctx,
    v,
    f,
    [
      [x0, back - 0.1, 0.45],
      [x1, back - 0.1, 0.45],
      [x1, back - 0.55, 0.45],
      [x0, back - 0.55, 0.45],
    ],
    SEAT,
  );
  quad(
    ctx,
    v,
    f,
    [
      [x0, back - 0.55, 0],
      [x1, back - 0.55, 0],
      [x1, back - 0.55, 0.45],
      [x0, back - 0.55, 0.45],
    ],
    SEAT_DARK,
  );
  for (const x of [x0, x1])
    quad(
      ctx,
      v,
      f,
      [
        [x, back, 0],
        [x, front, 0],
        [x, front, H * 0.8],
        [x, back, H],
      ],
      'rgba(200,225,255,0.25)',
      'rgba(255,255,255,0.5)',
    );
  quad(
    ctx,
    v,
    f,
    [
      [x0, back, H],
      [x1, back, H],
      [x1, front, H * 0.8],
      [x0, front, H * 0.8],
    ],
    'rgba(200,225,255,0.32)',
    'rgba(255,255,255,0.6)',
  );
}

/** 관중석 네 변과 벤치를 먼 것부터 그린다. 경기장 잔디 다음, 선수보다 먼저 부른다. */
export function drawStands(ctx: CanvasRenderingContext2D, v: View, now: number, cheer: boolean) {
  // 카메라 쪽 방향(월드) — 깊이 축의 기울기.
  const tx = Math.sin(v.rot);
  const ty = Math.cos(v.rot);
  const nearD = NEAR.gap + NEAR.rows * NEAR.rd;
  // 1인칭이면 경기장 안에서 둘러보므로 네 변 모두 높은 관중석이다.
  const tall = SIDES.map((side) => v.fp || side.normal[0] * tx + side.normal[1] * ty <= 0.3);
  const items: { d: number; draw: () => void }[] = SIDES.map((side, i) => {
    // 같은 높이끼리는 모서리에서 45도로 맞물린다. 높은 관중석은 낮은 이웃의 뒷벽까지만 늘어나 모서리를 덮는다.
    const end = (j: number): End => (tall[i] === tall[j] ? 'miter' : tall[i] ? nearD : 0);
    let span: Span = {
      a: -APRON,
      b: side.len + APRON,
      e0: end(side.ends[0]),
      e1: end(side.ends[1]),
    };
    let f = side.frame;
    let along: [number, number] = side.along;
    // 좌석 글자가 거울처럼 뒤집혀 보이면 u를 뒤집는다: 화면에서 u 방향과 좌석 위쪽(바깥 · 위) 방향이 이루는 회전으로 판단한다.
    const mid = side.len / 2;
    const o = toScreen(v, ...side.frame(mid, 0, 0));
    const pu = toScreen(v, ...side.frame(mid + 1, 0, 0));
    const pv = toScreen(v, ...side.frame(mid, FAR.rd, FAR.rh));
    const cross = (pu.sx - o.sx) * (pv.sy - o.sy) - (pu.sy - o.sy) * (pv.sx - o.sx);
    if (cross > 0) {
      const base = side.frame;
      f = (u, d, z) => base(-u, d, z);
      span = { a: -span.b, b: -span.a, e0: span.e1, e1: span.e0 };
      along = [-along[0], -along[1]];
    }
    const endAt = along[0] * tx + along[1] * ty > 0 ? 'u1' : 'u0';
    return {
      d: depthOf(v, side.mid[0], side.mid[1]),
      draw: () =>
        tall[i]
          ? farStand(ctx, v, f, span, now, cheer, side.seed, side.lettering, endAt)
          : nearStand(ctx, v, f, span, now, cheer, side.seed),
    };
  });
  items.push(
    {
      d: depthOf(v, PITCH_L / 2 - 4.5, -APRON + 1),
      draw: () => dugout(ctx, v, PITCH_L / 2 - 6.5, PITCH_L / 2 - 2.5),
    },
    {
      d: depthOf(v, PITCH_L / 2 + 4.5, -APRON + 1),
      draw: () => dugout(ctx, v, PITCH_L / 2 + 2.5, PITCH_L / 2 + 6.5),
    },
  );
  items.sort((a, b) => a.d - b.d);
  for (const it of items) it.draw();
}

/** 저녁 경기 하늘과 경기장을 둘러싼 광장. */
export function drawSky(ctx: CanvasRenderingContext2D, v: View) {
  const g = ctx.createLinearGradient(0, 0, 0, v.h);
  g.addColorStop(0, '#0b1530');
  g.addColorStop(1, '#1b2a4a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, v.w, v.h);
  // 관중석 바깥으로 이만큼 광장을 깔고, 그 너머는 하늘로 둔다. 카메라 쪽은 화면 아래 끝까지 덮게 길게 깐다
  // (짧으면 중계 화면 · 하늘 위에서 광장 아래로 하늘이 드러난다).
  const near = (nx: number, ny: number) =>
    !v.fp && nx * Math.sin(v.rot) + ny * Math.cos(v.rot) > 0 ? 400 : 22;
  const plaza = (x0: number, y0: number, x1: number, y1: number) => {
    if (
      !tracePath(ctx, v, [
        [x0, y0, 0],
        [x1, y0, 0],
        [x1, y1, 0],
        [x0, y1, 0],
      ])
    )
      return;
    ctx.fillStyle = '#2b303b';
    ctx.fill();
  };
  plaza(
    -APRON - near(-1, 0),
    -APRON - near(0, -1),
    PITCH_L + APRON + near(1, 0),
    PITCH_W + APRON + near(0, 1),
  );
}

/**
 * 중계 화면에서 카메라가 볼 점: 좌우는 focus를 따라가고, 깊이(화면 위아래)는 먼 관중석 지붕 끝부터
 * 가까운 관중석 뒷벽까지의 한가운데에 둔다. 경기장이 화면 위로 쏠리지 않게 한다.
 */
export function broadcastFocus(v: Pick<View, 'rot' | 'tilt'>, x: number, y: number) {
  const s = Math.sin(v.rot);
  const c = Math.cos(v.rot);
  const farD = FAR.gap + FAR.rows * FAR.rd;
  const nearD = NEAR.gap + NEAR.rows * NEAR.rd;
  // 지붕 높이만큼 화면 위로 솟은 몫을 깊이로 환산해 가운데를 그만큼 먼 쪽으로 당긴다.
  const shift = (nearD - farD) / 2 - (FAR.roofZ * zScale(v.tilt)) / (2 * Math.SQRT2 * v.tilt);
  const mx = PITCH_L / 2 + s * shift;
  const my = PITCH_W / 2 + c * shift;
  const t = (mx - x) * s + (my - y) * c;
  return { x: x + s * t, y: y + c * t };
}
