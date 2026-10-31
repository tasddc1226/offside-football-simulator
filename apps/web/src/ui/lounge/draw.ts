// T-11-600 라운지 필드 그리기 — 캔버스 2D로 경기장 · 꼬마 선수 · 공 · 말풍선을 그린다. 그림 파일 없이 도형으로만 그린다.
import { drawEmote } from './emotes.js';
import { drawSky, drawStands } from './stadium.js';
import {
  APRON,
  GOAL_H,
  GOAL_W,
  PITCH_L,
  PITCH_W,
  depthOf,
  rotate,
  toScreen,
  tracePath,
  type Actor,
  type Ball,
  type View,
  type World,
} from './field.js';

const GRASS = ['#3f9b4b', '#47a854'];
const APRON_GRASS = '#358a41';
const LINE = 'rgba(255,255,255,0.85)';

const flat = (pts: [number, number][]) => pts.map(([x, y]) => [x, y, 0] as const);

const rect = (x0: number, y0: number, x1: number, y1: number): [number, number][] => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];

/** 선 굵기(미터)를 화면 px로 — 1인칭이면 가까운 쪽 기준으로 어림한다. */
const lineW = (v: View, m: number) => Math.max(1.5, (v.fp ? 40 : v.k) * m);

function pitch(ctx: CanvasRenderingContext2D, v: View) {
  drawSky(ctx, v);
  if (tracePath(ctx, v, flat(rect(-APRON, -APRON, PITCH_L + APRON, PITCH_W + APRON)))) {
    ctx.fillStyle = APRON_GRASS;
    ctx.fill();
  }
  // 잔디 무늬: 골라인과 나란한 띠.
  const band = PITCH_L / 12;
  for (let i = 0; i < 12; i++) {
    if (!tracePath(ctx, v, flat(rect(i * band, 0, (i + 1) * band, PITCH_W)))) continue;
    ctx.fillStyle = GRASS[i % 2]!;
    ctx.fill();
  }
  ctx.strokeStyle = LINE;
  ctx.lineWidth = lineW(v, 0.12);
  ctx.lineJoin = 'round';
  const line = (pts: [number, number][], close = true) => {
    if (tracePath(ctx, v, flat(pts), close)) ctx.stroke();
  };
  line(rect(0, 0, PITCH_L, PITCH_W));
  line(
    [
      [PITCH_L / 2, 0],
      [PITCH_L / 2, PITCH_W],
    ],
    false,
  );
  const mid = PITCH_W / 2;
  for (const [x0, dir] of [
    [0, 1],
    [PITCH_L, -1],
  ] as const) {
    line(
      [
        [x0, mid - 7],
        [x0 + dir * 5.5, mid - 7],
        [x0 + dir * 5.5, mid + 7],
        [x0, mid + 7],
      ],
      false,
    );
    line(
      [
        [x0, mid - 4],
        [x0 + dir * 2, mid - 4],
        [x0 + dir * 2, mid + 4],
        [x0, mid + 4],
      ],
      false,
    );
    dot(ctx, v, x0 + dir * 4, mid);
  }
  const circle: [number, number][] = [];
  for (let i = 0; i < 40; i++) {
    const t = (i / 40) * Math.PI * 2;
    circle.push([PITCH_L / 2 + Math.cos(t) * 3.5, mid + Math.sin(t) * 3.5]);
  }
  line(circle);
  dot(ctx, v, PITCH_L / 2, mid);
}

function dot(ctx: CanvasRenderingContext2D, v: View, x: number, y: number) {
  const r = 0.18;
  if (
    !tracePath(ctx, v, [
      [x - r, y, 0],
      [x, y - r, 0],
      [x + r, y, 0],
      [x, y + r, 0],
    ])
  )
    return;
  ctx.fillStyle = LINE;
  ctx.fill();
}

