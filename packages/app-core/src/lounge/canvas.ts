// T-11-600 라운지 필드 그리기 바탕 — 웹(캔버스 2D)과 앱(Skia)이 같은 그리기 코드를 쓰도록 캔버스 2D의 쓰는 부분만 적는다.
// app-core는 DOM 타입 없이 빌드하므로 브라우저 타입 대신 이 모양을 쓴다. 웹은 CanvasRenderingContext2D · Path2D를 그대로
// 넘기고, 앱은 Skia로 같은 동작을 흉내 낸 어댑터를 넘긴다.

export interface Path {
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void;
  arc(x: number, y: number, r: number, a0: number, a1: number, ccw?: boolean): void;
  ellipse(
    x: number,
    y: number,
    rx: number,
    ry: number,
    rot: number,
    a0: number,
    a1: number,
    ccw?: boolean,
  ): void;
  roundRect(x: number, y: number, w: number, h: number, r: number): void;
  closePath(): void;
  addPath(p: Path): void;
}

export interface Gradient {
  addColorStop(offset: number, color: string): void;
}

export interface Ctx2D {
  fillStyle: string | Gradient;
  strokeStyle: string;
  lineWidth: number;
  lineJoin: 'round' | 'miter' | 'bevel';
  lineCap: 'round' | 'butt' | 'square';
  globalAlpha: number;
  font: string;
  textAlign: 'left' | 'center' | 'right';
  textBaseline: 'top' | 'middle' | 'alphabetic' | 'bottom';
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  scale(x: number, y: number): void;
  rotate(a: number): void;
  transform(a: number, b: number, c: number, d: number, e: number, f: number): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arc(x: number, y: number, r: number, a0: number, a1: number, ccw?: boolean): void;
  ellipse(
    x: number,
    y: number,
    rx: number,
    ry: number,
    rot: number,
    a0: number,
    a1: number,
    ccw?: boolean,
  ): void;
  roundRect(x: number, y: number, w: number, h: number, r: number): void;
  /** 사각형 여러 개를 저마다의 색으로 한 번에 칠한다(rects: x, y, w, h 반복). 없으면 fillRect로 하나씩 칠한다. */
  fillRects?(rects: number[], colors: string[]): void;
  closePath(): void;
  fill(path?: Path): void;
  stroke(path?: Path): void;
  clip(path?: Path): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number): void;
  strokeText(text: string, x: number, y: number): void;
  measureText(text: string): { width: number };
  setLineDash(segments: number[]): void;
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): Gradient;
  createRadialGradient(
    x0: number,
    y0: number,
    r0: number,
    x1: number,
    y1: number,
    r1: number,
  ): Gradient;
}

let makePath: ((d?: string) => Path) | null = null;

/** 플랫폼이 경로 만들기를 한 번 정한다(웹: new Path2D, 앱: Skia 경로). */
export function setPathFactory(f: (d?: string) => Path) {
  makePath = f;
}

/** 빈 경로나 SVG 경로 문자열(d)로 경로를 만든다. */
export function path(d?: string): Path {
  if (!makePath) throw new Error('lounge path factory is not set');
  return makePath(d);
}
