// T-11-600 앱 라운지 필드 그리기 바탕 — 웹 캔버스 2D와 같은 그리기 코드(app-core/lounge)가 Skia 캔버스에 그리도록
// 캔버스 2D의 쓰는 부분(경로 · 채우기 · 선 · 글자 · 변환 · 자르기 · 그라데이션)을 Skia 호출로 옮긴다.
import {
  ClipOp,
  matchFont,
  PaintStyle,
  Skia,
  StrokeCap,
  StrokeJoin,
  TileMode,
  type SkCanvas,
  type SkColor,
  type SkFont,
  type SkPaint,
  type SkPath,
  type SkShader,
} from '@shopify/react-native-skia';
import { Platform } from 'react-native';
import {
  setPathFactory,
  type Ctx2D,
  type Gradient,
  type Path,
} from '@offside/app-core/lounge/canvas';

const TAU = Math.PI * 2;
const DEG = 180 / Math.PI;

/** 캔버스 arc의 시작 · 끝 각을 Skia의 시작 · 쓸기 각(도)으로 바꾼다. */
function sweep(a0: number, a1: number, ccw: boolean) {
  let d: number;
  if (!ccw) d = a1 - a0 >= TAU ? TAU : (((a1 - a0) % TAU) + TAU) % TAU;
  else d = a0 - a1 >= TAU ? -TAU : -((((a0 - a1) % TAU) + TAU) % TAU);
  return { start: a0 * DEG, sweep: d * DEG, full: Math.abs(d) >= TAU - 1e-6 };
}

/** 캔버스 Path2D 흉내. sk가 실제 Skia 경로다. */
export class SkiaPath implements Path {
  readonly sk: SkPath;
  constructor(d?: string) {
    this.sk = (d ? Skia.Path.MakeFromSVGString(d) : null) ?? Skia.Path.Make();
  }
  moveTo(x: number, y: number) {
    this.sk.moveTo(x, y);
  }
  lineTo(x: number, y: number) {
    if (this.sk.countPoints() === 0) this.sk.moveTo(x, y);
    else this.sk.lineTo(x, y);
  }
  quadraticCurveTo(cx: number, cy: number, x: number, y: number) {
    this.sk.quadTo(cx, cy, x, y);
  }
  arc(x: number, y: number, r: number, a0: number, a1: number, ccw = false) {
    this.ellipse(x, y, r, r, 0, a0, a1, ccw);
  }
  ellipse(
    x: number,
    y: number,
    rx: number,
    ry: number,
    rot: number,
    a0: number,
    a1: number,
    ccw = false,
  ) {
    const s = sweep(a0, a1, ccw);
    const oval = Skia.XYWHRect(x - rx, y - ry, rx * 2, ry * 2);
    if (!rot) {
      // 한 바퀴는 두 번에 나눠 그린다(360° 쓸기는 Skia가 점으로 본다).
      if (s.full) {
        this.sk.arcToOval(oval, s.start, s.sweep / 2, false);
        this.sk.arcToOval(oval, s.start + s.sweep / 2, s.sweep / 2, false);
      } else this.sk.arcToOval(oval, s.start, s.sweep, false);
      return;
    }
    const p = Skia.Path.Make();
    if (s.full) p.addOval(oval);
    else p.arcToOval(oval, s.start, s.sweep, true);
    p.transform(Skia.Matrix().translate(x, y).rotate(rot).translate(-x, -y));
    this.sk.addPath(p);
  }
  roundRect(x: number, y: number, w: number, h: number, r: number) {
    const rr = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
    const rect = Skia.XYWHRect(Math.min(x, x + w), Math.min(y, y + h), Math.abs(w), Math.abs(h));
    this.sk.addRRect(Skia.RRectXY(rect, rr, rr));
  }
  closePath() {
    this.sk.close();
  }
  addPath(p: Path) {
    this.sk.addPath((p as SkiaPath).sk);
  }
}

setPathFactory((d) => new SkiaPath(d));

class SkiaGradient implements Gradient {
  readonly stops: { o: number; c: string }[] = [];
  constructor(
    private readonly make: (colors: ReturnType<typeof Skia.Color>[], pos: number[]) => SkShader,
  ) {}
  addColorStop(o: number, c: string) {
    this.stops.push({ o, c });
  }
  shader() {
    return this.make(
      this.stops.map((s) => Skia.Color(s.c)),
      this.stops.map((s) => s.o),
    );
  }
}

