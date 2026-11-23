// ───────── 홈 라이브 지도 (T-11-815) ─────────
// 지금 뛰는 선수들이 있는 나라를 작은 세계 지도 위 점으로 보여 준다(웹 HomeLive.svelte · 앱 home/HomeLive.tsx 공용).
// 서버가 굳힌 리그별 인원(LiveMap)을 리그의 나라(이적 비행 장면의 공항 · flight.ts)로 모으고, 육지 점 지도(land.ts)를
// 고정 틀(아메리카 동부 ~ 동아시아)에 찍는다. 육지 데이터가 커서 웹은 이 모듈을 홈이 뜬 뒤 따로 불러온다.
import type { LiveEvent, LiveMap } from '@offside/contracts';
import { LEAGUE_BASE } from '@offside/contracts/club-names';
import { hubOf } from './flight.js';
import { LAND_RES, landAt } from './land.js';

/** 지도 틀(도). 서쪽 뉴욕 · 상파울루부터 동쪽 도쿄까지, 위아래는 북유럽 ~ 남미 남부. */
const LON0 = -100,
  LON1 = 150,
  LAT0 = 64,
  LAT1 = -36;
/** 가운데 위도의 경도 줄임(등장방형) — 유럽이 옆으로 퍼져 보이지 않게. */
const K = Math.cos((((LAT0 + LAT1) / 2) * Math.PI) / 180);
/** viewBox 폭. 높이는 틀 비율로 정한다. */
export const LIVE_MAP_W = 320;
const S = LIVE_MAP_W / ((LON1 - LON0) * K);
export const LIVE_MAP_H = Math.round((LAT0 - LAT1) * S);
/** 육지 점 격자(도). 데이터 칸(0.5도)의 배수. */
const STEP = 5 * LAND_RES;

const r1 = (n: number) => Math.round(n * 10) / 10;

/** 경위도 → viewBox 좌표. */
export const project = (lat: number, lon: number) => ({
  x: r1((lon - LON0) * K * S),
  y: r1((LAT0 - lat) * S),
});

let dotsMemo: { d: string; w: number } | undefined;
/**
 * 틀 안의 육지 칸마다 점 하나(길이 0인 선 `M x,y h0` — 둥근 선끝 · 굵기 w로 그리면 원). 한 번만 만든다.
 * 칸 가운데가 육지인지만 보므로 작은 섬은 빠질 수 있다(장식이라 괜찮다).
 */
export function liveMapDots(): { d: string; w: number } {
  if (dotsMemo) return dotsMemo;
  let d = '';
  for (let lat = LAT0 - STEP / 2; lat > LAT1; lat -= STEP)
    for (let lon = LON0 + STEP / 2; lon < LON1; lon += STEP) {
      if (!landAt(lat, lon)) continue;
      const p = project(lat, lon);
      d += `M${p.x},${p.y}h0`;
    }
  return (dotsMemo = { d, w: r1(STEP * K * S * 0.55) });
}

const LEAGUE_ID = new Map(LEAGUE_BASE.map((l) => [l.name, l.id]));
/** 리그 이름(저장값) → 나라 공항 코드. 모르는 리그는 한국(flight.ts와 같은 기본값). */
export const spotOfLeague = (league: string) => hubOf(LEAGUE_ID.get(league) ?? '').code;

export interface LiveSpot {
  /** 나라 공항 코드(ICN · LHR …). 점 하나 = 나라 하나. */
  code: string;
  /** 지금 언어의 나라 이름. */
  country: string;
  n: number;
  /** 이 나라에서 뛰는 리그별 인원(많은 순). */
  leagues: { league: string; n: number }[];
  x: number;
  y: number;
  /** 점 반지름(viewBox 단위). 가장 많은 나라 대비 인원의 제곱근(넓이로 센다), R_MIN ~ R_MAX. */
  r: number;
}

/**
 * 점 반지름 범위. 운영 첫 집계(11-23)에서 한국이 1,385명(고교 리그 1,228)이라 인원의 제곱근을 그대로 쓰면 반지름 23으로
 * 일본(15 떨어짐)을 덮었다. 가장 많은 나라를 R_MAX로 두고 나머지는 그 비율로 줄인다(서울 · 도쿄 점이 겹치지 않는 크기).
 */
const R_MIN = 2.6,
  R_MAX = 9;

/** 리그별 인원을 나라 점으로 모은다. 많은 순(그릴 때는 뒤집어 작은 점이 위에 오게 한다). */
export function liveSpots(map: LiveMap | null | undefined): LiveSpot[] {
  if (!map) return [];
  const by = new Map<string, LiveSpot>();
  for (const { league, n } of map.leagues) {
    const id = LEAGUE_ID.get(league) ?? '';
    const hub = hubOf(id);
    let s = by.get(hub.code);
    if (!s) {
      const p = project(hub.lat, hub.lon);
      s = { code: hub.code, country: hub.country, n: 0, leagues: [], x: p.x, y: p.y, r: 0 };
      by.set(hub.code, s);
    }
    s.n += n;
    s.leagues.push({ league, n });
  }
  const max = Math.max(1, ...[...by.values()].map((s) => s.n));
  return [...by.values()]
    .map((s) => ({ ...s, r: r1(R_MIN + (R_MAX - R_MIN) * Math.sqrt(s.n / max)) }))
    .sort((a, b) => b.n - a.n || a.code.localeCompare(b.code));
}

/** 지금 가리킬 나라: 고른 나라가 있으면 그것, 아니면 가장 최근 시즌 소식의 나라, 그것도 없으면 가장 많은 나라. */
export function pickSpot(
  spots: LiveSpot[],
  feed: LiveEvent[],
  picked: string | null,
): LiveSpot | undefined {
  if (picked) {
    const s = spots.find((x) => x.code === picked);
    if (s) return s;
  }
  const latest = feed.find((e) => e.kind === 'season');
  if (latest && latest.kind === 'season') {
    const s = spots.find((x) => x.code === spotOfLeague(latest.league));
    if (s) return s;
  }
  return spots[0];
}

/** 그 나라의 가장 최근 시즌 소식(말풍선 둘째 줄). 없으면 undefined. */
export const latestIn = (feed: LiveEvent[], code: string) =>
  feed.find(
    (e): e is Extract<LiveEvent, { kind: 'season' }> =>
      e.kind === 'season' && spotOfLeague(e.league) === code,
  );
