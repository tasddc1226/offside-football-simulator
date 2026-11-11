import { beforeEach, describe, expect, it } from 'vitest';
import { setStorage } from '@offside/game/storage';
import { creatorTrackingId, detectCreatorTracking } from './creatorTracking.js';

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
