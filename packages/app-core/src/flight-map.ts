// ───────── 이적 비행 지도 (T-11-039) ─────────
// 두 공항을 화면에 맞추는 지도 틀(등장방형 투영), 육지 점 지도(land.ts), 위로 휘는 비행 경로(2차 베지어).
// 웹·앱 컴포넌트는 이 값을 그대로 SVG로 그린다. 육지 데이터가 커서 해외 이적에 사인할 때만 동적으로 불러온다.
import { alongRoute, type FlightMap, type Hub, type Pt } from './flight.js';
import { LAND_RES, landAt } from './land.js';

/** 지도 틀의 최소 경도 폭 — 가까운 나라끼리(파리 → 런던)도 대륙 모양이 보일 만큼은 넓힌다. */
const MIN_SPAN = 26;
/** 가로로 늘어놓을 점 수 목표 — 지도 폭이 넓으면 격자를 성기게 뽑는다. */
const DOTS_ACROSS = 80;

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * 두 공항을 w×h 화면에 맞춘 지도를 만든다. 날짜변경선을 넘는 쪽이 가까우면(인천 → 뉴욕) 그쪽으로 난다.
 * 투영은 가운데 위도를 표준위선으로 둔 등장방형 — 유럽처럼 위도가 높은 곳이 옆으로 퍼져 보이지 않는다.
 */
export function flightMap(from: Hub, to: Hub, w = 320, h = 190): FlightMap {
  let lonB = to.lon;
  if (lonB - from.lon > 180) lonB -= 360;
  else if (lonB - from.lon < -180) lonB += 360;
  const k = Math.cos((((from.lat + to.lat) / 2) * Math.PI) / 180);
  // 지도 단위(경도·위도 도 단위, y는 아래로): u = 경도 × k, v = -위도.
  const a = { x: from.lon * k, y: -from.lat },
    b = { x: lonB * k, y: -to.lat };
  const dx = b.x - a.x,
    dy = b.y - a.y;
  // 제어점: 가운데에서 경로에 수직으로 거리의 30% — 수직 방향 둘 중 위(북쪽)를 향한 쪽. 꼭짓점(t=0.5)은 그 절반만큼 비켜난다.
  const flip = dx < 0 || (dx === 0 && dy > 0) ? -1 : 1;
  const c = { x: (a.x + b.x) / 2 + dy * 0.3 * flip, y: (a.y + b.y) / 2 - dx * 0.3 * flip };
  const apex = { x: (a.x + 2 * c.x + b.x) / 4, y: (a.y + 2 * c.y + b.y) / 4 };
  const x0 = Math.min(a.x, b.x, apex.x),
    x1 = Math.max(a.x, b.x, apex.x),
    y0 = Math.min(a.y, b.y, apex.y),
    y1 = Math.max(a.y, b.y, apex.y);
  // 여백: 공항 이름표가 들어갈 만큼 좌우 20%, 위아래 30%.
  let spanX = Math.max((x1 - x0) * 1.4 + 6, MIN_SPAN * k),
    spanY = Math.max((y1 - y0) * 1.6 + 8, (spanX * h) / w);
  spanX = Math.max(spanX, (spanY * w) / h);
  spanY = (spanX * h) / w;
  const s = w / spanX,
    cx = (x0 + x1) / 2,
    cy = (y0 + y1) / 2;
  const px = (p: Pt): Pt => ({ x: r1((p.x - cx) * s + w / 2), y: r1((p.y - cy) * s + h / 2) });
  const A = px(a),
    B = px(b),
    C = px(c);
  let len = 0;
  for (let i = 1, prev = A; i <= 40; i++) {
    const p = alongRoute({ from: A, to: B, ctrl: C }, i / 40);
    len += Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;
  }
  return {
    w,
    h,
    from: A,
    to: B,
    ctrl: C,
    len: Math.ceil(len),
    route: `M${A.x},${A.y}Q${C.x},${C.y} ${B.x},${B.y}`,
    ...landDots(cx - spanX / 2, cy - spanY / 2, spanX, spanY, k, s),
  };
}

/**
 * 화면에 걸친 경위도 격자에서 육지인 칸마다 점을 찍는다. 격자 간격은 지도 폭에 맞춰 0.5–3도(데이터 칸의 배수).
 * 점은 길이 0인 선(`M x,y h0`)이라 둥근 선끝·굵기 dotW로 그리면 원이 된다 — 호 두 개짜리 원보다 path가 훨씬 짧다.
 */
function landDots(
  u0: number,
  v0: number,
  spanU: number,
  spanV: number,
  k: number,
  s: number,
): Pick<FlightMap, 'dots' | 'dotW'> {
  const step = LAND_RES * Math.min(6, Math.max(1, Math.round(spanU / k / DOTS_ACROSS / LAND_RES)));
  const rad = r1(Math.max(0.6, step * k * s * 0.3));
  const lon0 = Math.ceil(u0 / k / step) * step,
    lon1 = (u0 + spanU) / k;
  const lat1 = Math.floor(-v0 / step) * step,
    lat0 = -(v0 + spanV);
  let d = '';
  for (let lat = lat1; lat >= lat0; lat -= step)
    for (let lon = lon0; lon <= lon1; lon += step) {
      if (!landAt(lat + step / 2, lon + step / 2)) continue;
      const x = r1((lon + step / 2) * k * s - u0 * s),
        y = r1((-(lat + step / 2) - v0) * s);
      d += `M${x},${y}h0`;
    }
  return { dots: d, dotW: r1(rad * 2) };
}
