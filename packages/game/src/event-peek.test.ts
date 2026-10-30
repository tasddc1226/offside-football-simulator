import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EVENTS } from './events-data.js';
import './event-registry.js';
import { EVENT_PEEK, eventPeek } from './event-peek-data.js';
import { buildEventPeek, PEEK_CAREERS } from './__fixtures__/event-peek-build.js';

// T-11-432 선택지 득실 데이터는 생성기로 만든다. 이벤트 효과·밸런스를 바꿔 이 테스트가 깨지면
// `PEEK_WRITE=1 pnpm --filter @offside/game exec vitest run src/event-peek.test.ts`로 다시 만든 뒤 pnpm format으로 서식을 맞춘다.
describe('이벤트 선택지 득실 (T-11-432)', () => {
  it('생성된 데이터가 지금 이벤트 효과와 같다', () => {
    const built = buildEventPeek(PEEK_CAREERS);
    if (process.env.PEEK_WRITE) {
      const body = JSON.stringify(built, null, 2);
      writeFileSync(
        new URL('./event-peek-data.ts', import.meta.url),
        `// 생성 파일(T-11-432). 손으로 고치지 않는다 — event-peek.test.ts 주석의 명령으로 다시 만든 뒤 pnpm format으로 서식을 맞춘다.\n` +
          `// 이벤트 선택지마다 선택하면 늘 같은 방향으로 바뀌는 득실(ok: 성공·확정 결과, fail: 실패 결과). 점수가 큰 순서다.\n` +
          `import type { ChoicePeek } from './event-peek.js';\n\n` +
          `export const EVENT_PEEK: Readonly<Record<string, readonly ChoicePeek[]>> = ${body};\n\n` +
          `export const eventPeek = (id: string, i: number): ChoicePeek | undefined => EVENT_PEEK[id]?.[i];\n`,
      );
      return;
    }
    expect(built).toEqual(EVENT_PEEK);
  });

  it('모든 이벤트의 선택지 수와 맞는다', () => {
    for (const ev of EVENTS) {
      const p = EVENT_PEEK[ev.id];
      if (p) expect(p.length, ev.id).toBe(ev.choices.length);
    }
  });

  it('알려진 대가가 들어 있다', () => {
    // 감독실 노크: 묵묵히 훈련하면 컨디션이 깎인다.
    expect(eventPeek('bench-talk', 1)?.ok).toContain('cond-');
    // 파티: 실패하면 스캔들이 시작된다.
    expect(eventPeek('party', 0)?.fail).toContain('story:scandal');
  });

  it('생성기는 커리어 진행 RNG를 건드리지 않는다', async () => {
    const { playCareer } = await import('./__fixtures__/play-career.js');
    const seen: string[] = [];
    buildEventPeek(2, (s) => seen.push(JSON.stringify({ ...s, cid: '' })));
    expect(seen).toEqual([0, 1].map((i) => JSON.stringify({ ...playCareer(i), cid: '' })));
  });
});
