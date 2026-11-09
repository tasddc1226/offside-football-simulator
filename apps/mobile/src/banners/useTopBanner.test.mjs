// 화면 위 배너 고르기(useTopBanner)를 실제로 부른다. valtio 스냅숏 · 새 버전 확인만 흉내 내고 화면 렌더는 하지 않는다.
// 새 버전(OTA) > 새 소식. 새 소식은 소식 화면 · 선수 만들기에서만 숨기고(audit F1), 숨겨도 본 것으로 치지 않는다.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const s = vi.hoisted(() => ({
  update: false,
  hidden: false,
  appState: { screen: 'home' },
  newsState: { post: null, count: 0, edited: false },
}));
vi.mock('valtio', () => ({ useSnapshot: (o) => o }));
vi.mock('../platform/updates', () => ({ useUpdatePending: () => s.update }));
vi.mock('../platform/storeText', () => ({ hiddenPost: () => s.hidden }));
vi.mock('../store', () => ({ appState: s.appState, newsState: s.newsState }));

import { useTopBanner } from './useTopBanner';

const POST = { id: 'p1', board: 'release', title: '새 기능' };

beforeEach(() => {
  s.update = false;
  s.hidden = false;
  s.appState.screen = 'home';
  Object.assign(s.newsState, { post: null, count: 0, edited: false });
});

describe('useTopBanner', () => {
  it('새 소식이 없으면 아무 배너도 없다', () => {
    expect(useTopBanner()).toBe(null);
    s.appState.screen = 'create';
    expect(useTopBanner()).toBe(null);
  });

  it('홈 → 선수 만들기 → 홈 · 다른 화면: 만들기에서만 숨기고 돌아오면 같은 소식이 다시 뜬다', () => {
    s.newsState.post = POST;
    s.newsState.count = 1;
    expect(useTopBanner()).toBe('news');
    s.appState.screen = 'create';
    expect(useTopBanner()).toBe(null);
    // 숨김이 소식 상태를 건드리지 않는다(읽음 · 닫음 처리 없음).
    expect(s.newsState).toEqual({ post: POST, count: 1, edited: false });
    s.appState.screen = 'home';
    expect(useTopBanner()).toBe('news');
    for (const screen of ['game', 'owner', 'settings', 'hof', 'league']) {
      s.appState.screen = screen;
      expect(useTopBanner()).toBe('news');
    }
  });

  it('소식 화면에서는 그대로 띄우지 않는다', () => {
    s.newsState.post = POST;
    s.appState.screen = 'board';
    expect(useTopBanner()).toBe(null);
  });

  it('닫거나 읽어 post가 비면 어느 화면에서도 뜨지 않는다', () => {
    s.newsState.post = POST;
    s.newsState.post = null;
    for (const screen of ['home', 'create', 'game']) {
      s.appState.screen = screen;
      expect(useTopBanner()).toBe(null);
    }
  });

  it('iOS에서 숨기는 글(hiddenPost)은 띄우지 않는다', () => {
    s.newsState.post = POST;
    s.hidden = true;
    expect(useTopBanner()).toBe(null);
  });

  it('새 버전 배너는 소식보다 먼저이고 선수 만들기 · 소식 화면에서도 뜬다', () => {
    s.update = true;
    s.newsState.post = POST;
    for (const screen of ['home', 'create', 'board']) {
      s.appState.screen = screen;
      expect(useTopBanner()).toBe('update');
    }
  });
});
