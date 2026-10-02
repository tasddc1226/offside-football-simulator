import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BOARD_KEYS } from '@offside/contracts/board-limits';
import type { PostSummary } from './api/boards.js';

const fetchPosts = vi.hoisted(() => vi.fn());
vi.mock('./api/boards.js', () => ({ fetchPosts }));

import { NEWS_GAP_MS, createNews, initialNewsState, touchedAt } from './news.js';

function fakeStorage() {
  const m = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  });
  return m;
}
const SEEN = 'ft_news_seen';

const post = (id: string, createdAt: string, updatedAt = createdAt): PostSummary => ({
  id,
  board: 'notice',
  title: id,
  version: null,
  pinned: false,
  commentCount: 0,
  viewCount: 0,
  likeCount: 0,
  createdAt,
  updatedAt,
});
/** 게시판별 응답 — 순서는 BOARD_KEYS. */
const serve = (...perBoard: (PostSummary[] | 'fail')[]) =>
  fetchPosts.mockImplementation(async (b: string) => {
    const r = perBoard[BOARD_KEYS.indexOf(b as (typeof BOARD_KEYS)[number])] ?? [];
    return r === 'fail'
      ? { ok: false, error: { code: 'x', message: 'x' } }
      : { ok: true, data: { posts: r, hasMore: false } };
  });

const T1 = '2026-10-01T00:00:00.000Z';
const T2 = '2026-10-02T00:00:00.000Z';
const T3 = '2026-10-03T00:00:00.000Z';

let store: Map<string, string>;
beforeEach(() => {
  store = fakeStorage();
  fetchPosts.mockReset();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-05T00:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('touchedAt · initialNewsState', () => {
  it('고친 적이 없으면 작성 시각, 고쳤으면 고친 시각', () => {
    expect(touchedAt({ createdAt: T1, updatedAt: T1 })).toBe(T1);
    expect(touchedAt({ createdAt: T1, updatedAt: T2 })).toBe(T2);
  });
  it('처음 상태는 알릴 글이 없다', () => {
    expect(initialNewsState()).toEqual({ post: null, count: 0, edited: false });
  });
});

describe('checkNews', () => {
  it('처음 온 기기는 지금까지의 글을 본 것으로 치고 알리지 않는다', async () => {
    serve([post('a', T1)], [post('b', T2, T3)]);
    const st = initialNewsState();
    await createNews(st).checkNews();
    expect(st).toEqual(initialNewsState());
    expect(JSON.parse(store.get(SEEN)!)).toBe(T3);
  });
  it('처음 온 기기에 글이 하나도 없으면 1970 년으로 기록해 첫 글부터 알린다', async () => {
    serve([], []);
    const news = createNews(initialNewsState());
    await news.checkNews();
    expect(JSON.parse(store.get(SEEN)!)).toBe('1970-01-01T00:00:00.000Z');
  });
  it('본 시각보다 새 글이 있으면 가장 최근 글과 개수를 알린다', async () => {
    store.set(SEEN, JSON.stringify(T1));
    serve([post('a', T2)], [post('b', T3), post('old', T1)]);
    const st = initialNewsState();
    await createNews(st).checkNews();
    expect(st.post!.id).toBe('b');
    expect(st).toMatchObject({ count: 2, edited: false });
  });
  it('이미 본 글이 고쳐졌으면 edited 로 알린다', async () => {
    store.set(SEEN, JSON.stringify(T2));
    serve([post('a', T1, T3)], []);
    const st = initialNewsState();
    await createNews(st).checkNews();
    expect(st).toMatchObject({ count: 1, edited: true });
    expect(st.post!.id).toBe('a');
  });
  it('새 글이 없으면 상태를 건드리지 않는다', async () => {
    store.set(SEEN, JSON.stringify(T3));
    serve([post('a', T1)], [post('b', T2)]);
    const st = initialNewsState();
    await createNews(st).checkNews();
    expect(st).toEqual(initialNewsState());
  });
  it('한쪽 게시판이라도 못 읽으면 아무것도 하지 않고 다음에 다시 본다', async () => {
    serve([post('a', T3)], 'fail');
    const st = initialNewsState();
    const news = createNews(st);
    await news.checkNews();
    expect(st).toEqual(initialNewsState());
    expect(store.has(SEEN)).toBe(false);
    // 실패해도 간격은 지난 것으로 센다 — 간격 안에서는 다시 부르지 않는다.
    await news.checkNews();
    expect(fetchPosts).toHaveBeenCalledTimes(BOARD_KEYS.length);
  });
  it('간격 안에 다시 부르면 건너뛰고, 간격이 지나면 다시 본다', async () => {
    store.set(SEEN, JSON.stringify(T1));
    serve([], []);
    const news = createNews(initialNewsState());
    await news.checkNews();
    await news.checkNews();
    expect(fetchPosts).toHaveBeenCalledTimes(BOARD_KEYS.length);
    vi.setSystemTime(Date.now() + NEWS_GAP_MS);
    await news.checkNews();
    expect(fetchPosts).toHaveBeenCalledTimes(BOARD_KEYS.length * 2);
  });
});

describe('markNewsSeen · dismissNews', () => {
  it('본 시각은 앞으로만 간다', () => {
    const news = createNews(initialNewsState());
    news.markNewsSeen(T2);
    news.markNewsSeen(T1);
    expect(JSON.parse(store.get(SEEN)!)).toBe(T2);
    news.markNewsSeen(T3);
    expect(JSON.parse(store.get(SEEN)!)).toBe(T3);
  });
  it('알림에 걸린 글보다 이전 시각까지만 봤으면 알림을 유지한다', () => {
    const st = { ...initialNewsState(), post: post('a', T3), count: 1 };
    createNews(st).markNewsSeen(T2);
    expect(st.post!.id).toBe('a');
  });
  it('알림을 닫으면 걸린 글을 본 것으로 치고 알림을 지운다', () => {
    const st = { post: post('a', T1, T2), count: 3, edited: true };
    createNews(st).dismissNews();
    expect(JSON.parse(store.get(SEEN)!)).toBe(T2);
    expect(st.post).toBeNull();
  });
  it('알릴 글이 없을 때 닫아도 아무 일도 없다', () => {
    createNews(initialNewsState()).dismissNews();
    expect(store.has(SEEN)).toBe(false);
  });
});
