import { setStorage } from '@offside/game/storage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from './i18n/core';
import { en } from './i18n/en/index.js';
import { voiceText as VT } from './i18n/ko/voice.js';
import {
  appVoiceVersion,
  checkVoice,
  pickVoiceKind,
  submitVoice,
  voiceDevice,
  voiceDraft,
  voiceKindLabel,
  voicePlaceholder,
  voiceVersion,
  webVoiceDevice,
} from './voice.js';

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string) {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
}

const ctx = {
  screen: 'settings' as const,
  platform: 'web',
  version: 'dev',
  device: 'ios instagram',
};
const reply = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status });
const fail = (status: number, code: string, message: string) =>
  reply(status, { error: { code, message, retryable: false }, meta: { requestId: 'req_t' } });
/** 보낸 요청(방법 · 경로 · 본문). */
const sent = (f: ReturnType<typeof vi.fn>) =>
  f.mock.calls.map(([url, init]) => ({
    method: (init as RequestInit).method,
    path: new URL(String(url)).pathname,
    body: (init as RequestInit).body ? JSON.parse(String((init as RequestInit).body)) : undefined,
  }));

beforeEach(() => {
  setStorage(new MemoryStorage());
  voiceDraft.kind = null;
  voiceDraft.text = '';
});
afterEach(() => {
  vi.unstubAllGlobals();
  setLocale('ko');
});

describe('T-11-802 의견 본문 확인', () => {
  it('빈 글 · 1자 · 보이지 않는 글자만 있는 글은 안내를 돌려주고, 앞뒤 공백은 뺀다', () => {
    expect(checkVoice('')).toEqual({ ok: false, message: VT.empty });
    expect(checkVoice('  \n ')).toEqual({ ok: false, message: VT.empty });
    expect(checkVoice('가')).toEqual({ ok: false, message: VT.short });
    expect(checkVoice(String.fromCodePoint(0x3164, 0x3164, 0x200b))).toEqual({
      ok: false,
      message: VT.short,
    });
    expect(checkVoice('  화면이 멈춰요 \n')).toEqual({ ok: true, body: '화면이 멈춰요' });
    expect(checkVoice('가'.repeat(500))).toEqual({ ok: true, body: '가'.repeat(500) });
  });

  it('지금 언어로 안내한다', () => {
    setLocale('en', en);
    expect(checkVoice('')).toEqual({ ok: false, message: 'Please write something first.' });
    expect(voicePlaceholder('bug')).toBe(
      'Which screen were you on, and what did you do when it happened?',
    );
  });

  it('같은 종류를 다시 누르면 고름을 풀고, 종류에 따라 안내 문구만 바뀐다', () => {
    expect(pickVoiceKind('bug')).toBe('bug');
    expect(voiceDraft.kind).toBe('bug');
    expect(pickVoiceKind('idea')).toBe('idea');
    expect(pickVoiceKind('idea')).toBeNull();
    expect(voicePlaceholder(null)).toBe(VT.placeholder);
    expect(voicePlaceholder('bug')).toBe(VT.placeholderBug);
    expect(voicePlaceholder('idea')).toBe(VT.placeholderIdea);
    expect(voicePlaceholder('other')).toBe(VT.placeholder);
    expect(['bug', 'idea', 'other'].map((k) => voiceKindLabel(k as 'bug'))).toEqual([
      VT.kindBug,
      VT.kindIdea,
      VT.kindOther,
    ]);
  });
});