type Style = {
  fillStyle: string | Gradient;
  strokeStyle: string;
  lineWidth: number;
  lineJoin: Ctx2D['lineJoin'];
  lineCap: Ctx2D['lineCap'];
  globalAlpha: number;
  font: string;
  textAlign: Ctx2D['textAlign'];
  textBaseline: Ctx2D['textBaseline'];
  dash: number[];
};

const colors = new Map<string, SkColor>();
/** 색 문자열을 한 번만 읽는다. */
function color(s: string): SkColor {
  let c = colors.get(s);
  if (!c) {
    c = Skia.Color(s);
    if (colors.size > 1024) colors.clear();
    colors.set(s, c);
  }
  return c;
}
const BLACK = Skia.Color('#000');

// 글자: 쓰는 글자에 맞는 시스템 글꼴을 고른다(Skia 글꼴은 다른 글꼴로 넘어가지 않는다).
const fonts = new Map<string, SkFont>();
const IOS_FAMILY = {
  ja: 'Hiragino Sans',
  zh: 'PingFang TC',
  ko: 'Apple SD Gothic Neo',
  latin: 'Helvetica Neue',
};
function scriptOf(t: string): keyof typeof IOS_FAMILY {
  if (/[\u3040-\u30ff]/.test(t)) return 'ja';
  if (/[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/.test(t)) return 'ko';
  if (/[\u4e00-\u9fff]/.test(t)) return 'zh';
  return 'latin';
}
function fontFor(spec: string, text: string): SkFont {
  const script = scriptOf(text);
  const key = `${spec}|${script}`;
  let f = fonts.get(key);
  if (!f) {
    const m = /(?:(\d{3})\s+)?(\d+(?:\.\d+)?)px/.exec(spec);
    const weight = (m?.[1] ?? '400') as '400';
    const size = Number(m?.[2] ?? 12);
    const family = Platform.OS === 'ios' ? IOS_FAMILY[script] : 'sans-serif';
    f = matchFont({ fontFamily: family, fontSize: size, fontWeight: weight });
    fonts.set(key, f);
  }
  return f;
}

// 글자 폭 · 글꼴 높이는 매 프레임 같은 값을 묻는다(광고판 글자 · 이름표). 네이티브 호출을 줄이려 기억해 둔다.
const widths = new Map<string, number>();
function widthOf(spec: string, text: string) {
  const key = `${spec}|${text}`;
  let w = widths.get(key);
  if (w === undefined) {
    w = fontFor(spec, text).measureText(text).width;
    if (widths.size > 4096) widths.clear();
    widths.set(key, w);
  }
  return w;
}
const metrics = new WeakMap<SkFont, { ascent: number; descent: number }>();
function metricsOf(font: SkFont) {
  let m = metrics.get(font);
  if (!m) {
    const fm = font.getMetrics();
    m = { ascent: fm.ascent, descent: fm.descent };
    metrics.set(font, m);
  }
  return m;
}

/** Skia 캔버스 하나를 캔버스 2D 모양으로 감싼다. 프레임마다 begin(canvas)으로 새 캔버스를 넘긴다. */
export class SkiaCtx implements Ctx2D {
  private canvas!: SkCanvas;
  private st: Style = SkiaCtx.base();
  private stack: Style[] = [];
  private cur = new SkiaPath();
  private readonly fillPaint = Skia.Paint();
  private readonly strokePaint = Skia.Paint();

  private static base(): Style {
    return {
      fillStyle: '#000',
      strokeStyle: '#000',
      lineWidth: 1,
      lineJoin: 'miter',
      lineCap: 'butt',
      globalAlpha: 1,
      font: '10px sans-serif',
      textAlign: 'left',
      textBaseline: 'alphabetic',
      dash: [],
    };
  }

  constructor() {
    this.fillPaint.setAntiAlias(true);
    this.strokePaint.setAntiAlias(true);
    this.strokePaint.setStyle(PaintStyle.Stroke);
  }

  begin(canvas: SkCanvas) {
    this.canvas = canvas;
    this.st = SkiaCtx.base();
    this.stack = [];
    this.cur = new SkiaPath();
    this.fillKey = null;
    this.strokeKey = '';
    this.dashKey = '';
  }

  get fillStyle() {
    return this.st.fillStyle;
  }
  set fillStyle(v) {
    this.st.fillStyle = v;
  }
  get strokeStyle() {
    return this.st.strokeStyle;
  }
  set strokeStyle(v) {
    this.st.strokeStyle = v;
  }
  get lineWidth() {
    return this.st.lineWidth;
  }
  set lineWidth(v) {
    this.st.lineWidth = v;
  }
  get lineJoin() {
    return this.st.lineJoin;
  }
  set lineJoin(v) {
    this.st.lineJoin = v;
  }
  get lineCap() {
    return this.st.lineCap;
  }
  set lineCap(v) {
    this.st.lineCap = v;
  }
  get globalAlpha() {
    return this.st.globalAlpha;
  }
  set globalAlpha(v) {
    this.st.globalAlpha = v;
  }
  get font() {
    return this.st.font;
  }
  set font(v) {
    this.st.font = v;
  }
  get textAlign() {
    return this.st.textAlign;
  }
  set textAlign(v) {
    this.st.textAlign = v;
  }
  get textBaseline() {
    return this.st.textBaseline;
  }
  set textBaseline(v) {
    this.st.textBaseline = v;
  }

  save() {
    this.stack.push({ ...this.st, dash: [...this.st.dash] });
    this.canvas.save();
  }
  restore() {
    const s = this.stack.pop();
    if (!s) return;
    this.st = s;
    this.canvas.restore();
  }
  translate(x: number, y: number) {
    this.canvas.translate(x, y);
  }
  scale(x: number, y: number) {
    this.canvas.scale(x, y);
  }
  rotate(a: number) {
    this.canvas.rotate(a * DEG, 0, 0);
  }
  transform(a: number, b: number, c: number, d: number, e: number, f: number) {
    this.canvas.concat(Skia.Matrix([a, c, e, b, d, f, 0, 0, 1]));
  }

  beginPath() {
    this.cur = new SkiaPath();
  }
  moveTo(x: number, y: number) {
    this.cur.moveTo(x, y);
  }
  lineTo(x: number, y: number) {
    this.cur.lineTo(x, y);
  }
  arc(x: number, y: number, r: number, a0: number, a1: number, ccw?: boolean) {
    this.cur.arc(x, y, r, a0, a1, ccw);
  }
  ellipse(
    x: number,
    y: number,
    rx: number,
    ry: number,
    rot: number,
    a0: number,
    a1: number,
    ccw?: boolean,
  ) {
    this.cur.ellipse(x, y, rx, ry, rot, a0, a1, ccw);
  }
  roundRect(x: number, y: number, w: number, h: number, r: number) {
    this.cur.roundRect(x, y, w, h, r);
  }
  closePath() {
    this.cur.closePath();
  }
  /** 관중석처럼 작은 사각형 수천 개를 색마다 경로 하나로 묶어 그린다(네이티브 호출을 색 수만큼만). */
  fillRects(rects: number[], colors: string[]) {
    const groups = new Map<string, string[]>();
    for (let i = 0; i < colors.length; i++) {
      const x = rects[i * 4]!.toFixed(1);
      const y = rects[i * 4 + 1]!.toFixed(1);
      const w = rects[i * 4 + 2]!.toFixed(1);
      const h = rects[i * 4 + 3]!.toFixed(1);
      const d = `M${x} ${y}h${w}v${h}h-${w}z`;
      const g = groups.get(colors[i]!);
      if (g) g.push(d);
      else groups.set(colors[i]!, [d]);
    }
    for (const [c, ds] of groups) {
      const sk = Skia.Path.MakeFromSVGString(ds.join(''));
      if (!sk) continue;
      this.st.fillStyle = c;
      this.canvas.drawPath(sk, this.fillWith());
    }
  }

  // 페인트는 바뀐 값만 다시 넣는다(관중석처럼 같은 색을 수천 번 그릴 때 Skia 호출을 줄인다).
  private fillKey: unknown = null;
  private fillAlpha = -1;
  private strokeKey = '';
  private dashKey = '';

  private fillWith(): SkPaint {
    const p = this.fillPaint;
    const s = this.st.fillStyle;
    const alpha = this.st.globalAlpha;
    if (s === this.fillKey && alpha === this.fillAlpha) return p;
    this.fillKey = s;
    this.fillAlpha = alpha;
    if (typeof s === 'string') {
      const c = color(s);
      p.setShader(null);
      p.setColor(c);
      if (alpha !== 1) p.setAlphaf(c[3]! * alpha);
    } else {
      p.setColor(BLACK);
      p.setAlphaf(alpha);
      p.setShader((s as SkiaGradient).shader());
    }
    return p;
  }
  private strokeWith(): SkPaint {
    const p = this.strokePaint;
    const st = this.st;
    const key = `${st.strokeStyle}|${st.globalAlpha}|${st.lineWidth}|${st.lineJoin}|${st.lineCap}`;
    if (key !== this.strokeKey) {
      this.strokeKey = key;
      const c = color(st.strokeStyle);
      p.setColor(c);
      if (st.globalAlpha !== 1) p.setAlphaf(c[3]! * st.globalAlpha);
      p.setStrokeWidth(st.lineWidth);
      p.setStrokeJoin(
        st.lineJoin === 'round'
          ? StrokeJoin.Round
          : st.lineJoin === 'bevel'
            ? StrokeJoin.Bevel
            : StrokeJoin.Miter,
      );
      p.setStrokeCap(
        st.lineCap === 'round'
          ? StrokeCap.Round
          : st.lineCap === 'square'
            ? StrokeCap.Square
            : StrokeCap.Butt,
      );
    }
    const dash = st.dash.join(',');
    if (dash !== this.dashKey) {
      this.dashKey = dash;
      p.setPathEffect(st.dash.length ? Skia.PathEffect.MakeDash(st.dash, 0) : null);
    }
    return p;
  }

  fill(path?: Path) {
    this.canvas.drawPath(((path as SkiaPath | undefined) ?? this.cur).sk, this.fillWith());
  }
  stroke(path?: Path) {
    this.canvas.drawPath(((path as SkiaPath | undefined) ?? this.cur).sk, this.strokeWith());
  }
  clip(path?: Path) {
    this.canvas.clipPath(((path as SkiaPath | undefined) ?? this.cur).sk, ClipOp.Intersect, true);
  }
  fillRect(x: number, y: number, w: number, h: number) {
    this.canvas.drawRect({ x, y, width: w, height: h }, this.fillWith());
  }

  private place(text: string, x: number, y: number) {
    const font = fontFor(this.st.font, text);
    const w = widthOf(this.st.font, text);
    const m = metricsOf(font);
    const dx = this.st.textAlign === 'center' ? -w / 2 : this.st.textAlign === 'right' ? -w : 0;
    const b = this.st.textBaseline;
    const dy =
      b === 'top'
        ? -m.ascent
        : b === 'middle'
          ? -(m.ascent + m.descent) / 2
          : b === 'bottom'
            ? -m.descent
            : 0;
    return { font, x: x + dx, y: y + dy };
  }
  fillText(text: string, x: number, y: number) {
    const p = this.place(text, x, y);
    this.canvas.drawText(text, p.x, p.y, this.fillWith(), p.font);
  }
  strokeText(text: string, x: number, y: number) {
    const p = this.place(text, x, y);
    const paint = this.strokeWith();
    paint.setPathEffect(null);
    this.dashKey = '';
    this.canvas.drawText(text, p.x, p.y, paint, p.font);
  }
  measureText(text: string) {
    return { width: widthOf(this.st.font, text) };
  }
  setLineDash(segments: number[]) {
    this.st.dash = [...segments];
  }
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): Gradient {
    return new SkiaGradient((colors, pos) =>
      Skia.Shader.MakeLinearGradient(
        Skia.Point(x0, y0),
        Skia.Point(x1, y1),
        colors,
        pos,
        TileMode.Clamp,
      ),
    );
  }
  createRadialGradient(
    x0: number,
    y0: number,
    r0: number,
    x1: number,
    y1: number,
    r1: number,
  ): Gradient {
    return new SkiaGradient((colors, pos) =>
      Skia.Shader.MakeTwoPointConicalGradient(
        Skia.Point(x0, y0),
        r0,
        Skia.Point(x1, y1),
        r1,
        colors,
        pos,
        TileMode.Clamp,
      ),
    );
  }
}
