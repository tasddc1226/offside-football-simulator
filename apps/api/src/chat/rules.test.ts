import { CHAT_BODY_MAX, CHAT_BURST, CHAT_GAP_MS, CHAT_WINDOW_MS } from '@offside/contracts/chat';
import { describe, expect, it } from 'vitest';
import { chatAuthor, checkSend } from './rules.js';

describe('T-11-015 채팅 한 줄 규칙', () => {
  it('공백을 한 칸으로 다듬고, 빈 줄·문자열이 아닌 값은 조용히 버린다', () => {
    expect(checkSend('  안녕\n  하세요 ', [], 0, false)).toEqual({
      ok: true,
      body: '안녕 하세요',
      sent: [0],
    });
    expect(checkSend('   ', [], 0, false)).toBeNull();
    expect(checkSend(3, [], 0, false)).toBeNull();
  });

  it('너무 길거나 링크·욕설이 있으면 거절한다', () => {
    expect(checkSend('가'.repeat(CHAT_BODY_MAX + 1), [], 0, false)).toEqual({
      ok: false,
      code: 'long',
    });
    expect(checkSend('여기 offside . com 와요', [], 0, false)).toEqual({
      ok: false,
      code: 'filter',
    });
    expect(checkSend('시 발', [], 0, false)).toEqual({ ok: false, code: 'filter' });
  });

  it('간격이 짧거나 창 안에서 너무 많이 쓰면 거절하고, 창이 지나면 다시 받는다', () => {
    expect(checkSend('a', [1000], 1000 + CHAT_GAP_MS - 1, false)).toEqual({
      ok: false,
      code: 'rate',
    });
    const burst = Array.from({ length: CHAT_BURST }, (_, i) => i * CHAT_GAP_MS);
    const now = burst.at(-1)! + CHAT_GAP_MS;
    expect(checkSend('a', burst, now, false)).toEqual({ ok: false, code: 'rate' });
    const later = burst[0]! + CHAT_WINDOW_MS;
    expect(checkSend('a', burst, later, false)).toEqual({
      ok: true,
      body: 'a',
      sent: [...burst.slice(1), later],
    });
  });

  it('운영자는 도배 제한·필터 없이 쓰지만 길이 한도는 같다', () => {
    expect(checkSend('공지 offside-lab.com', [0], 1, true)).toMatchObject({ ok: true });
    expect(checkSend('가'.repeat(CHAT_BODY_MAX + 1), [], 0, true)).toEqual({
      ok: false,
      code: 'long',
    });
  });

  it('작성자 키는 프로필마다 같고 서로 다르며 프로필 id를 드러내지 않는다', async () => {
    const a = await chatAuthor('prf_a');
    expect(a).toHaveLength(16);
    expect(await chatAuthor('prf_a')).toBe(a);
    expect(await chatAuthor('prf_b')).not.toBe(a);
  });
});
