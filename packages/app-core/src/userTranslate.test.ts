import { describe, expect, it, vi } from 'vitest';

const translate = vi.fn();
vi.mock('./api/translate.js', () => ({ translate: (...a: unknown[]) => translate(...a) }));
const { canTranslate, translateUserText } = await import('./userTranslate.js');

describe('T-11-146 번역 보기', () => {
  it('지금 언어와 다른 글자로 쓴 글에만 버튼을 단다', () => {
    expect(canTranslate('골 멋져요', 'ko')).toBe(false);
    expect(canTranslate('ナイスゴール', 'ko')).toBe(true);
    expect(canTranslate('nice goal', 'ko')).toBe(true);
    expect(canTranslate('ㅋㅋ 👍 10', 'en')).toBe(true);
    expect(canTranslate('👍 10', 'en')).toBe(false);
    expect(canTranslate('nice goal', 'en')).toBe(false);
    expect(canTranslate('素晴らしい', 'ja')).toBe(false);
    expect(canTranslate('골 멋져요', 'ja')).toBe(true);
    expect(canTranslate('nice goal', 'ja')).toBe(true);
  });
  it('같은 글은 한 번만 묻고 실패는 기억하지 않는다', async () => {
    translate.mockResolvedValueOnce({
      ok: false,
      error: { code: 'X', message: 'm', retryable: true },
    });
    expect((await translateUserText('안녕', 'en')).ok).toBe(false);
    translate.mockResolvedValue({ ok: true, data: { text: 'Hi' } });
    expect(await translateUserText('안녕', 'en')).toEqual({ ok: true, data: 'Hi' });
    expect(await translateUserText('안녕', 'en')).toEqual({ ok: true, data: 'Hi' });
    expect(translate).toHaveBeenCalledTimes(2);
    expect(translate).toHaveBeenLastCalledWith('안녕', 'en');
  });
});
