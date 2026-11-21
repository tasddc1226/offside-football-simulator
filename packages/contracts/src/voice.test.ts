import { describe, expect, it } from 'vitest';
import { TRANSLATE_TEXT_MAX } from './translate.js';
import {
  AdminVoiceQuerySchema,
  AdminVoiceResolveSchema,
  hasVisibleChar,
  VOICE_BODY_MAX,
  VOICE_RESOLVE_MAX,
  VoiceInputSchema,
} from './voice.js';

/** 보이지 않는 글자를 소스에 그대로 두지 않으려고 코드 포인트로 만든다. */
const ch = (...codes: number[]) => String.fromCodePoint(...codes);

describe('T-11-802 의견 보내기 본문', () => {
  it('앞뒤 공백을 빼고 받는다. 맥락 칸은 그대로, 모르는 필드는 버린다', () => {
    const parsed = VoiceInputSchema.parse({
      body: '  화면이 멈춰요\n',
      kind: 'bug',
      screen: 'settings',
      platform: 'web',
      version: 'dev',
      device: 'ios instagram',
      nickname: '보내면 안 되는 값',
    });
    expect(parsed).toEqual({
      body: '화면이 멈춰요',
      kind: 'bug',
      screen: 'settings',
      platform: 'web',
      version: 'dev',
      device: 'ios instagram',
    });
    expect(VoiceInputSchema.parse({ body: '좋아요' })).toEqual({ body: '좋아요' });
  });

  it('1자 · 501자 · 보이지 않는 글자만 있는 글은 받지 않는다. 500자와 줄바꿈은 받는다', () => {
    const ok = (body: string) => VoiceInputSchema.safeParse({ body }).success;
    expect(ok('가')).toBe(false);
    expect(ok('  가  ')).toBe(false);
    expect(ok('가'.repeat(VOICE_BODY_MAX + 1))).toBe(false);
    const invisible = [
      ch(0x3164, 0x3164),
      ch(0x115f, 0x1160),
      ch(0xffa0, 0xffa0),
      ch(0x200b, 0x200b),
      ch(0x2800, 0x2800),
      ch(0x0a, 0x0a, 0x09),
      ch(0x3164, 0x20, 0x200d),
    ];
    for (const body of invisible) expect(ok(body), JSON.stringify(body)).toBe(false);
    expect(ok('가'.repeat(VOICE_BODY_MAX))).toBe(true);
    expect(ok('첫 줄\n\n둘째 줄')).toBe(true);
  });

  it('맥락 칸은 길이 상한(200자)만 본다', () => {
    const ok = (extra: Record<string, unknown>) =>
      VoiceInputSchema.safeParse({ body: '안녕하세요', ...extra }).success;
    expect(ok({ kind: 'anything', screen: 'Weird Screen!' })).toBe(true);
    expect(ok({ device: 'x'.repeat(200) })).toBe(true);
    for (const key of ['kind', 'screen', 'platform', 'version', 'device'])
      expect(ok({ [key]: 'x'.repeat(201) }), key).toBe(false);
    expect(ok({ version: 3 })).toBe(false);
  });

  it('보이는 글자 판정은 공개 이름 규칙과 같은 집합을 쓴다', () => {
    expect(hasVisibleChar(`${ch(0x3164)}가`)).toBe(true);
    expect(hasVisibleChar(ch(0x3000, 0xa0, 0xfeff))).toBe(false);
    expect(hasVisibleChar(ch(0x07, 0x200d))).toBe(false);
  });

  it('운영자가 의견을 번역해 읽을 수 있게 본문 상한은 번역 상한 이하다', () => {
    expect(VOICE_BODY_MAX).toBeLessThanOrEqual(TRANSLATE_TEXT_MAX);
  });
});

describe('T-11-802 운영 목록 · 처리', () => {
  it('목록 쿼리는 엄격하고 기본값은 열린 의견 50개다', () => {
    expect(AdminVoiceQuerySchema.parse({})).toEqual({ status: 'open', limit: 50 });
    expect(
      AdminVoiceQuerySchema.parse({
        status: 'all',
        kind: 'idea',
        profile: 'prf_x',
        before: '2026-11-21T00:00:00.000Z',
        limit: '20',
      }),
    ).toEqual({
      status: 'all',
      kind: 'idea',
      profile: 'prf_x',
      before: '2026-11-21T00:00:00.000Z',
      limit: 20,
    });
    const ok = (q: Record<string, unknown>) => AdminVoiceQuerySchema.safeParse(q).success;
    expect(ok({ lang: 'en' })).toBe(false);
    expect(ok({ status: 'closed' })).toBe(false);
    expect(ok({ kind: 'praise' })).toBe(false);
    expect(ok({ limit: '101' })).toBe(false);
    expect(ok({ limit: '0' })).toBe(false);
    expect(ok({ before: '2026-11-21' })).toBe(false);
  });

  it('처리는 1~50개만 받고 모르는 필드는 거절한다', () => {
    const ids = (n: number) => Array.from({ length: n }, (_, i) => `vox_${i}`);
    const ok = (v: unknown) => AdminVoiceResolveSchema.safeParse(v).success;
    expect(ok({ ids: ids(0), resolved: true })).toBe(false);
    expect(ok({ ids: ids(VOICE_RESOLVE_MAX + 1), resolved: true })).toBe(false);
    expect(ok({ ids: ids(1), resolved: false })).toBe(true);
    expect(ok({ ids: ids(VOICE_RESOLVE_MAX), resolved: true })).toBe(true);
    expect(ok({ ids: ids(1), resolved: true, note: 'x' })).toBe(false);
    expect(ok({ ids: [''], resolved: true })).toBe(false);
  });
});