describe('T-11-802 의견 보내기', () => {
  it('성공하면 POST /v1/voices 한 번으로 보내고 초안을 비운다. 고르지 않은 종류는 other', async () => {
    const f = vi.fn(async () => reply(204));
    vi.stubGlobal('fetch', f);
    voiceDraft.text = '  버튼이 안 눌려요 ';
    expect(await submitVoice(ctx)).toEqual({ ok: true });
    expect(sent(f)).toEqual([
      {
        method: 'POST',
        path: '/v1/voices',
        body: {
          kind: 'other',
          body: '버튼이 안 눌려요',
          screen: 'settings',
          platform: 'web',
          version: 'dev',
          device: 'ios instagram',
        },
      },
    ]);
    expect(voiceDraft).toEqual({ kind: null, text: '' });
  });

  it('고른 종류를 보내고, 기기 값이 없으면 칸을 빼고, 빈 버전은 unknown으로 보낸다', async () => {
    const f = vi.fn(async () => reply(204));
    vi.stubGlobal('fetch', f);
    voiceDraft.kind = 'idea';
    voiceDraft.text = '친선전 기록을 보고 싶어요';
    await submitVoice({ ...ctx, screen: 'home', version: ' ', device: null });
    expect(sent(f)[0]!.body).toEqual({
      kind: 'idea',
      body: '친선전 기록을 보고 싶어요',
      screen: 'home',
      platform: 'web',
      version: 'unknown',
    });
  });

  it('보낼 수 없는 글은 요청하지 않는다', async () => {
    const f = vi.fn(async () => reply(204));
    vi.stubGlobal('fetch', f);
    voiceDraft.text = '가';
    expect(await submitVoice(ctx)).toEqual({ ok: false, message: VT.short });
    expect(f).not.toHaveBeenCalled();
  });

  it('서버 오류는 서버 문장을 보이고 초안을 남긴다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => fail(429, 'RATE_LIMITED', "You're sending feedback too often.")),
    );
    voiceDraft.kind = 'bug';
    voiceDraft.text = '또 멈춰요';
    expect(await submitVoice(ctx)).toEqual({
      ok: false,
      message: "You're sending feedback too often.",
    });
    expect(voiceDraft).toEqual({ kind: 'bug', text: '또 멈춰요' });
  });

  it('연결 실패 · 읽지 못한 응답은 VT.fail을 보이고 초안을 남긴다', async () => {
    voiceDraft.text = '오프라인에서 썼어요';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    expect(await submitVoice(ctx)).toEqual({ ok: false, message: VT.fail });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html>bad gateway</html>', { status: 502 })),
    );
    expect(await submitVoice(ctx)).toEqual({ ok: false, message: VT.fail });
    expect(voiceDraft.text).toBe('오프라인에서 썼어요');
  });

  it('세션이 없는 첫 방문자는 익명 세션을 받은 뒤 한 번 더 보낸다', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(fail(401, 'PROFILE_REQUIRED', '접속 정보가 없어요.'))
      .mockResolvedValueOnce(reply(200, { data: { id: 'prf_t', linked: {} }, meta: {} }))
      .mockResolvedValueOnce(reply(204));
    vi.stubGlobal('fetch', f);
    voiceDraft.text = '처음 왔어요';
    expect(await submitVoice(ctx)).toEqual({ ok: true });
    expect(sent(f).map((r) => `${r.method} ${r.path}`)).toEqual([
      'POST /v1/voices',
      'GET /v1/profile',
      'POST /v1/voices',
    ]);
  });
});

describe('T-11-802 맥락 만들기', () => {
  it('기기 대략값은 서버와 같은 규칙으로 다듬는다', () => {
    expect(voiceDevice('ios', '18.1')).toBe('ios 18.1');
    expect(voiceDevice('android', 34)).toBe('android 34');
    expect(webVoiceDevice('ios', 'instagram', false)).toBe('ios instagram');
    expect(webVoiceDevice('android', undefined, false)).toBe('android');
    expect(webVoiceDevice('other', null, true)).toBe('other pwa');
    expect(webVoiceDevice('android', 'other-webview', true)).toBe('android other-webview pwa');
    expect(voiceDevice()).toBeNull();
    expect(voiceDevice('日本', '')).toBeNull();
    expect(voiceDevice('x'.repeat(50))).toHaveLength(40);
  });

  it('앱 버전은 오류 보고와 같은 꼴, 빈 버전은 unknown', () => {
    expect(appVoiceVersion({ version: '1.1.7', build: '45', updateId: 'abcd1234' })).toBe(
      '1.1.7 (45) · abcd1234',
    );
    expect(appVoiceVersion({ version: '1.1.7', build: '45', updateId: null })).toBe('1.1.7 (45)');
    expect(voiceVersion('')).toBe('unknown');
    expect(voiceVersion(undefined)).toBe('unknown');
    expect(voiceVersion('v'.repeat(80))).toHaveLength(60);
  });
});
