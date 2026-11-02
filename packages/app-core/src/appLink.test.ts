import { describe, expect, it } from 'vitest';
import { parseAppLink } from './appLink.js';

const UUID = '0f8a3b52-6c1d-4e0a-9b7e-1a2b3c4d5e6f';

describe('T-11-622 앱 바로 열기 링크', () => {
  it('초대 링크는 새 주소 · 옛 주소 모두 친구 코드로 읽는다', () => {
    const friend = { kind: 'friend', code: 'ABCD2345' };
    expect(parseAppLink('https://offside-lab.com/invite/ABCD2345')).toEqual(friend);
    expect(parseAppLink('https://offside-lab.com/invite/abcd2345/?lang=en')).toEqual(friend);
    expect(parseAppLink('/invite/ABCD2345')).toEqual(friend);
    expect(parseAppLink('https://offside-lab.com/?friend=ABCD2345&lang=en')).toEqual(friend);
  });

  it('공유 커리어 링크는 소문자 ID로 읽는다', () => {
    expect(parseAppLink(`https://offside-lab.com/career/${UUID.toUpperCase()}?lang=ja`)).toEqual({
      kind: 'career',
      id: UUID,
    });
  });

  it('다른 주소 · 틀린 코드 · 앱 내부 경로는 그대로 둔다', () => {
    for (const raw of [
      'https://evil.example/invite/ABCD2345',
      'https://offside-lab.com/invite/nope',
      'https://offside-lab.com/guide/?friend=ABCD2345',
      'https://offside-lab.com/og/career/x.png',
      'offside://notifications/1',
      '/notifications',
      '/',
    ])
      expect(parseAppLink(raw), raw).toBeNull();
  });
});
