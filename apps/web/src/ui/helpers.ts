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
  // s가 Svelte $state 프록시면 대입한 원본 배열이 아니라 s.evBuf(프록시)를 다시 읽어야 push가 남는다
  // (`const buf = (s.evBuf = s.evBuf || [])`는 첫 항목을 원본 배열에 넣고 잃었다).
  if (!s.evBuf) s.evBuf = [];
  const buf = s.evBuf;
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
  void import('../game/outbox.js').then((m) =>
    m.enqueueSeason(s.cid, rec.year, seasonBody(m, s, rec, events)),
  );
}

export function seasonBody(
  m: typeof import('../game/outbox.js'),
  s: GameState,
  rec: CareerRecord,
  events: PutCareerSeasonBody['events'],
): PutCareerSeasonBody {
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
      title: entry.title ?? null,
      publicName: entry.public ? entry.name : null,
      ...(entry.detail ? { snapshot: entry.detail } : {}),
    }),
  );
}

/** cid 도입 전에 은퇴한 선수: 서버엔 이 커리어가 없어 은퇴만 보내면 CAREER_NOT_FOUND(400)로 버려진다 — 시즌을
 * 먼저 큐에 넣어 커리어를 만든 뒤 은퇴를 보낸다(큐는 넣은 순서대로 보낸다). 선택 로그는 남아 있지 않다. */
export function uploadLegacyRetirement(s: GameState, entry: HofEntry) {
  void import('../game/outbox.js').then((m) => {
    enqueueAllSeasons(m, s);
    uploadRetirement(s.cid, entry);
  });
}

/** 커리어의 모든 시즌을 지금 cid로 업로드 큐에 넣는다. eventsOf: 연도별 선택 로그(남아 있는 것만). */
export function enqueueAllSeasons(
  m: typeof import('../game/outbox.js'),
  s: GameState,
  eventsOf: (year: number) => PutCareerSeasonBody['events'] = () => [],
) {
  for (const rec of s.career)
    m.enqueueSeason(s.cid, rec.year, seasonBody(m, s, rec, eventsOf(rec.year)));
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(t: string) {
  toastState.text = t;
  toastState.visible = true;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toastState.visible = false), 2200);
}