/** 골대 — 골라인의 두 기둥 · 가로대와 뒤쪽 그물. */
function goal(ctx: CanvasRenderingContext2D, v: View, x0: number) {
  const back = x0 === 0 ? -1.2 : PITCH_L + 1.2;
  const y0 = PITCH_W / 2 - GOAL_W / 2;
  const y1 = PITCH_W / 2 + GOAL_W / 2;
  // 그물(옆면 · 뒷면 · 윗면)을 반투명으로.
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  const face = (pts: [number, number, number][]) => {
    if (!tracePath(ctx, v, pts)) return;
    ctx.fill();
    ctx.stroke();
  };
  face([
    [back, y0, 0],
    [back, y1, 0],
    [back, y1, GOAL_H],
    [back, y0, GOAL_H],
  ]);
  face([
    [x0, y0, 0],
    [back, y0, 0],
    [back, y0, GOAL_H],
    [x0, y0, GOAL_H],
  ]);
  face([
    [x0, y1, 0],
    [back, y1, 0],
    [back, y1, GOAL_H],
    [x0, y1, GOAL_H],
  ]);
  face([
    [x0, y0, GOAL_H],
    [back, y0, GOAL_H],
    [back, y1, GOAL_H],
    [x0, y1, GOAL_H],
  ]);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = lineW(v, 0.18);
  ctx.lineCap = 'round';
  if (
    tracePath(
      ctx,
      v,
      [
        [x0, y0, 0],
        [x0, y0, GOAL_H],
        [x0, y1, GOAL_H],
        [x0, y1, 0],
      ],
      false,
    )
  )
    ctx.stroke();
}

function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (s: number) => Math.round(Math.min(255, Math.max(0, ((n >> s) & 255) * f)));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

