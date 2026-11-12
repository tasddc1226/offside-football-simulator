// 홈 라이브 현황(웹 HomeLive.svelte · 모바일 HomeLive.tsx 공용). 서버에 실제로 올라온 시즌·은퇴 기록과 실시간 소켓 소식을
// 합쳐 티커 줄·숫자 칸·문구를 정하는 순수 로직만 둔다. 타이머·모션·상태 반응성은 각 앱이 맡는다.
import type { LiveEvent, LivePush, LiveResponse, LiveStats } from '@offside/contracts';
import { LIVE_FEED_MAX } from '@offside/contracts/polling';
import { tn } from '@offside/game/i18n/names';
import { playerName } from './format.js';
import { homeLiveText as L } from './i18n/ko/homeLive.js';

/** 티커가 한 줄씩 올라가는 간격. */
export const LIVE_STEP_MS = 3_500;
/** 한 번에 보이는 줄 수. */
export const LIVE_VISIBLE = 3;

export interface HomeLiveState {
  data: LiveResponse | null;
  presence: Extract<LivePush, { type: 'presence' }> | null;
  /** 소켓으로 받은 소식(최신순). 마지막 조회(data.now) 뒤에 올라온 것만 둔다 — 조회 결과 위에 얹는다. */
  pushed: LiveEvent[];
  /** 방금 받은 새 소식(점이 한 번 튄다). */
  fresh: ReadonlySet<string>;
  cursor: number;
}

export const emptyHomeLive = (): HomeLiveState => ({
  data: null,
  presence: null,
  pushed: [],
  fresh: new Set(),
  cursor: 0,
});

// label은 읽을 때마다 지금 언어로 고른다(getter) — 모듈을 불러올 때 굳히지 않는다.
export const STATS = [
  {
    key: 'playing',
    get label() {
      return L.statPlaying;
    },
    of: (s: LiveStats) => s.online ?? null,
  },
  {
    key: 'seasons',
    get label() {
      return L.statSeasons;
    },
    of: (s: LiveStats) => s.seasonsToday,
  },
  {
    key: 'new',
    get label() {
      return L.statNew;
    },
    of: (s: LiveStats) => s.newToday,
  },
  {
    key: 'retired',
    get label() {
      return L.statRetired;
    },
    of: (s: LiveStats) => s.retiredToday,
  },
] as const;

export const keyOf = (e: LiveEvent) =>
  `${e.kind}:${e.at}:${e.kind === 'retire' ? e.careerId : `${e.club}:${e.goals}:${e.apps}`}`;

export const who = (e: LiveEvent) =>
  playerName(e.name, e.pos, e.kind === 'retire' ? e.number : null);

export function what(e: LiveEvent): string {
  if (e.kind === 'retire') return L.whatRetire({ score: e.score });
  if (e.first) return L.whatFirst({ club: tn(e.club) });
  if (e.honor) return L.whatHonor({ honor: tn(e.honor), club: tn(e.club) });
  if ((e.pos === 'GK' || e.pos === 'DF') && e.cs)
    return L.whatCleanSheets({ club: tn(e.club), apps: e.apps, cs: e.cs });
  return L.whatGoals({ club: tn(e.club), goals: e.goals, assists: e.assists });
}

export const tone = (e: LiveEvent) =>
  e.kind === 'retire' ? 'retire' : e.first ? 'first' : e.honor ? 'honor' : '';

/** 화면에 올릴 소식 전체(소켓 소식이 조회 결과 위). 첫 조회 전엔 비어 있다. */
export const feedOf = (l: HomeLiveState): LiveEvent[] =>
  l.data ? [...l.pushed, ...l.data.feed].slice(0, LIVE_FEED_MAX) : [];

