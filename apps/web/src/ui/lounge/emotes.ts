// T-11-600 라운지 필드 이모트 — 기기마다 모양이 다른 시스템 이모지 대신 직접 그린 그림을 쓴다.
// 그림은 24×24 칸 기준이고, 필드 캔버스와 버튼 아이콘(EmoteIcon)이 같은 함수로 그린다.
// 굵은 테두리는 "테두리를 두 배 굵기로 먼저 긋고 그 위를 채우기" 순서로 그려 겹친 도형 안쪽 선이 보이지 않게 한다.

export const EMOTES = ['wave', 'thumbs', 'laugh', 'fire', 'ball', 'heart'] as const;
export type EmoteKey = (typeof EMOTES)[number];
/** 이모트 버튼 · 공 차기 · 태클 · 개인기 버튼에만 쓰는 아이콘. */
export type IconKey = EmoteKey | 'smile' | 'tackle' | 'trick';

const INK = '#1d1d22';
const SKIN = '#f6c28b';
const YELLOW = '#ffd23f';
const RED = '#c8102e';

type Ctx = CanvasRenderingContext2D;

/** 바깥 테두리만 남기고 채운다. */
function solid(ctx: Ctx, path: Path2D, fill: string) {
  ctx.lineWidth = 3.2;
  ctx.strokeStyle = INK;
  ctx.stroke(path);
  ctx.fillStyle = fill;
  ctx.fill(path);
}
function line(ctx: Ctx, d: string, width = 1.6, color = INK) {
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.stroke(new Path2D(d));
}
function fill(ctx: Ctx, d: string, color: string) {
  ctx.fillStyle = color;
  ctx.fill(new Path2D(d));
}
function circle(cx: number, cy: number, r: number) {
  const p = new Path2D();
  p.arc(cx, cy, r, 0, Math.PI * 2);
  return p;
}

function face(ctx: Ctx) {
  solid(ctx, circle(12, 12, 9), YELLOW);
  // 아래쪽 그늘.
  ctx.save();
  ctx.clip(circle(12, 12, 9));
  ctx.fillStyle = 'rgba(232,140,20,0.35)';
  ctx.fill(circle(12, 6.5, 12.5));
  ctx.restore();
  ctx.fillStyle = YELLOW;
  ctx.fill(circle(12, 10.6, 8.2));
}

