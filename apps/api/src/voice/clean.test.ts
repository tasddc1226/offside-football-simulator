import { describe, expect, it } from 'vitest';
import { cleanVoiceBody, cleanVoiceContext, tidyVoiceBody, voiceBodyKey } from './clean.js';

// 메일은 example.com · .test 도메인, 전화번호는 가짜 번호만 쓴다(공개 저장소 위생).
const ch = (...codes: number[]) => String.fromCodePoint(...codes);

describe('T-11-802 의견 본문 가리기', () => {
  it('메일을 가린다', () => {
    expect(cleanVoiceBody('답장은 fan.one+tag@example.com 으로 주세요')).toBe(
      '답장은 [email] 으로 주세요',
    );
    expect(cleanVoiceBody('me@mail.test')).toBe('[email]');
  });

  it('전화번호를 가린다(010 · 02 · 090 · +82 · 대만 휴대폰)', () => {
    const cases: [string, string][] = [
      ['연락 010-1234-5678 주세요', '연락 [phone] 주세요'],
      ['01012345678', '[phone]'],
      ['010.1234.5678', '[phone]'],
      ['02-123-4567', '[phone]'],
      ['02 1234 5678', '[phone]'],
      ['090-1234-5678', '[phone]'],
      ['+82 10-1234-5678', '[phone]'],
      ['+82 10 1234 5678로 연락', '[phone]로 연락'],
      ['+886 912 345 678', '[phone]'],
      ['0912-345-678', '[phone]'],
      ['0912345678', '[phone]'],
      ['번호는010-1234-5678입니다', '번호는[phone]입니다'],
      ['010-1234-5678 2026', '[phone] 2026'],
    ];
    for (const [input, out] of cases) expect(cleanVoiceBody(input), input).toBe(out);
  });

  it('복구 코드를 가린다(OFS 대문자 · 소문자 · 대시 없음, 글자가 섞인 4-4-4)', () => {
    const cases: [string, string][] = [
      ['코드 OFS-ABCD-EFGH-JKMN 잃어버렸어요', '코드 [code] 잃어버렸어요'],
      ['ofs-abcd-efgh-jkmn', '[code]'],
      ['OFSABCDEFGHJKMN', '[code]'],
      ['OFS ABCD EFGH JKMN', '[code]'],
      ['ABCD-2345-WXYZ', '[code]'],
      ['ab12-cd34-ef56', '[code]'],
    ];
    for (const [input, out] of cases) expect(cleanVoiceBody(input), input).toBe(out);
  });

  it('다른 사이트 주소는 쿼리와 조각을 지우고, 오프사이드 주소는 그대로 둔다', () => {
    const cases: [string, string][] = [
      [
        'https://pay.example.com/checkout?token=secret#frag 결제가 안 돼요',
        'https://pay.example.com/checkout 결제가 안 돼요',
      ],
      ['www.example.com/a?b=1', 'www.example.com/a'],
      ['https://offside-lab.com.evil.test/?token=1', 'https://offside-lab.com.evil.test/'],
      ['https://example.test/u/010-1234-5678?x=1', 'https://example.test/u/[phone]'],
      // 로그인 콜백의 code · state가 실리는 API 주소는 쿼리를 지운다.
      [
        'https://api.offside-lab.com/v1/auth/google/callback?code=4/abc&state=xyz',
        'https://api.offside-lab.com/v1/auth/google/callback',
      ],
    ];
    for (const [input, out] of cases) expect(cleanVoiceBody(input), input).toBe(out);
    for (const kept of [
      '소식 https://offside-lab.com/?news=pst_0f3a9c1e-4b7d-4e2a-9f1c-0a1b2c3d4e5f 봤어요',
      'https://www.offside-lab.com/guide/?x=1#y',
      'https://offside-lab.com/?news=01012345678',
    ])
      expect(cleanVoiceBody(kept), kept).toBe(kept);
  });

  it('날짜 · 점수 · 시각 · 게임 수치 · 숫자만 있는 4-4-4는 남긴다', () => {
    for (const text of [
      '2026-2027 시즌',
      '0-3으로 졌어요',
      '03:00에 멈춰요',
      '2026.11.21 03:00',
      '자금 1234567원 · 123456점',
      '1234-5678-9012',
      '확률 0.5 0.3 0.8 0.9 1.0',
      '0.123456789',
      '0123456',
    ])
      expect(cleanVoiceBody(text), text).toBe(text);
  });

  it('다듬기: CRLF는 LF로, 제어 문자는 지우고(줄바꿈 · 탭은 둔다), 빈 줄 셋 이상은 둘로', () => {
    expect(tidyVoiceBody('첫 줄\r\n둘째 줄\r셋째')).toBe('첫 줄\n둘째 줄\n셋째');
    expect(tidyVoiceBody(`a${ch(0)}b${ch(7)}c\td${ch(0x7f)}`)).toBe('abc\td');
    expect(tidyVoiceBody('a\n\n\n\n\nb')).toBe('a\n\n\nb');
    expect(tidyVoiceBody('a\n \n\t\n  \n\nb')).toBe('a\n\n\nb');
    expect(tidyVoiceBody('a\n\n\nb')).toBe('a\n\n\nb');
    expect(tidyVoiceBody('  \n 안녕 \n ')).toBe('안녕');
  });

  it('500자를 넘으면 자르고, 잘린 이모지 반쪽은 남기지 않는다', () => {
    expect(cleanVoiceBody('가'.repeat(600))).toBe('가'.repeat(500));
    expect(cleanVoiceBody(`${'x'.repeat(499)}${ch(0x1f600)}`)).toBe('x'.repeat(499));
    expect(cleanVoiceBody(`${'x'.repeat(498)}${ch(0x1f600)}`)).toHaveLength(500);
  });

  it('같은 글 지문은 공백 · 대소문자만 다른 글을 같은 값으로 묶는다', async () => {
    const key = await voiceBodyKey('Hello  World\n좋아요');
    expect(key).toMatch(/^[0-9a-f]{16}$/);
    expect(await voiceBodyKey(' hello world 좋아요 ')).toBe(key);
    expect(await voiceBodyKey('hello world 싫어요')).not.toBe(key);
  });
});

