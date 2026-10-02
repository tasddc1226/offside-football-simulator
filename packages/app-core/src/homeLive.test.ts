import { describe, expect, it } from 'vitest';
import type { LiveEvent, LiveResponse } from '@offside/contracts';
import { LIVE_FEED_MAX } from '@offside/contracts/polling';
import {
  LIVE_VISIBLE,
  advanceCursor,
  applyLoad,
  applyPush,
  emptyHomeLive,
  feedOf,
  isRolling,
  keyOf,
  rowKey,
  statTiles,
  statsOf,
  tone,
  visibleRows,
  what,
  who,
} from './homeLive.js';

const season = (over: Partial<Extract<LiveEvent, { kind: 'season' }>> = {}): LiveEvent => ({
  kind: 'season',
  at: '2026-10-02T03:00:00.000Z',
  name: '김공격',
  pos: 'FW',
  club: '서울 FC',
  league: 'K리그1',
  apps: 30,
  goals: 12,
  assists: 4,
  cs: null,
  honor: null,
  first: false,
  ...over,
});
const retire = (over: Partial<Extract<LiveEvent, { kind: 'retire' }>> = {}): LiveEvent => ({
  kind: 'retire',
  at: '2026-10-02T03:10:00.000Z',
  careerId: 'c-1',
  name: null,
  pos: 'DF',
  number: 4,
  score: 812,
  lastClub: '부산 FC',
  ...over,
});
const res = (feed: LiveEvent[], now = '2026-10-02T04:00:00.000Z'): LiveResponse => ({
  now,
  stats: { playing: 10, seasonsToday: 5, newToday: 1, retiredToday: 0 },
  feed,
});
const at = (min: number) => `2026-10-02T04:${String(min).padStart(2, '0')}:00.000Z`;

describe('홈 라이브 문구·표', () => {
  it('what: 은퇴 · 첫 시즌 · 수상 · 무실점 · 골도움 순으로 고른다', () => {
    expect(what(retire())).toBe('은퇴 · 레전드 점수 812');
    expect(what(season({ first: true }))).toBe('서울 FC에서 첫 시즌을 마쳤어요');
    expect(what(season({ honor: '득점왕' }))).toBe('득점왕 · 서울 FC');
    expect(what(season({ pos: 'GK', apps: 28, cs: 11 }))).toBe('서울 FC 시즌 28경기 무실점 11');
    expect(what(season({ pos: 'DF', cs: 0 }))).toBe('서울 FC 시즌 12골 4도움');
    expect(what(season({ pos: 'FW', cs: 5 }))).toBe('서울 FC 시즌 12골 4도움');
  });

  it('who: 공개 이름이 없으면 익명 표기(은퇴는 등번호 포함)', () => {
    expect(who(season())).toBe('김공격');
    expect(who(season({ name: null }))).toMatch(/^익명/);
    expect(who(retire({ name: null }))).toContain('4');
    expect(who(retire({ name: '홍길동' }))).toBe('홍길동');
  });

  it('tone: 은퇴 > 첫 시즌 > 수상 > 없음', () => {
    expect(tone(retire())).toBe('retire');
    expect(tone(season({ first: true, honor: '우승' }))).toBe('first');
    expect(tone(season({ honor: '우승' }))).toBe('honor');
    expect(tone(season())).toBe('');
  });

  it('keyOf: 종류와 시각, 은퇴는 커리어 id, 시즌은 클럽·골·경기로 가른다', () => {
    expect(keyOf(retire())).toBe('retire:2026-10-02T03:10:00.000Z:c-1');
    expect(keyOf(season())).toBe('season:2026-10-02T03:00:00.000Z:서울 FC:12:30');
    expect(keyOf(season({ goals: 13 }))).not.toBe(keyOf(season()));
  });
});

