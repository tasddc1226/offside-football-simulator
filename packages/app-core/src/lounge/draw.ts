// T-11-600 라운지 필드 그리기 — 캔버스 2D로 경기장 · 꼬마 선수 · 공 · 말풍선을 그린다. 그림 파일 없이 도형으로만 그린다.
import { path, type Ctx2D, type Path } from './canvas.js';
import { drawEmote } from './emotes.js';
import { drawSky, drawStands } from './stadium.js';
import {
  APRON,
  GOAL_H,
  GOAL_W,
  PITCH_L,
  PITCH_W,
  depthOf,
  moveT,
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

function pitch(ctx: Ctx2D, v: View) {
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

function dot(ctx: Ctx2D, v: View, x: number, y: number) {
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
function goal(ctx: Ctx2D, v: View, x0: number) {
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

function rrect(ctx: Ctx2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

const INK = '#1d1d22';
type Part = [Path, string];

/** 겹친 도형을 한 덩어리로: 테두리를 먼저 모두 긋고 그 위를 채운다(이모트와 같은 방식). */
function layer(ctx: Ctx2D, parts: Part[], lw: number) {
  ctx.lineWidth = lw * 2;
  ctx.strokeStyle = INK;
  for (const [p] of parts) ctx.stroke(p);
  for (const [p, c] of parts) {
    ctx.fillStyle = c;
    ctx.fill(p);
  }
}
function rr(x: number, y: number, w: number, h: number, r: number) {
  const p = path();
  p.roundRect(x, y, w, h, r);
  return p;
}
function disc(x: number, y: number, rx: number, ry = rx) {
  const p = path();
  p.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  return p;
}
/** 밝은 색이면 참(등번호를 어둡게 쓸지 고른다). */
function light(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114 > 160;
}
/** 아이디마다 정해지는 작은 수(머리 모양 · 등번호). */
function idHash(id: string) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** 머리카락. 앞모습은 바라보는 쪽(+x)으로 앞머리가 내려오고, 뒷모습은 뒤통수를 덮는다. */
function hair(style: number, hy: number, hr: number, back: boolean): Path {
  const p = path();
  if (back) {
    // 뒤통수는 목 바로 위까지 덮는다.
    p.ellipse(0, hy - hr * 0.04, hr * 1.05, hr * 1.0, 0, Math.PI * 0.8, Math.PI * 2.2);
    p.closePath();
    if (style === 1)
      for (let i = 0; i < 5; i++) {
        const t = Math.PI * (1.1 + i * 0.2);
        p.moveTo(Math.cos(t - 0.12) * hr, hy + Math.sin(t - 0.12) * hr);
        p.lineTo(Math.cos(t) * hr * 1.3, hy + Math.sin(t) * hr * 1.3);
        p.lineTo(Math.cos(t + 0.12) * hr, hy + Math.sin(t + 0.12) * hr);
        p.closePath();
      }
    if (style === 2)
      for (let i = 0; i < 7; i++) {
        const t = Math.PI * (0.85 + (i / 6) * 1.3);
        p.addPath(disc(Math.cos(t) * hr * 0.86, hy + Math.sin(t) * hr * 0.86, hr * 0.34));
      }
    if (style === 3) p.addPath(disc(0, hy - hr * 1.02, hr * 0.32));
    if (style === 4) p.addPath(rr(-hr * 0.5, hy + hr * 0.2, hr, hr * 0.85, hr * 0.4));
    return p;
  }
  switch (style) {
    case 0: // 짧은 머리 + 옆으로 넘긴 앞머리.
      p.moveTo(-hr * 1.04, hy + hr * 0.25);
      p.ellipse(0, hy - hr * 0.08, hr * 1.04, hr * 0.98, 0, Math.PI * 0.94, Math.PI * 1.98);
      p.quadraticCurveTo(hr * 0.7, hy - hr * 0.2, hr * 0.15, hy - hr * 0.42);
      p.quadraticCurveTo(-hr * 0.35, hy - hr * 0.3, -hr * 0.55, hy + hr * 0.1);
      p.closePath();
      break;
    case 1: // 삐죽 머리.
      p.moveTo(-hr * 1.02, hy + hr * 0.2);
      // 끝이 뒤(-x)로 살짝 눕는 뾰족 다발.
      for (let i = 0; i <= 10; i++) {
        const tip = i % 2 === 1;
        const t = Math.PI * (1.0 + (i / 10) * 0.98 - (tip ? 0.05 : 0));
        const r = tip ? hr * 1.3 : hr * 1.02;
        p.lineTo(Math.cos(t) * r, hy - hr * 0.08 + Math.sin(t) * r);
      }
      p.lineTo(hr * 0.2, hy - hr * 0.42);
      p.lineTo(-hr * 0.5, hy + hr * 0.05);
      p.closePath();
      break;
    case 2: // 곱슬머리: 동그라미 여러 개.
      for (let i = 0; i < 7; i++) {
        const t = Math.PI * (0.95 + (i / 6) * 1.1);
        p.addPath(
          disc(Math.cos(t) * hr * 0.86, hy - hr * 0.1 + Math.sin(t) * hr * 0.86, hr * 0.36),
        );
      }
      p.addPath(disc(0, hy - hr * 0.5, hr * 0.7, hr * 0.45));
      break;
    case 3: // 묶은 머리(정수리 똥머리).
      p.addPath(disc(-hr * 0.15, hy - hr * 1.05, hr * 0.32));
      p.moveTo(-hr * 1.04, hy + hr * 0.3);
      p.ellipse(0, hy - hr * 0.08, hr * 1.04, hr * 0.98, 0, Math.PI * 0.94, Math.PI * 1.96);
      p.quadraticCurveTo(hr * 0.4, hy - hr * 0.5, -hr * 0.45, hy + hr * 0.15);
      p.closePath();
      break;
    default: // 긴 머리(뒤로 내려온다).
      p.moveTo(-hr * 1.06, hy + hr * 0.95);
      p.ellipse(0, hy - hr * 0.08, hr * 1.06, hr * 1.0, 0, Math.PI * 0.9, Math.PI * 1.98);
      p.quadraticCurveTo(hr * 0.6, hy - hr * 0.3, -hr * 0.1, hy - hr * 0.38);
      p.quadraticCurveTo(-hr * 0.5, hy + hr * 0.1, -hr * 0.55, hy + hr * 0.95);
      p.closePath();
  }
  return p;
}

/** 꼬마 선수 한 명. 발밑이 (sx, sy)이고 s는 몸 크기(px). 머리 꼭대기는 발밑에서 약 2s 위다. */
function player(
  ctx: Ctx2D,
  v: View,
  a: Actor,
  sx: number,
  sy: number,
  s: number,
  mine: boolean,
  now: number,
) {
  const m = a.move;
  const t = moveT(a, now);
  const fallen = now < a.fallUntil;
  // 넘어진 정도(0~1): 빠르게 쓰러졌다가 끝날 즈음 일어난다.
  const fallLeft = (a.fallUntil - now) / 1100;
  const down = fallen ? Math.min(1, (1 - fallLeft) * 6) * Math.min(1, fallLeft * 4) : 0;
  // 마르세유 턴은 바라보는 쪽을 한 바퀴 돌린다.
  let fx = a.fx;
  let fy = a.fy;
  if (m?.kind === 'spin') {
    const ang = m.side * t * Math.PI * 2;
    fx = m.dx * Math.cos(ang) - m.dy * Math.sin(ang);
    fy = m.dx * Math.sin(ang) + m.dy * Math.cos(ang);
  }
  // 화면에서 바라보는 쪽: 왼쪽이면 좌우를 뒤집고, 위쪽(먼 쪽)이면 뒷모습.
  // 1인칭이면 카메라 오른쪽 · 앞 방향에 견준다(앞을 보고 있으면 뒷모습).
  const cy = Math.cos(v.eye.yaw);
  const sy0 = Math.sin(v.eye.yaw);
  const face = v.fp ? { u: -fx * sy0 + fy * cy, d: -(fx * cy + fy * sy0) } : rotate(v, fx, fy);
  const flip = face.u < 0 ? -1 : 1;
  const back = face.d < -0.15 * Math.hypot(face.u, face.d);
  let swing = Math.sin(a.step) * 0.09 * s;
  let bob = a.step ? Math.abs(Math.cos(a.step)) * 0.05 * s : 0;
  if (m?.kind === 'stepover' && t < 0.55) swing = Math.sin((t / 0.55) * Math.PI * 4) * 0.2 * s;
  if (m?.kind === 'flick') {
    bob += Math.sin(t * Math.PI) * 0.4 * s;
    swing = -0.16 * s * Math.sin(t * Math.PI);
  }
  if (m?.kind === 'tackle') swing = 0.2 * s;
  const lw = Math.min(1.6, Math.max(0.7, s * 0.035));
  const k = a.kit;
  const h = idHash(a.id);

  ctx.save();
  ctx.translate(sx, sy);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (mine) {
    ctx.beginPath();
    ctx.ellipse(0, 0, 0.55 * s, 0.25 * s, 0, 0, Math.PI * 2);
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = Math.max(2, s * 0.06);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.ellipse(0, 0, 0.38 * s, 0.15 * s, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fill();
  ctx.scale(flip, 1);
  if (m?.kind === 'tackle') {
    // 미끄러지며 뒤로 눕고, 뒤쪽에 잔디가 튄다.
    const lean = Math.min(1, t * 4) * (1 - Math.max(0, t - 0.8) * 3);
    for (let i = 0; i < 4; i++) {
      const q = (t * 3 + i * 0.27) % 1;
      ctx.fillStyle = `rgba(214, 236, 200, ${0.55 * (1 - q)})`;
      ctx.beginPath();
      ctx.arc(-(0.3 + q * 0.7) * s, -q * 0.35 * s, (0.06 + q * 0.08) * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.translate(0.15 * s * lean, 0);
    ctx.rotate(-1.15 * lean);
  } else if (fallen) {
    // 태클에 걸려 뒤로 넘어졌다가 일어난다.
    ctx.rotate(-1.4 * down);
  }
  ctx.translate(0, -bob);

  // 다리: 무릎 · 양말(윗단 줄) · 축구화.
  const legs: Part[] = [];
  const legTop: Part[] = [];
  for (const [lx, sw] of [
    [-0.11, swing],
    [0.11, -swing],
  ] as const) {
    const x = lx * s + sw;
    legs.push([rr(x - 0.065 * s, -0.52 * s, 0.13 * s, 0.2 * s, 0.05 * s), k.skin]);
    legs.push([rr(x - 0.07 * s, -0.36 * s, 0.14 * s, 0.3 * s, 0.04 * s), k.socks]);
    legs.push([rr(x - 0.08 * s, -0.1 * s, 0.22 * s, 0.11 * s, 0.05 * s), '#20232b']);
    legTop.push([rr(x - 0.07 * s, -0.33 * s, 0.14 * s, 0.035 * s, 0), shade(k.socks, 0.72)]);
    legTop.push([
      rr(x - 0.04 * s, -0.085 * s, 0.13 * s, 0.025 * s, 0.01 * s),
      'rgba(255,255,255,0.35)',
    ]);
  }
  layer(ctx, legs, lw);
  for (const [p, c] of legTop) {
    ctx.fillStyle = c;
    ctx.fill(p);
  }

  // 몸: 팔 · 반바지 · 상의를 한 덩어리로.
  const torso = path();
  torso.moveTo(-0.3 * s, -1.08 * s);
  torso.quadraticCurveTo(-0.3 * s, -1.18 * s, -0.18 * s, -1.18 * s);
  torso.lineTo(0.18 * s, -1.18 * s);
  torso.quadraticCurveTo(0.3 * s, -1.18 * s, 0.3 * s, -1.08 * s);
  torso.lineTo(0.25 * s, -0.66 * s);
  torso.lineTo(-0.25 * s, -0.66 * s);
  torso.closePath();
  const body: Part[] = [];
  for (const [ax, sw] of [
    [-0.33, -swing],
    [0.33, swing],
  ] as const) {
    const y = sw * 0.5;
    body.push([disc(ax * s, -0.82 * s + y, 0.065 * s), k.skin]);
    body.push([rr(ax * s - 0.075 * s, -1.14 * s + y, 0.15 * s, 0.26 * s, 0.06 * s), k.sleeve]);
  }
  body.push([rr(-0.26 * s, -0.72 * s, 0.52 * s, 0.24 * s, 0.06 * s), k.shorts]);
  body.push([torso, k.body]);
  layer(ctx, body, lw);
  // 상의 그늘(뒤쪽 절반) · 깃 · 등번호.
  ctx.save();
  ctx.clip(torso);
  ctx.fillStyle = 'rgba(0,0,0,0.14)';
  ctx.fillRect(-0.32 * s, -1.2 * s, 0.2 * s, 0.6 * s);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(0.12 * s, -1.2 * s, 0.07 * s, 0.6 * s);
  ctx.restore();
  const trim = k.sleeve === k.body ? shade(k.body, 0.7) : k.sleeve;
  if (back) {
    if (s >= 14) {
      ctx.font = `900 ${Math.round(0.3 * s)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // 좌우를 뒤집어 그린 몸이라 숫자만 다시 뒤집어 바로 읽히게 한다.
      ctx.save();
      ctx.scale(flip, 1);
      ctx.fillStyle = light(k.body) ? INK : '#ffffff';
      ctx.globalAlpha = 0.9;
      ctx.fillText(String((h % 23) + 1), 0, -0.9 * s);
      ctx.restore();
    }
  } else {
    ctx.fillStyle = trim;
    ctx.beginPath();
    ctx.moveTo(-0.02 * s, -1.18 * s);
    ctx.lineTo(0.08 * s, -1.06 * s);
    ctx.lineTo(0.18 * s, -1.18 * s);
    ctx.closePath();
    ctx.fill();
    // 가슴 엠블럼.
    ctx.fillStyle = trim;
    ctx.beginPath();
    ctx.arc(0.16 * s, -0.96 * s, 0.035 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  // 머리: 귀 · 얼굴 · 머리카락.
  const hy = -1.56 * s;
  const hr = 0.4 * s;
  const style = (h >>> 5) % 5;
  const head: Part[] = [];
  if (!back) head.push([disc(-hr * 0.78, hy + hr * 0.12, hr * 0.2, hr * 0.24), k.skin]);
  head.push([disc(0, hy, hr * 1.02, hr * 0.96), k.skin]);
  head.push([hair(style, hy, hr, back), k.hair]);
  layer(ctx, head, lw);
  if (!back) {
    // 눈(하이라이트) · 눈썹 · 볼 · 입. 바라보는 쪽으로 살짝 치우친다.
    for (const ex of [0.1, 0.48]) {
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.ellipse(ex * hr, hy + hr * 0.12, hr * 0.1, hr * 0.15, 0, 0, Math.PI * 2);
      ctx.fill();
      if (s >= 12) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ex * hr + hr * 0.035, hy + hr * 0.06, hr * 0.04, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (s >= 12) {
      ctx.strokeStyle = shade(k.hair, 0.9);
      ctx.lineWidth = Math.max(0.8, hr * 0.07);
      ctx.beginPath();
      ctx.moveTo(0.0 * hr, hy - hr * 0.12);
      ctx.lineTo(0.2 * hr, hy - hr * 0.15);
      ctx.moveTo(0.38 * hr, hy - hr * 0.15);
      ctx.lineTo(0.58 * hr, hy - hr * 0.12);
      ctx.stroke();
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(0.7, hr * 0.06);
      ctx.beginPath();
      ctx.arc(0.32 * hr, hy + hr * 0.36, hr * 0.12, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(244,114,114,0.45)';
    ctx.beginPath();
    ctx.ellipse(0.7 * hr, hy + hr * 0.38, hr * 0.13, hr * 0.08, 0, 0, Math.PI * 2);
    ctx.ellipse(-0.12 * hr, hy + hr * 0.38, hr * 0.13, hr * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  if (fallen && s >= 10) {
    // 넘어진 머리 위로 별이 돈다.
    const hx = sx - flip * Math.sin(1.4 * down) * 1.56 * s;
    const hy0 = sy - Math.cos(1.4 * down) * 1.56 * s - 0.55 * s;
    ctx.fillStyle = '#fde047';
    for (let i = 0; i < 3; i++) {
      const ang = now / 260 + (i * Math.PI * 2) / 3;
      const x = hx + Math.cos(ang) * 0.35 * s;
      const y = hy0 + Math.sin(ang) * 0.12 * s;
      star(ctx, x, y, 0.09 * s);
    }
  }
}

function star(ctx: Ctx2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const t = -Math.PI / 2 + (i * Math.PI) / 5;
    const q = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(t) * q, y + Math.sin(t) * q);
  }
  ctx.closePath();
  ctx.fill();
}

function label(ctx: Ctx2D, text: string, x: number, y: number, mine: boolean) {
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
function wrap(ctx: Ctx2D, text: string, max: number): string[] {
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

function bubble(ctx: Ctx2D, text: string, x: number, y: number, alpha: number) {
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

function ball(ctx: Ctx2D, v: View, b: Ball) {
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
  ctx: Ctx2D,
  v: View,
  world: World,
  now: number,
  mine: string | null,
  goalText: string,
) {
  pitch(ctx, v);
  drawStands(ctx, v, now, !!world.goal);
  drawScene(ctx, v, world, now, mine, goalText);
}

/** 하늘 · 광장 · 잔디 · 선(움직이지 않는 바닥). */
export const drawPitch = (ctx: Ctx2D, v: View) => pitch(ctx, v);

/** 골대 · 공 · 선수 · 이름표 · 말풍선 · 골 연출(경기장 · 관중석 위에 매 프레임 그리는 것). */
export function drawScene(
  ctx: Ctx2D,
  v: View,
  world: World,
  now: number,
  mine: string | null,
  goalText: string,
) {
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
        if (p.ok) player(ctx, v, a, p.sx, p.sy, p.s * 1.25, a.id === mine, now);
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
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    // 넣은 사람(구단주명) 위에, GOAL 아래에. 관중석 글자 위에서도 읽히게 어두운 띠를 깐다.
    const by = world.goal.by;
    ctx.font = '900 52px system-ui, sans-serif';
    let bw = ctx.measureText(goalText).width;
    if (by) {
      ctx.font = '800 20px system-ui, sans-serif';
      bw = Math.max(bw, ctx.measureText(by).width);
    }
    const top = by ? -56 : -30;
    ctx.fillStyle = 'rgba(10,14,20,0.62)';
    ctx.beginPath();
    ctx.roundRect(-bw / 2 - 22, top, bw + 44, 34 - top, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    if (by) {
      ctx.font = '800 20px system-ui, sans-serif';
      ctx.lineWidth = 6;
      ctx.strokeText(by, 0, -36);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(by, 0, -36);
    }
    ctx.font = '900 52px system-ui, sans-serif';
    ctx.lineWidth = 9;
    ctx.strokeText(goalText, 0, 4);
    ctx.fillStyle = '#fde047';
    ctx.fillText(goalText, 0, 4);
    ctx.restore();
  }
}