describe('T-11-802 맥락 다듬기', () => {
  it('앱 세션이 보낸 ios · android만 믿고, 나머지는 web', () => {
    expect(
      cleanVoiceContext(
        {
          kind: 'bug',
          screen: 'settings',
          platform: 'ios',
          version: '1.1.7 (45) · abcd1234',
          device: 'iOS 18.1',
        },
        'app',
      ),
    ).toEqual({
      kind: 'bug',
      screen: 'settings',
      platform: 'ios',
      appVersion: '1.1.7 (45) · abcd1234',
      device: 'ios 18.1',
    });
    expect(cleanVoiceContext({ platform: 'android' }, 'app').platform).toBe('android');
    expect(cleanVoiceContext({ platform: 'ios' }, 'web').platform).toBe('web');
    expect(cleanVoiceContext({ platform: 'android' }, 'toss').platform).toBe('web');
    expect(cleanVoiceContext({ platform: 'windows' }, 'app').platform).toBe('web');
  });

  it('모르는 종류는 other, 패턴 밖 입구는 null, 빈 버전은 unknown, 빈 기기는 null', () => {
    expect(cleanVoiceContext({}, 'web')).toEqual({
      kind: 'other',
      screen: null,
      platform: 'web',
      appVersion: 'unknown',
      device: null,
    });
    expect(cleanVoiceContext({ kind: 'praise', screen: 'Home!' }, 'web')).toMatchObject({
      kind: 'other',
      screen: null,
    });
    expect(cleanVoiceContext({ screen: 'career:season_3-x' }, 'web').screen).toBe(
      'career:season_3-x',
    );
    expect(cleanVoiceContext({ screen: 'a'.repeat(41) }, 'web').screen).toBeNull();
    expect(cleanVoiceContext({ version: 'v'.repeat(80) }, 'web').appVersion).toHaveLength(60);
    expect(cleanVoiceContext({ version: ` ${ch(0x200b)} ` }, 'web').appVersion).toBe('unknown');
    expect(cleanVoiceContext({ device: '日本語!!' }, 'web').device).toBeNull();
    const ua = cleanVoiceContext(
      { device: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit' },
      'web',
    ).device;
    expect(ua!.length).toBeLessThanOrEqual(40);
    expect(ua).toMatch(/^[a-z0-9 ._-]+$/);
  });
});
