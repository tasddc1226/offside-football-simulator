import { describe, expect, it, vi } from 'vitest';
import { TRANSLATE_MODEL, draftTranslations, translateText } from './ai.js';

const reply = (content: string | null) => ({ choices: [{ message: { content } }] });
const fakeAi = (run: (model: string, input: { messages: { content: string }[] }) => unknown) =>
  ({
    run: vi.fn(async (m: string, i: { messages: { content: string }[] }) => run(m, i)),
  }) as unknown as Ai & {
    run: ReturnType<typeof vi.fn>;
  };

describe('Workers AI 번역', () => {
  it('목표 언어를 시스템 지시에 넣고 사고 과정 없이 결과만 받는다', async () => {
    const ai = fakeAi(() => reply('  Nice goal!  '));
    expect(await translateText(ai, '골 멋져요', 'en')).toBe('Nice goal!');
    const [model, input] = ai.run.mock.calls[0]!;
    expect(model).toBe(TRANSLATE_MODEL);
    expect(input.messages[0].content).toContain('into English');
    expect(input.messages[0].content).toContain('확률 도감 = Odds guide = 確率図鑑');
    expect(input.messages[1].content).toBe('골 멋져요');
    expect(input.chat_template_kwargs).toEqual({ enable_thinking: false });
  });
  it('바인딩이 없거나 실패·빈 결과면 503', async () => {
    await expect(translateText(undefined, '안녕', 'ja')).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
    });
    for (const ai of [
      fakeAi(() => Promise.reject(new Error('upstream'))),
      fakeAi(() => reply(null)),
      fakeAi(() => ({})),
    ])
      await expect(translateText(ai, '안녕', 'ja')).rejects.toMatchObject({
        code: 'SERVICE_UNAVAILABLE',
      });
  });
  it('공지 초안은 제목·본문을 영어·일본어로 옮기고 한도에서 자른다', async () => {
    const ai = fakeAi((_, i) => {
      const ja = i.messages[0]!.content.includes('into Japanese');
      const src = i.messages[1]!.content;
      return reply(
        src === '점검' ? (ja ? '点検'.repeat(100) : 'Maintenance') : ja ? '今夜' : 'Tonight',
      );
    });
    const out = await draftTranslations(ai, { title: '점검', body: '오늘 밤' });
    expect(out.en).toEqual({ title: 'Maintenance', body: 'Tonight' });
    expect(out.ja.body).toBe('今夜');
    expect(out.ja.title.length).toBeLessThanOrEqual(80);
    expect(ai.run).toHaveBeenCalledTimes(4);
  });
});