/** 오늘 숫자에는 새 소식만 더하고, 접속 수는 최신 서버 시각의 조회/소켓 응답을 쓴다. */
export function statsOf(l: HomeLiveState): LiveStats | null {
  if (!l.data) return null;
  const s = { ...l.data.stats };
  if (l.presence && l.presence.at >= l.data.now) s.online = l.presence.online;
  for (const e of l.pushed) {
    if (e.kind === 'retire') s.retiredToday++;
    else {
      s.seasonsToday++;
      if (e.first) s.newToday++;
    }
  }
  return s;
}

/** 확인된 접속 0명도 표시한다. 조회 불가는 빼고, 오늘 숫자는 양수만 표시한다. */
export const statTiles = (s: LiveStats | null) =>
  s
    ? STATS.map((t) => ({ ...t, n: t.of(s) })).filter(
        (t): t is typeof t & { n: number } => t.n != null && (t.key === 'playing' || t.n > 0),
      )
    : [];

/** 조회 결과를 받았다: 새로 생긴 소식이 있으면 맨 위(가장 최근)부터 다시 보여 준다. */
export function applyLoad(prev: HomeLiveState, r: LiveResponse): HomeLiveState {
  const before = new Set(feedOf(prev).map(keyOf));
  const added = prev.data ? r.feed.map(keyOf).filter((k) => !before.has(k)) : [];
  return {
    data: r,
    presence: prev.presence,
    pushed: prev.pushed.filter((e) => e.at > r.now),
    fresh: new Set(added),
    cursor: added.length ? 0 : prev.cursor,
  };
}

/** 소켓 소식. 첫 조회 전이거나, 이미 조회에 담긴(그 시각 이전) 소식이거나, 이미 보이는 소식이면 버린다(같은 객체를 돌려준다). */
export function applyPush(prev: HomeLiveState, e: LiveEvent): HomeLiveState {
  const key = keyOf(e);
  if (!prev.data || e.at <= prev.data.now || feedOf(prev).some((f) => keyOf(f) === key))
    return prev;
  return {
    ...prev,
    pushed: [e, ...prev.pushed].slice(0, LIVE_FEED_MAX),
    fresh: new Set([key]),
    cursor: 0,
  };
}

/** 접속 수는 피드 조회보다 먼저 올 수 있다. 캐시된 GET이 늦게 도착해도 새 값을 덮지 않는다. */
export function applyPresence(
  prev: HomeLiveState,
  p: Extract<LivePush, { type: 'presence' }>,
): HomeLiveState {
  if (!Number.isInteger(p.online) || p.online < 0 || !Number.isFinite(Date.parse(p.at)))
    return prev;
  if (prev.presence && prev.presence.at > p.at) return prev;
  return { ...prev, presence: p };
}

/** 티커가 한 줄 올라갔다: 커서를 다음 줄로. */
export const advanceCursor = (l: HomeLiveState): HomeLiveState => ({
  ...l,
  cursor: (l.cursor + 1) % Math.max(1, feedOf(l).length),
});

/** 티커가 굴러가야 하나(동작 줄이기가 아니고 보이는 줄보다 소식이 많을 때). */
export const isRolling = (motionOK: boolean, feedLen: number) => motionOK && feedLen > LIVE_VISIBLE;

/** 그릴 줄. 굴러갈 땐 한 줄 더 그려 두고(가려짐) 올라가는 동안 아래에서 들어오게 한다. */
export const visibleRows = (feed: readonly LiveEvent[], cursor: number, rolling: boolean) =>
  rolling
    ? Array.from({ length: LIVE_VISIBLE + 1 }, (_, k) => feed[(cursor + k) % feed.length]!)
    : feed.slice(0, LIVE_VISIBLE);

/** 목록 key — 굴러가는 동안엔 같은 소식이 한 바퀴 돌아 다시 나올 수 있어 자리 번호를 붙인다. */
export const rowKey = (
  e: LiveEvent,
  i: number,
  rolling: boolean,
  cursor: number,
  feedLen: number,
) => keyOf(e) + (rolling ? `#${(cursor + i) % feedLen}` : '');
