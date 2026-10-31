// T-11-600 웹 라운지 필드 그리기 바탕: 공통 그리기 코드(app-core/lounge)에 브라우저 캔버스 2D와 Path2D를 넘긴다.
import { setPathFactory, type Ctx2D, type Path } from '@offside/app-core/lounge/canvas';

setPathFactory((d) => (d ? new Path2D(d) : new Path2D()) as unknown as Path);

/** 브라우저 캔버스 2D를 공통 그리기 코드가 쓰는 모양으로 넘긴다(쓰는 부분이 같은 이름 · 동작이다). */
export const asCtx = (ctx: CanvasRenderingContext2D) => ctx as unknown as Ctx2D;
