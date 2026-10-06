// T-10-079 공유 이미지의 결번 유니폼 — 은퇴 세리머니·결번 벽과 같은 도트 액자(@offside/game/rnFrame)를 캔버스에 그린다.
import type { JerseyArt } from '@offside/app-core/shareCard';
import { RN_FRAME_H, RN_FRAME_W, rnFramePaths } from '@offside/game/rnFrame';

/** 액자를 가운데 cx, 위 top에 칸당 scale px(정수라야 칸 경계가 번지지 않는다)로 그린다. */
export function drawJersey(
  ctx: CanvasRenderingContext2D,
  { cx, top, scale }: { cx: number; top: number; scale: number },
  j: JerseyArt,
): void {
  ctx.save();
  ctx.translate(Math.round(cx - (RN_FRAME_W * scale) / 2), top);
  ctx.scale(scale, scale);
  // 벽에 걸린 액자의 그림자.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillRect(2, 10, RN_FRAME_W, RN_FRAME_H - 8);
  for (const p of rnFramePaths(j.clubId, j.number)) {
    ctx.fillStyle = p.fill;
    ctx.fill(new Path2D(p.d));
  }
  ctx.restore();
}
