import { afterEach, describe, expect, it } from 'vitest';
import { publicNameOf, setNamePublic } from './namePublic.js';

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