const DRAW: Record<IconKey, (ctx: Ctx) => void> = {
  wave(ctx) {
    // 흔드는 손: 손가락 넷 + 엄지 + 손바닥을 한 덩어리로 그린 뒤 살짝 기울인다.
    line(ctx, 'M3.2 8.5c.6-2 1.8-3.5 3.6-4.6', 1.4);
    line(ctx, 'M2.6 12.6c-.4-1.3-.3-2.5.2-3.6', 1.4);
    ctx.save();
    ctx.translate(13, 13);
    ctx.rotate(-0.28);
    ctx.translate(-13, -13);
    const hand = new Path2D();
    hand.roundRect(7.6, 3.6, 3, 10, 1.5);
    hand.roundRect(10.6, 2.4, 3, 11, 1.5);
    hand.roundRect(13.6, 3, 3, 10.5, 1.5);
    hand.roundRect(16.6, 5, 2.8, 9, 1.4);
    hand.roundRect(7.4, 10, 12, 11, 4.2);
    const thumb = new Path2D();
    thumb.roundRect(3.6, 12.2, 7, 3, 1.5);
    solid(ctx, thumb, SKIN);
    solid(ctx, hand, SKIN);
    line(ctx, 'M10.6 5.8v5.6M13.6 5.4v6M16.6 7v4.6', 1.1);
    ctx.restore();
  },
  thumbs(ctx) {
    const hand = new Path2D();
    hand.roundRect(9.6, 2.6, 3.8, 10, 1.9);
    hand.roundRect(8, 10, 10.4, 10, 2.6);
    const cuff = new Path2D();
    cuff.roundRect(3.4, 10.4, 5, 10.2, 1.2);
    solid(ctx, cuff, RED);
    solid(ctx, hand, SKIN);
    line(ctx, 'M13 13.2h5M13 16h5M13 18.6h4.6', 1.1);
    fill(ctx, 'M4.4 11.6h3v1.4h-3z', '#ffffff');
  },
  laugh(ctx) {
    face(ctx);
    // 질끈 감은 눈 · 활짝 벌린 입 · 양옆 눈물.
    line(ctx, 'M6.8 9.6l2.4 1.2-2.4 1.2M17.2 9.6l-2.4 1.2 2.4 1.2', 1.5);
    const mouth = new Path2D('M6.6 13.4h10.8a5.4 5.4 0 0 1-10.8 0z');
    solid(ctx, mouth, '#7a1f2b');
    ctx.save();
    ctx.clip(mouth);
    ctx.fillStyle = '#ff6b81';
    ctx.fill(circle(12, 19.2, 3.2));
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(6.6, 13.4, 10.8, 1.4);
    ctx.restore();
    for (const s of [-1, 1]) {
      const tear = new Path2D(
        `M${12 + s * 8.6} 10.2c${s * 1.6} 1.7 ${s * 2.4} 3 ${s * 2.4} 4.1a2.4 2.4 0 0 1-4.8 0c0-1.1.8-2.4 2.4-4.1z`,
      );
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = INK;
      ctx.stroke(tear);
      ctx.fillStyle = '#5ec8ff';
      ctx.fill(tear);
    }
  },
  fire(ctx) {
    solid(
      ctx,
      new Path2D(
        'M12 1.8c1.2 3.6 6.4 5.8 6.4 12a6.4 6.4 0 0 1-12.8 0c0-2.8 1.3-4.6 2.9-5.9.2 1.9 1.1 3 2.2 3.6-.7-3.8.2-6.8 1.3-9.7z',
      ),
      '#ff5a1f',
    );
    fill(
      ctx,
      'M12 9.8c.9 2.2 4 3.4 4 6.6a4 4 0 0 1-8 0c0-1.7 1-2.9 2-3.6.2 1 .7 1.5 1.2 1.8-.3-1.7.1-3.4.8-4.8z',
      '#ffa41b',
    );
    fill(
      ctx,
      'M12 14.4c.5 1.2 2.1 1.8 2.1 3.4a2.1 2.1 0 0 1-4.2 0c0-1 .6-1.6 1.1-2 .1.5.4.8.6.9-.1-.9.1-1.6.4-2.3z',
      YELLOW,
    );
  },
  ball(ctx) {
    const ball = circle(12, 12, 9);
    solid(ctx, ball, '#ffffff');
    ctx.save();
    ctx.clip(ball);
    const pent = (cx: number, cy: number, r: number, rot: number) => {
      const p = new Path2D();
      for (let i = 0; i < 5; i++) {
        const t = rot + (i * Math.PI * 2) / 5;
        if (i) p.lineTo(cx + Math.cos(t) * r, cy + Math.sin(t) * r);
        else p.moveTo(cx + Math.cos(t) * r, cy + Math.sin(t) * r);
      }
      p.closePath();
      return p;
    };
    ctx.fillStyle = INK;
    ctx.fill(pent(12, 12, 3.2, -Math.PI / 2));
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = INK;
    for (let i = 0; i < 5; i++) {
      const t = -Math.PI / 2 + (i * Math.PI * 2) / 5;
      const [x0, y0] = [12 + Math.cos(t) * 3.2, 12 + Math.sin(t) * 3.2];
      const [x1, y1] = [12 + Math.cos(t) * 8.5, 12 + Math.sin(t) * 8.5];
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      ctx.fill(pent(x1, y1, 2.3, t + Math.PI / 5));
    }
    ctx.restore();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = INK;
    ctx.stroke(ball);
  },
  heart(ctx) {
    solid(
      ctx,
      new Path2D(
        'M12 20.6S3.4 15.2 3.4 9.2A4.7 4.7 0 0 1 12 6.6a4.7 4.7 0 0 1 8.6 2.6c0 6-8.6 11.4-8.6 11.4z',
      ),
      '#ff3b5c',
    );
    fill(
      ctx,
      'M6.4 9.4a2.2 2.2 0 0 1 2.4-2.2c.5 0 .6.6.1.8-.9.4-1.4 1-1.6 1.8-.2.6-.9.4-.9-.4z',
      'rgba(255,255,255,0.75)',
    );
  },
  tackle(ctx) {
    // 미끄러져 들어가는 축구화와 속도선 · 튀는 잔디.
    line(ctx, 'M1.5 9.5h5M2.5 13h4.5M1.5 16.5h3', 1.6, '#ffffff');
    const boot = new Path2D('M8 9.5h4.2l1.6 2.6h4.4c2.2 0 3.6 1.4 3.6 3.2v1.2H8z');
    solid(ctx, boot, '#ffffff');
    const sole = new Path2D();
    sole.roundRect(7.4, 16.5, 15, 2.6, 1.3);
    solid(ctx, sole, '#9ca3af');
    fill(ctx, 'M9 13.4h3.6l1.6-1.3h2.4l-2.6 2.6H9z', RED);
    for (const [x, y] of [
      [6.2, 20.4],
      [9.6, 21.2],
      [13.2, 20.6],
    ])
      fill(ctx, `M${x} ${y}m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0`, '#7bd88f');
  },
  trick(ctx) {
    // 머리 위로 넘기는 공(레인보우 플릭)과 점선 궤적 · 화살표.
    ctx.setLineDash([2, 2.2]);
    line(ctx, 'M3.5 20.5C4 9 20 9 20.5 18.5', 1.7, '#ffffff');
    ctx.setLineDash([]);
    line(ctx, 'M18 16.4l2.5 2.3 2-2.8', 1.7, '#ffffff');
    const b = circle(12, 8.5, 5);
    solid(ctx, b, '#ffffff');
    fill(ctx, 'M12 6.2l2.1 1.5-.8 2.5h-2.6l-.8-2.5z', INK);
  },
  smile(ctx) {
    face(ctx);
    fill(
      ctx,
      'M8 8.4a1.3 1.6 0 1 0 0 3.2 1.3 1.6 0 1 0 0-3.2zM16 8.4a1.3 1.6 0 1 0 0 3.2 1.3 1.6 0 1 0 0-3.2z',
      INK,
    );
    line(ctx, 'M7.4 13.8c1.2 2.4 2.8 3.4 4.6 3.4s3.4-1 4.6-3.4', 1.7);
    fill(
      ctx,
      'M5.6 13.4a1.5 1 0 1 0 0 2 1.5 1 0 1 0 0-2zM18.4 13.4a1.5 1 0 1 0 0 2 1.5 1 0 1 0 0-2z',
      'rgba(255,107,129,0.55)',
    );
  },
};

/** (cx, cy)를 가운데로 size px 크기의 이모트를 그린다. */
export function drawEmote(ctx: Ctx, key: IconKey, cx: number, cy: number, size: number) {
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(size / 24, size / 24);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  DRAW[key](ctx);
  ctx.restore();
}
