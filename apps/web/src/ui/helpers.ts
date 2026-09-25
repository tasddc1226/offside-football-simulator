// ───────── 저장 · 업로드 · 토스트 (ui.ts 43~142줄 포트) ─────────
import { leagueOf } from '../game/engine.js';
import { saveKey } from '../game/season.js';
import { getActiveRng } from '../game/rng.js';
import type { PutCareerSeasonBody } from '@offside/contracts';
import type { CareerRecord, EventLogEntry, GameState, HofEntry } from '../game/types.js';
import { appState, toastState } from './state.svelte.js';

// T-9-009: 빌드 시 vite define으로 커밋 SHA가 들어온다(vite.config.ts). 테스트 등 define이 없는
// 환경은 'dev'.
declare const __APP_VERSION__: string | undefined;
export const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';
const EV_BUF_CAP = 300;

export function pushEvLog(s: GameState, entry: EventLogEntry) {
  const buf = (s.evBuf = s.evBuf || []);
  buf.push(entry);
  while (buf.length > EV_BUF_CAP) buf.shift();
}

export function save() {
  const s = appState.G;
  if (s) s.rng = getActiveRng().getState();
  saveKey('ft_save', s);
}

export const seasonLabel = (s: GameState, y = s.year): string =>
  leagueOf(s.leagueId).tier >= 4 ? `${y}-${String((y + 1) % 100).padStart(2, '0')}` : `${y}`;

// T-9-009: 시즌 종료 직후(RNG 소모 없는 지점) 커리어 요약 + 버퍼링된 선택 로그를 업로드 큐에
// 넣는다. outbox.ts는 zod 값을 쓰지 않지만, 동적 import로 메인 청크와 분리해 둔다.
export function uploadSeason(s: GameState, rec: CareerRecord) {
  const events = (s.evBuf || []).slice();
  s.evBuf = [];
  void import('../game/outbox.js').then((m) => m.enqueueSeason(s.cid, rec.year, seasonBody(m, s, rec, events)));
}

export function seasonBody(m: typeof import('../game/outbox.js'), s: GameState, rec: CareerRecord, events: PutCareerSeasonBody['events']): PutCareerSeasonBody {
  return {
    career: {
      pos: s.pos,
      foot: s.foot,
      type: s.type,
      trait: s.trait,
      startYear: s.career[0]?.year ?? rec.year,
      appVersion: APP_VERSION,
    },
    season: m.seasonPayload(rec),
    events,
  };
}

/** 은퇴 요약 + 상세 스냅샷을 서버 명예의 전당으로 보낸다. 이름은 `entry.public`일 때만 보낸다(기본 익명). */
export function uploadRetirement(careerId: string, entry: HofEntry) {
  void import('../game/outbox.js').then((m) =>
    m.enqueueRetirement(careerId, {
      retireAge: entry.age,
      peak: entry.peak,
      legendScore: entry.score,
      apps: entry.apps,
      goals: entry.goals,
      assists: entry.assists,
      trophies: entry.trophies,
      awards: entry.awards,
      caps: entry.caps,
      ballon: entry.ballon,
      lastClub: entry.lastClub,
      publicName: entry.public ? entry.name : null,
      ...(entry.detail ? { snapshot: entry.detail } : {}),
    }),
  );
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(t: string) {
  toastState.text = t;
  toastState.visible = true;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toastState.visible = false), 2200);
}
