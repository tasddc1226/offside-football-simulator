import { afterEach, describe, expect, it } from 'vitest';
import { canPublishName, publicNameOf, setNamePublic } from './namePublic.js';

describe('선수 이름 공개 (T-10-065)', () => {
  afterEach(() => setNamePublic(true));

  it('기본은 켜짐 — 서버가 받을 이름만 보내고, 끄면 null', () => {
    expect(publicNameOf(' 도하람 ')).toBe('도하람');
    expect(publicNameOf('시발 FC')).toBeNull();
    expect(publicNameOf('<b>')).toBeNull();
    expect(publicNameOf('   ')).toBeNull();
    setNamePublic(false);
    expect(publicNameOf('도하람')).toBeNull();
  });
});

describe('익명으로 은퇴한 내 선수 이름 공개 (T-11-266)', () => {
  it('서버에 이름이 없는 내 선수 중 이 기기가 공개할 수 있는 이름을 아는 것만 고른다', async () => {
    const { anonOwnNames } = await import('./cardNames.js');
    const local = new Map([
      ['a', '도하람'],
      ['b', '시발 FC'],
      ['c', '남의선수'],
      ['d', '이미공개'],
    ]);
    expect(anonOwnNames(['a', 'b', 'e'], local)).toEqual([{ careerId: 'a', publicName: '도하람' }]);
  });
});

describe('공개할 수 없는 이름 미리 알리기 (T-11-439)', () => {
  it('환경설정을 꺼도 이름 자체로만 판단한다', () => {
    expect(canPublishName('도하람')).toBe(true);
    expect(canPublishName('시발 FC')).toBe(false);
    expect(canPublishName('<b>')).toBe(false);
    setNamePublic(false);
    expect(canPublishName('도하람')).toBe(true);
  });
});
