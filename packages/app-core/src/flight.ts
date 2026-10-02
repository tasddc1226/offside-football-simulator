// ───────── 이적 비행 장면 (T-11-039) ─────────
// 해외 이적에 사인하면 지금 소속 리그의 나라에서 새 리그의 나라로 비행기가 날아가는 3초 로딩 장면을 띄운다.
// 여기서는 화면 좌표만 계산한다: 두 공항을 화면에 맞추는 지도 틀(등장방형 투영), 육지 점 지도(land.ts),
// 위로 휘는 비행 경로(2차 베지어). 웹·앱 컴포넌트는 이 값을 그대로 SVG로 그린다.
import { LAND_RES, landAt } from './land.js';

export interface Hub {
  /** 공항 코드(ICN·LHR …). 나라가 같으면 같은 공항이라 비행이 없다. */
  code: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
}

const HUBS = {
  KR: { code: 'ICN', city: '인천', country: '대한민국', lat: 37.46, lon: 126.44 },
  JP: { code: 'HND', city: '도쿄', country: '일본', lat: 35.55, lon: 139.78 },
  US: { code: 'JFK', city: '뉴욕', country: '미국', lat: 40.64, lon: -73.78 },
  NL: { code: 'AMS', city: '암스테르담', country: '네덜란드', lat: 52.31, lon: 4.76 },
  FR: { code: 'CDG', city: '파리', country: '프랑스', lat: 49.01, lon: 2.55 },
  DE: { code: 'FRA', city: '프랑크푸르트', country: '독일', lat: 50.04, lon: 8.56 },
  IT: { code: 'MXP', city: '밀라노', country: '이탈리아', lat: 45.63, lon: 8.72 },
  ES: { code: 'MAD', city: '마드리드', country: '스페인', lat: 40.47, lon: -3.56 },
  GB: { code: 'LHR', city: '런던', country: '잉글랜드', lat: 51.47, lon: -0.45 },
} satisfies Record<string, Hub>;

/** 리그 → 나라(contracts LEAGUE_BASE의 id). 고교·대학·K리그는 모두 한국. 모르는 리그도 한국으로 본다. */
const LEAGUE_HUB: Record<string, keyof typeof HUBS> = {
  j1: 'JP',
  mls: 'US',
  ere: 'NL',
  l1: 'FR',
  bl: 'DE',
  sa: 'IT',
  ll: 'ES',
  pl: 'GB',
};

export const hubOf = (leagueId: string): Hub => HUBS[LEAGUE_HUB[leagueId] ?? 'KR'];

/** 나라가 바뀌는 이적인지(같은 나라 안의 이적·입단은 비행 장면 없이 바로 시즌을 시작한다). */
export const crossesBorder = (fromLeague: string, toLeague: string): boolean =>
  hubOf(fromLeague).code !== hubOf(toLeague).code;

/** 두 공항 사이 대권 거리(km). 비행 장면 아래 '약 N시간 비행'에 쓴다. */
export function flightKm(a: Hub, b: Hub): number {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lon - a.lon) * rad) / 2) ** 2;
  return Math.round(2 * 6371 * Math.asin(Math.sqrt(h)));
}

export interface Pt {
  x: number;
  y: number;
}
export interface FlightMap {
  w: number;
  h: number;
  from: Pt;
  to: Pt;
  /** 2차 베지어 제어점 — 경로가 위(북쪽)로 휜다. */
  ctrl: Pt;
  /** 비행 경로 SVG path. */
  route: string;
  /** 육지 점 지도 SVG path(작은 원 여러 개를 한 path에). */
  dots: string;
}

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
  return {
    w,
    h,
    from: A,
    to: B,
    ctrl: C,
    route: `M${A.x},${A.y}Q${C.x},${C.y} ${B.x},${B.y}`,
    dots: landDots(cx - spanX / 2, cy - spanY / 2, spanX, spanY, k, s),
  };
}

/** 화면에 걸친 경위도 격자에서 육지인 칸마다 작은 원을 찍는다. 격자 간격은 지도 폭에 맞춰 0.5–3도(데이터 칸의 배수). */
function landDots(u0: number, v0: number, spanU: number, spanV: number, k: number, s: number) {
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
      d += `M${r1(x - rad)},${y}a${rad},${rad} 0 1 0 ${r1(rad * 2)},0a${rad},${rad} 0 1 0 ${r1(-rad * 2)},0`;
    }
  return d;
}

/** 경로 위 t(0–1) 지점과 그 자리의 진행 방향(도, 0 = 오른쪽·시계 방향이 +). */
export function alongRoute(m: Pick<FlightMap, 'from' | 'to' | 'ctrl'>, t: number) {
  const u = 1 - t;
  const x = u * u * m.from.x + 2 * u * t * m.ctrl.x + t * t * m.to.x,
    y = u * u * m.from.y + 2 * u * t * m.ctrl.y + t * t * m.to.y;
  const dx = 2 * u * (m.ctrl.x - m.from.x) + 2 * t * (m.to.x - m.ctrl.x),
    dy = 2 * u * (m.ctrl.y - m.from.y) + 2 * t * (m.to.y - m.ctrl.y);
  return { x, y, deg: (Math.atan2(dy, dx) * 180) / Math.PI };
}

/** 비행 장면 타임라인(ms). 지도가 뜨고 → 날아가고 → 도착 표시가 퍼진다. 감속 모션이면 정지 장면만 FLIGHT_STILL_MS. */
export const FLIGHT_MS = 3000;
export const FLIGHT_STILL_MS = 1500;
const LIFT = 300,
  LAND = 2550;
/** 경과 시간 → 비행 진행률(0–1, 이륙·착륙에서 느려진다). */
export function flightProgress(elapsed: number): number {
  const t = Math.min(1, Math.max(0, (elapsed - LIFT) / (LAND - LIFT)));
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
