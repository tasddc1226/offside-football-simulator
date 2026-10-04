// T-10-079 공유 이미지의 결번 유니폼 — 은퇴 세리머니(RnJersey.svelte)와 같은 도안(JERSEY)을 캔버스에 그린다.
// SVG 필터 대신 캔버스로: 흐린 주름은 굵기를 줄여 가며 겹쳐 긋고, 원단 결은 시드 고정 노이즈 타일을 overlay로 깐다.
import { JERSEY as J } from '@offside/app-core/rnStyle';
import type { JerseyArt } from '@offside/app-core/shareCard';

const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};
/** ±불투명도 → 흰색(+)·검정(−). */
const tone = (o: number) => (o > 0 ? `rgba(255, 255, 255, ${o})` : `rgba(0, 0, 0, ${-o})`);

function shade(
  ctx: CanvasRenderingContext2D,
  [x0, y0, x1, y1]: [number, number, number, number],
  stops: readonly (readonly [number, number])[],
) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [at, o] of stops) g.addColorStop(at, tone(o));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 120, 124);
}

/** 원단 결 — 같은 카드는 늘 같은 이미지가 나오게 시드를 고정한다. */
function cloth(ctx: CanvasRenderingContext2D) {
  const tile = document.createElement('canvas');
  tile.width = tile.height = 64;
  const t = tile.getContext('2d')!;
  const img = t.createImageData(64, 64);
  let seed = 7;
  for (let i = 0; i < img.data.length; i += 4) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    img.data.fill(seed & 255, i, i + 3);
    img.data[i + 3] = 90;
  }
  t.putImageData(img, 0, 0);
  return ctx.createPattern(tile, 'repeat');
}

/** 유니폼을 가운데 cx, 위 top, 폭 width(px)로 그린다. 뒤 조명·바닥 그림자까지 포함. */
export function drawJersey(
  ctx: CanvasRenderingContext2D,
  { cx, top, width }: { cx: number; top: number; width: number },
  j: JerseyArt,
  font: { name: string; number: string },
) {
  const k = width / 120;
  const { base, ink, trim } = j.colors;
  const shirt = new Path2D(J.shirt);
  ctx.save();
  ctx.translate(cx - 60 * k, top);
  ctx.scale(k, k);

  // 뒤 조명(구단 색)과 바닥 그림자
  const glow = ctx.createRadialGradient(60, 58, 0, 60, 58, 100);
  glow.addColorStop(0, rgba(trim, 0.28));
  glow.addColorStop(1, rgba(trim, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(-40, -40, 200, 200);
  const floor = ctx.createRadialGradient(60, 0, 0, 60, 0, 48);
  floor.addColorStop(0, 'rgba(0, 0, 0, 0.6)');
  floor.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.save();
  ctx.translate(0, 131);
  ctx.scale(1, 0.12);
  ctx.fillStyle = floor;
  ctx.fillRect(0, -48, 120, 96);
  ctx.restore();

  // 몸판 + 그림자(그림자 값은 변환을 따르지 않는 캔버스 픽셀이다)
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 18 * k;
  ctx.shadowOffsetY = 7 * k;
  ctx.fillStyle = base;
  ctx.fill(shirt);
  ctx.restore();

  ctx.save();
  ctx.clip(shirt);
  for (const s of J.sleeves) {
    ctx.fillStyle = `rgba(0, 0, 0, ${s.o})`;
    ctx.fill(new Path2D(s.d));
  }
  ctx.fillStyle = trim;
  for (const d of J.cuffs) ctx.fill(new Path2D(d));
  shade(ctx, [0, 0, 120, 0], J.bodyShade);
  shade(ctx, [0, 0, 0, 124], J.vertShade);
  ctx.lineCap = 'round';
  for (const f of J.folds) {
    const p = new Path2D(f.d);
    // 흐린 주름: 굵고 옅은 선부터 가늘고 진한 선까지 겹친다.
    for (const [w, a] of [
      [3.2, 0.3],
      [2, 0.35],
      [1, 0.45],
    ] as const) {
      ctx.strokeStyle = tone(f.o * a);
      ctx.lineWidth = f.w * w;
      ctx.stroke(p);
    }
  }
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.38)';
  for (const d of J.seams) ctx.stroke(new Path2D(d));
  ctx.lineWidth = 0.45;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.setLineDash([1.2, 1.1]);
  for (const d of J.stitches) ctx.stroke(new Path2D(d));
  ctx.setLineDash([]);
  const grain = cloth(ctx);
  if (grain) {
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = grain;
    ctx.fillRect(0, 0, 120, 124);
  }
  ctx.restore();

  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fill(new Path2D(J.collarInside));
  ctx.fillStyle = trim;
  ctx.fill(new Path2D(J.collar));
  ctx.lineWidth = 0.8;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.stroke(shirt);

  // 프린트: 이름은 곡선을 따라 한 글자씩, 등번호는 테두리 위에 채운다.
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowOffsetY = 1.1 * k;
  ctx.shadowBlur = 1 * k;
  ctx.fillStyle = ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = font.name;
  const { x0, x1, y0, yc } = J.arc;
  const chars = [...j.name];
  const raw = chars.map((ch) => ctx.measureText(ch).width);
  // 긴 이름은 등판(J.nameMax) 안에 들어오게 글자를 줄인다.
  const f = Math.min(1, J.nameMax / raw.reduce((n, w) => n + w + 1.2, -1.2));
  const ws = raw.map((w) => w * f);
  const gap = 1.2 * f;
  let x = 60 - ws.reduce((n, w) => n + w + gap, -gap) / 2;
  chars.forEach((ch, i) => {
    const mid = x + ws[i]! / 2;
    const t = (mid - x0) / (x1 - x0);
    const y = (1 - t) ** 2 * y0 + 2 * t * (1 - t) * yc + t ** 2 * y0;
    ctx.save();
    ctx.translate(mid, y);
    ctx.rotate(Math.atan2(2 * (yc - y0) * (1 - 2 * t), x1 - x0));
    ctx.scale(f, f);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    x += ws[i]! + gap;
  });
  ctx.font = font.number;
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = trim;
  ctx.strokeText(String(j.number), 60, J.numberY);
  ctx.shadowColor = 'transparent';
  ctx.fillText(String(j.number), 60, J.numberY);
  ctx.restore();
}
