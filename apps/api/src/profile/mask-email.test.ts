import { describe, expect, it } from 'vitest';
import { maskEmail } from './mask-email.js';

describe('maskEmail', () => {
  it('null이면 null', () => {
    expect(maskEmail(null)).toBeNull();
  });

  it('첫 글자 + *** + @도메인', () => {
    expect(maskEmail('alice@mail.example.org')).toBe('a***@mail.example.org');
  });

  it('로컬 파트가 한 글자여도 첫 글자만 남긴다', () => {
    expect(maskEmail('a@example.com')).toBe('a***@example.com');
  });

  it('@가 없거나 로컬·도메인이 비어 있으면 null', () => {
    expect(maskEmail('no-at-sign')).toBeNull();
    expect(maskEmail('@example.com')).toBeNull();
    expect(maskEmail('alice@')).toBeNull();
  });
});
