import { beforeEach, describe, expect, it } from 'vitest';
import { setStorage } from '@offside/game/storage';
import {
  creatorTrackingId,
  detectCreatorTracking,
  hasPendingCreatorTracking,
  syncCreatorTracking,
} from './creatorTracking.js';

const ID = 'abcdefghijklmnopqrstuvwxyz123456';

describe('T-11-700 크리에이터 추적값', () => {
  let mem: Map<string, string>;
  beforeEach(() => {
    mem = new Map();
    setStorage({ getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v) });
  });

  it('주소에 추적값이 없으면 남기지 않는다', () => {
    detectCreatorTracking('https://offside-lab.com/?utm_source=meta');
    expect(creatorTrackingId()).toBeNull();
    expect(mem.size).toBe(0);
  });

  it('크리에이터 링크의 추적값을 남기고 다음 방문에도 돌려준다', () => {
    detectCreatorTracking(`https://offside-lab.com/?tracking_id=${ID}`);
    detectCreatorTracking('https://offside-lab.com/');
    expect(creatorTrackingId()).toBe(ID);
  });

  it('형식이 틀린 값은 남기지 않고, 다른 링크로 오면 새 값으로 바꾼다', () => {
    detectCreatorTracking(`https://offside-lab.com/?tracking_id=${ID}`);
    detectCreatorTracking('https://offside-lab.com/?tracking_id=<script>');
    expect(creatorTrackingId()).toBe(ID);
    const next = ID.toUpperCase();
    detectCreatorTracking(`https://offside-lab.com/?tracking_id=${next}`);
    expect(creatorTrackingId()).toBe(next);
  });

  it('저장된 값이 깨졌으면 주문에 싣지 않는다', () => {
    mem.set('ft_creator_tracking', JSON.stringify('nope'));
    expect(creatorTrackingId()).toBeNull();
  });
});

describe('T-11-704 크리에이터 링크를 프로필에 묶기', () => {
  let mem: Map<string, string>;
  beforeEach(() => {
    mem = new Map();
    setStorage({ getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v) });
  });

  it('링크로 들어오지 않았으면 보내지 않는다', async () => {
    const sent: string[] = [];
    expect(hasPendingCreatorTracking()).toBe(false);
    await syncCreatorTracking(
      { id: 'p0', linked: true },
      async (id) => (sent.push(id), { ok: true }),
    );
    expect(sent).toEqual([]);
  });

  it('익명 프로필에도 보내 두고, 로그인한 프로필에 묶이면 그만 보낸다', async () => {
    detectCreatorTracking(`https://offside-lab.com/?tracking_id=${ID}`);
    const sent: string[] = [];
    const send = async (id: string) => (sent.push(id), { ok: true });
    await syncCreatorTracking({ id: 'anon', linked: false }, send);
    await syncCreatorTracking({ id: 'anon', linked: false }, send);
    expect(sent).toEqual([ID]);
    expect(hasPendingCreatorTracking()).toBe(true);
    await syncCreatorTracking({ id: 'owner', linked: true }, send);
    expect(sent).toEqual([ID, ID]);
    expect(hasPendingCreatorTracking()).toBe(false);
    // 결제에 싣는 브라우저 값은 그대로 남는다.
    expect(creatorTrackingId()).toBe(ID);
  });

  it('잠깐 실패하면 다음 확인 때 다시 보내고, 서버가 거절하면 지운다', async () => {
    detectCreatorTracking(`https://offside-lab.com/?tracking_id=${ID}`);
    await syncCreatorTracking({ id: 'o1', linked: true }, async () => ({
      ok: false,
      error: { retryable: true },
    }));
    expect(hasPendingCreatorTracking()).toBe(true);
    await syncCreatorTracking({ id: 'o1', linked: true }, async () => ({
      ok: false,
      error: { retryable: false },
    }));
    expect(hasPendingCreatorTracking()).toBe(false);
  });
});