describe('홈 라이브 상태 합치기', () => {
  it('첫 조회: 데이터를 채우고 새 소식 표시는 비운다', () => {
    const s = applyLoad(emptyHomeLive(), res([season()]));
    expect(s.data?.feed).toHaveLength(1);
    expect(s.fresh.size).toBe(0);
    expect(s.cursor).toBe(0);
    expect(feedOf(emptyHomeLive())).toEqual([]);
  });

  it('다음 조회에 새 소식이 있으면 fresh로 표시하고 맨 위부터 다시 보여 준다', () => {
    const a = season({ at: at(1) });
    const b = season({ at: at(2), goals: 3 });
    let s = applyLoad(emptyHomeLive(), res([a]));
    s = { ...s, cursor: 2 };
    const same = applyLoad(s, res([a]));
    expect(same.cursor).toBe(2);
    expect(same.fresh.size).toBe(0);
    const next = applyLoad(s, res([b, a]));
    expect([...next.fresh]).toEqual([keyOf(b)]);
    expect(next.cursor).toBe(0);
  });

  it('소켓 소식은 맨 위에 끼고, 조회 시각 이전·이미 보이는 소식·첫 조회 전엔 버린다', () => {
    const base = applyLoad(emptyHomeLive(), res([season({ at: at(1) })], at(5)));
    const live = season({ at: at(7), club: '대구 FC' });
    expect(applyPush(emptyHomeLive(), live)).toEqual(emptyHomeLive());
    const old = season({ at: at(3), club: '인천 FC' });
    expect(applyPush(base, old)).toBe(base);
    const pushed = applyPush({ ...base, cursor: 2 }, live);
    expect(pushed.pushed).toEqual([live]);
    expect([...pushed.fresh]).toEqual([keyOf(live)]);
    expect(pushed.cursor).toBe(0);
    expect(feedOf(pushed)[0]).toBe(live);
    expect(applyPush(pushed, live)).toBe(pushed);
  });

  it('조회가 소켓 소식을 담으면(조회 시각이 지나면) 소켓 쪽은 비운다', () => {
    const base = applyLoad(emptyHomeLive(), res([season({ at: at(1) })], at(5)));
    const live = season({ at: at(7), club: '대구 FC' });
    const pushed = applyPush(base, live);
    const after = applyLoad(pushed, res([live, season({ at: at(1) })], at(8)));
    expect(after.pushed).toEqual([]);
    expect(feedOf(after)).toHaveLength(2);
  });

  it('피드는 최대 LIVE_FEED_MAX줄까지', () => {
    const feed = Array.from({ length: LIVE_FEED_MAX }, (_, i) => season({ at: at(i), goals: i }));
    const base = applyLoad(emptyHomeLive(), res(feed, at(30)));
    const pushed = applyPush(base, season({ at: at(40), club: '대구 FC' }));
    expect(feedOf(pushed)).toHaveLength(LIVE_FEED_MAX);
    expect(feedOf(pushed)[0]!.at).toBe(at(40));
  });

  it('숫자 칸: 소켓 소식은 오늘 숫자에만 더하고(뛰는 중은 그대로), 0인 칸은 뺀다', () => {
    const base = applyLoad(emptyHomeLive(), res([]));
    expect(statsOf(emptyHomeLive())).toBeNull();
    expect(statTiles(null)).toEqual([]);
    expect(statTiles(statsOf(base)).map((t) => [t.key, t.label, t.n])).toEqual([
      ['playing', '지금 뛰는 중', 10],
      ['seasons', '오늘 치른 시즌', 5],
      ['new', '오늘 새 선수', 1],
    ]);
    let s = applyPush(base, season({ at: at(9), first: true, club: 'A' }));
    s = applyPush(s, season({ at: at(10), club: 'B' }));
    s = applyPush(s, retire({ at: at(11) }));
    expect(statsOf(s)).toEqual({ playing: 10, seasonsToday: 7, newToday: 2, retiredToday: 1 });
    expect(statTiles(statsOf(s)).map((t) => t.n)).toEqual([10, 7, 2, 1]);
  });
});

describe('홈 라이브 티커 줄', () => {
  const feed = Array.from({ length: 5 }, (_, i) => season({ at: at(i), goals: i }));

  it('보이는 줄보다 소식이 많고 동작 줄이기가 아니어야 굴러간다', () => {
    expect(isRolling(true, LIVE_VISIBLE + 1)).toBe(true);
    expect(isRolling(true, LIVE_VISIBLE)).toBe(false);
    expect(isRolling(false, 20)).toBe(false);
  });

  it('굴러갈 땐 한 줄 더, 아니면 최신 3줄만', () => {
    expect(visibleRows(feed, 0, false)).toEqual(feed.slice(0, 3));
    expect(visibleRows(feed, 0, true)).toEqual(feed.slice(0, 4));
    expect(visibleRows(feed, 3, true)).toEqual([feed[3], feed[4], feed[0], feed[1]]);
  });

  it('커서는 한 줄씩 돌고 피드 끝에서 처음으로 돌아온다', () => {
    let s = applyLoad(emptyHomeLive(), res(feed));
    const seen = [];
    for (let i = 0; i < 6; i++) {
      s = advanceCursor(s);
      seen.push(s.cursor);
    }
    expect(seen).toEqual([1, 2, 3, 4, 0, 1]);
    expect(advanceCursor(emptyHomeLive()).cursor).toBe(0);
  });

  it('rowKey: 굴러갈 때만 자리 번호를 붙인다', () => {
    const e = feed[0]!;
    expect(rowKey(e, 1, false, 4, 5)).toBe(keyOf(e));
    expect(rowKey(e, 1, true, 4, 5)).toBe(`${keyOf(e)}#0`);
    expect(rowKey(e, 2, true, 1, 5)).toBe(`${keyOf(e)}#3`);
  });
});
