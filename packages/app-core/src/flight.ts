// ───────── 이적 비행 장면 (T-11-039) ─────────
// 해외 이적에 사인하면 지금 소속 리그의 나라에서 새 리그의 나라로 비행기가 날아가는 3초 로딩 장면을 띄운다.
// 여기는 리그 → 공항과 경로 위 위치처럼 가벼운 것만 둔다. 지도 틀·육지 점 지도는 육지 데이터(land.ts)가 커서
// flight-map.ts로 떼어 해외 이적에 사인할 때만 불러온다.

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

/** 여객기 순항 속도(km/h) — '약 N시간 비행'의 어림. */
const CRUISE_KMH = 850;
/** 두 공항 사이 대권 거리로 어림한 비행시간(시간, 최소 1). 비행 장면 아래 '약 N시간 비행'에 쓴다. */
export function flightHours(a: Hub, b: Hub): number {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lon - a.lon) * rad) / 2) ** 2;
  return Math.max(1, Math.round((2 * 6371 * Math.asin(Math.sqrt(h))) / CRUISE_KMH));
}

/** 비행기 모양(코가 +x, 원점이 가운데). 웹·앱이 경로 위 자리·방향으로 옮겨 그린다. */
export const PLANE_PATH =
  'M10 0 3.5-1.4-1-8h-2.6l2.2 6.6H-5.6L-7.8-4h-1.8l1.3 4-1.3 4h1.8l2.2-2.6h4.2L-3.6 8H-1l4.5-6.6Z';

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
  /** 경로 길이(화면 단위) — 지나간 만큼 그리는 dash 길이로 쓴다. */
  len: number;
  /** 육지 점 지도 SVG path — 점마다 길이 0인 선. 둥근 선끝(stroke-linecap: round)·굵기 dotW로 그린다. */
  dots: string;
  dotW: number;
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