function rrect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** 꼬마 선수 한 명. 발밑이 (sx, sy)이고 s는 몸 크기(px). */
function player(
  ctx: CanvasRenderingContext2D,
  v: View,
  a: Actor,
  sx: number,
  sy: number,
  s: number,
  mine: boolean,
) {
  // 화면에서 바라보는 쪽: 왼쪽이면 좌우를 뒤집고, 위쪽(먼 쪽)이면 뒷모습.
  // 1인칭이면 카메라 오른쪽 · 앞 방향에 견준다(앞을 보고 있으면 뒷모습).
  const cy = Math.cos(v.eye.yaw);
  const sy0 = Math.sin(v.eye.yaw);
  const face = v.fp
    ? { u: -a.fx * sy0 + a.fy * cy, d: -(a.fx * cy + a.fy * sy0) }
    : rotate(v, a.fx, a.fy);
  const flip = face.u < 0 ? -1 : 1;
  const backView = face.d < -0.15 * Math.hypot(face.u, face.d);
  const swing = Math.sin(a.step) * 0.09 * s;
  const bob = a.step ? Math.abs(Math.cos(a.step)) * 0.04 * s : 0;

  ctx.save();
  ctx.translate(sx, sy);
  if (mine) {
    ctx.beginPath();
    ctx.ellipse(0, 0, 0.52 * s, 0.24 * s, 0, 0, Math.PI * 2);
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = Math.max(2, s * 0.06);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.ellipse(0, 0, 0.4 * s, 0.17 * s, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fill();
  ctx.scale(flip, 1);
  ctx.translate(0, -bob);

  const k = a.kit;
  // 다리(양말 · 축구화).
  for (const [lx, sw] of [
    [-0.11, swing],
    [0.11, -swing],
  ] as const) {
    ctx.fillStyle = k.skin;
    ctx.fillRect(lx * s - 0.06 * s + sw, -0.5 * s, 0.12 * s, 0.14 * s);
    ctx.fillStyle = k.socks;
    ctx.fillRect(lx * s - 0.065 * s + sw, -0.37 * s, 0.13 * s, 0.3 * s);
    ctx.fillStyle = '#1f2937';
    rrect(ctx, lx * s - 0.07 * s + sw, -0.09 * s, 0.17 * s, 0.09 * s, 0.03 * s);
    ctx.fill();
  }
  // 반바지.
  ctx.fillStyle = k.shorts;
  rrect(ctx, -0.25 * s, -0.68 * s, 0.5 * s, 0.22 * s, 0.05 * s);
  ctx.fill();
  // 팔(소매 + 손).
  for (const [ax, sw] of [
    [-0.33, -swing],
    [0.33, swing],
  ] as const) {
    ctx.fillStyle = k.sleeve;
    rrect(ctx, ax * s - 0.07 * s, -1.12 * s + sw * 0.5, 0.14 * s, 0.22 * s, 0.05 * s);
    ctx.fill();
    ctx.fillStyle = k.skin;
    ctx.beginPath();
    ctx.arc(ax * s, -0.84 * s + sw * 0.5, 0.06 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  // 상의.
  ctx.fillStyle = k.body;
  rrect(ctx, -0.28 * s, -1.16 * s, 0.56 * s, 0.52 * s, 0.1 * s);
  ctx.fill();
  ctx.fillStyle = shade(k.body, 0.82);
  ctx.fillRect(-0.28 * s, -0.72 * s, 0.56 * s, 0.06 * s);
  // 머리.
  const hy = -1.56 * s;
  const hr = 0.4 * s;
  ctx.fillStyle = k.skin;
  ctx.beginPath();
  ctx.arc(0, hy, hr, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = k.hair;
  ctx.beginPath();
  if (backView) ctx.arc(0, hy, hr * 1.02, Math.PI * 0.85, Math.PI * 2.15);
  else ctx.arc(0, hy - hr * 0.12, hr * 1.02, Math.PI * 1.05, Math.PI * 1.95);
  ctx.fill();
  if (backView) {
    ctx.beginPath();
    ctx.arc(0, hy, hr, 0, Math.PI);
    ctx.fill();
  } else {
    // 얼굴: 바라보는 쪽으로 살짝 치우친 눈.
    ctx.fillStyle = '#111827';
    for (const ex of [-0.12, 0.16]) {
      ctx.beginPath();
      ctx.ellipse(ex * s + 0.05 * s, hy + 0.04 * s, 0.035 * s, 0.055 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(244,114,114,0.45)';
    ctx.beginPath();
    ctx.arc(0.26 * s, hy + 0.14 * s, 0.05 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, mine: boolean) {
  ctx.font = `600 11px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = mine ? '#fde047' : '#ffffff';
  ctx.fillText(text, x, y);
}

/** 말풍선 글을 최대 폭에 맞춰 줄로 나눈다(한글은 글자 단위, 3줄 넘으면 말줄임). */
function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const lines: string[] = [];
  let cur = '';
  for (const ch of text) {
    if (ctx.measureText(cur + ch).width > max && cur) {
      lines.push(cur);
      cur = ch.trim() ? ch : '';
      if (lines.length === 3) break;
    } else cur += ch;
  }
  if (lines.length < 3) lines.push(cur);
  else lines[2] = `${lines[2]!.slice(0, -1)}…`;
  return lines;
}

function bubble(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = '13px system-ui, sans-serif';
  const lines = wrap(ctx, text, 150);
  const lh = 17;
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 18;
  const h = lines.length * lh + 10;
  const bx = x - w / 2;
  const by = y - h - 8;
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  rrect(ctx, bx + 1, by + 2, w, h, 10);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  rrect(ctx, bx, by, w, h, 10);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - 6, by + h - 1);
  ctx.lineTo(x, by + h + 7);
  ctx.lineTo(x + 6, by + h - 1);
  ctx.fill();
  ctx.fillStyle = '#111827';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  lines.forEach((l, i) => ctx.fillText(l, x, by + 6 + i * lh));
  ctx.restore();
  return h + 8;
}

function ball(ctx: CanvasRenderingContext2D, v: View, b: Ball) {
  const g = toScreen(v, b.x, b.y);
  if (!g.ok) return;
  const r = Math.max(v.fp ? 2 : 4, g.s * 0.3);
  const shadow = Math.max(0.4, 1 - b.z * 0.25);
  ctx.beginPath();
  ctx.ellipse(g.sx, g.sy, r * shadow, r * 0.45 * shadow, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fill();
  const p = toScreen(v, b.x, b.y, b.z);
  const cy = p.sy - r;
  ctx.beginPath();
  ctx.arc(p.sx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#1f2937';
  ctx.lineWidth = 1;
  ctx.stroke();
  // 굴러가는 느낌의 검은 조각.
  const roll = (b.x + b.y) * 2;
  ctx.fillStyle = '#1f2937';
  for (let i = 0; i < 3; i++) {
    const t = roll + (i * Math.PI * 2) / 3;
    ctx.beginPath();
    ctx.arc(p.sx + Math.cos(t) * r * 0.5, cy + Math.sin(t) * r * 0.5, r * 0.22, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawWorld(
  ctx: CanvasRenderingContext2D,
  v: View,
  world: World,
  now: number,
  mine: string | null,
  goalText: string,
) {
  pitch(ctx, v);
  const cheer = !!world.goal;
  drawStands(ctx, v, now, cheer);
  // 1인칭이면 내 선수는 그리지 않는다(카메라가 그 눈에 있다).
  const shown = [...world.actors.values()].filter((a) => !(v.fp && a.id === mine));
  type Item = { d: number; draw: () => void };
  const items: Item[] = [
    { d: depthOf(v, -0.6, PITCH_W / 2), draw: () => goal(ctx, v, 0) },
    { d: depthOf(v, PITCH_L + 0.6, PITCH_W / 2), draw: () => goal(ctx, v, PITCH_L) },
    { d: depthOf(v, world.ball.x, world.ball.y), draw: () => ball(ctx, v, world.ball) },
  ];
  for (const a of shown) {
    items.push({
      d: depthOf(v, a.x, a.y),
      draw: () => {
        const p = toScreen(v, a.x, a.y);
        if (p.ok) player(ctx, v, a, p.sx, p.sy, p.s * 1.25, a.id === mine);
      },
    });
  }
  items.sort((p, q) => p.d - q.d);
  for (const it of items) it.draw();

  // 이름 · 말풍선 · 이모트는 모든 몸 위에 그려 가려지지 않게 한다.
  for (const a of shown) {
    const p = toScreen(v, a.x, a.y);
    // 1인칭에서 아주 멀거나 카메라 뒤면 이름표를 그리지 않는다.
    if (!p.ok || p.s < 3) continue;
    label(ctx, a.name, p.sx, p.sy + 4, a.id === mine);
    let top = p.sy - p.s * 1.25 * 2.05;
    if (a.bubble && now < a.bubble.until) {
      const left = a.bubble.until - now;
      top -= bubble(ctx, a.bubble.text, p.sx, top, Math.min(1, left / 500));
    }
    if (a.emote && now < a.emote.until) {
      const t = 1 - (a.emote.until - now) / 2500;
      // 처음 0.15초는 톡 튀어나오듯 커지고, 위로 살짝 떴다 내려앉는다.
      const pop = Math.min(1, t / 0.06);
      const size = 26 * (pop < 1 ? 0.6 + pop * 0.55 : 1.15 - Math.min(0.15, (t - 0.06) * 1.5));
      ctx.globalAlpha = Math.min(1, (a.emote.until - now) / 400);
      drawEmote(ctx, a.emote.key, p.sx, top - 4 - size / 2 - Math.sin(t * Math.PI) * 10, size);
      ctx.globalAlpha = 1;
    }
  }

  if (world.goal) {
    const t = 1 - (world.goal.until - now) / 2200;
    const scale = Math.min(1, t * 5);
    ctx.save();
    ctx.translate(v.w / 2, v.h * 0.32);
    ctx.scale(scale, scale);
    ctx.font = '900 44px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.strokeText(goalText, 0, 0);
    ctx.fillStyle = '#fde047';
    ctx.fillText(goalText, 0, 0);
    ctx.restore();
  }
}
