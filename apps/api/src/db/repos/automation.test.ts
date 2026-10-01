import { describe, expect, it } from 'vitest';
import { isAutomatedCareer, isHeadless, judgeAutomation, type SeasonRow } from './automation.js';

const T0 = Date.parse('2026-09-28T00:00:00.000Z');
const human = {
  clicks: 14,
  keys: 0,
  touches: 0,
  moves: 400,
  synthetic: 0,
  hiddenMs: 0,
  webdriver: false,
};

/** gapsSec 간격으로 올라온 한 커리어의 시즌들. */
function career(
  profileId: string,
  careerId: string,
  name: string | null,
  gapsSec: number[],
  signals?: (i: number) => object,
): SeasonRow[] {
  let t = T0;
  return [0, ...gapsSec].map((g, i) => {
    t += g * 1000;
    return {
      careerId,
      profileId,
      name,
      status: 'active',
      createdAt: new Date(t).toISOString(),
      signalsJson: signals ? JSON.stringify({ ...human, ms: g * 1000, ...signals(i) }) : null,
    };
  });
}
const humanGaps = [46, 8, 30, 6, 24, 14, 22, 31, 3, 24, 15, 11, 38, 25];

describe('자동 플레이 탐지', () => {
  it('들쭉날쭉한 사람의 흐름은 목록에 없다', () => {
    expect(
      judgeAutomation(
        career('p-human', 'c1', '강흥민', humanGaps, () => ({})),
        6,
      ),
    ).toEqual([]);
    // 조작 요약이 없는 옛 기록도 간격이 불규칙하면 없다.
    expect(judgeAutomation(career('p-old', 'c2', null, humanGaps), 6)).toEqual([]);
  });

  it('자동화 브라우저·스크립트 클릭·입력 없는 진행은 높음', () => {
    const [s] = judgeAutomation(
      career('p-bot-0001', 'c1', null, humanGaps, (i) =>
        i < 3 ? { webdriver: true, clicks: 0, synthetic: 9 } : { clicks: 0 },
      ),
      6,
    );
    expect(s).toMatchObject({ profile: 'p-bot-00', level: 'high' });
    expect(s!.reasons).toEqual(expect.arrayContaining(['webdriver', 'synthetic', 'noInput']));
  });

  it('기계처럼 일정한 간격 + 번호만 바꾼 연속 커리어는 높음, 시각은 쉬는 시간을 뺀다', () => {
    const steady = [52, 51, 49, 47, 45, 50, 51, 49, 48, 50, 3600];
    const rows = [1, 2, 3].flatMap((n) => career('p-mav', `m${n}`, `Maverick#${n}`, steady));
    const [s] = judgeAutomation(rows, 6);
    expect(s).toMatchObject({ level: 'high', reasons: ['metronome', 'serial'] });
    expect(s!.careers[0]).toMatchObject({ seasons: 12, medianGapSec: 50, cv: expect.any(Number) });
    expect(s!.careers[0]!.cv!).toBeLessThan(0.08);
  });

  it('마우스 클릭에 커서 이동이 없으면 보통, AI 이름과 겹치면 높음', () => {
    const noMoves = (name: string) =>
      judgeAutomation(
        career('p', 'c', name, humanGaps, () => ({ moves: 1 })),
        6,
      )[0];
    expect(noMoves('홍길동')).toMatchObject({ level: 'medium', reasons: ['noMoves'] });
    expect(noMoves('임재미나이')).toMatchObject({ level: 'medium', score: 3 });
    // 터치 기기는 커서 이동이 없는 게 정상이다.
    expect(
      judgeAutomation(
        career('p', 'c', 'x', humanGaps, () => ({ moves: 0, touches: 20 })),
        6,
      ),
    ).toEqual([]);
  });

  it('헤드리스 User-Agent', () => {
    expect(
      isHeadless('Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/140.0.0.0 Safari/537.36'),
    ).toBe(true);
    expect(isHeadless('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1')).toBe(
      false,
    );
    expect(isHeadless(undefined)).toBe(false);
  });
});

describe('공개 순위에서 뺄 자동 플레이 판정 (T-11-024)', () => {
  const json = (o: object = {}) => JSON.stringify({ ...human, ms: 40_000, ...o });
  const idle = { clicks: 0, moves: 0 };

  it('사람 입력이 있는 시즌, 신호 없는 옛 시즌은 자동으로 보지 않는다', () => {
    expect(isAutomatedCareer([json(), json(), json()])).toBe(false);
    expect(isAutomatedCareer([null, null, null])).toBe(false);
    expect(isAutomatedCareer([json(idle), null, json()])).toBe(false); // 입력 없는 시즌 1개는 밀린 업로드일 수 있다
  });

  it('입력 없는 시즌 2개 이상·자동화 브라우저·스크립트 클릭·헤드리스는 자동으로 본다', () => {
    expect(isAutomatedCareer([json(idle), json(), json(idle)])).toBe(true);
    expect(isAutomatedCareer([json({ webdriver: true })])).toBe(true);
    expect(isAutomatedCareer([json({ headless: true })])).toBe(true);
    expect(isAutomatedCareer([json({ clicks: 1, synthetic: 30 })])).toBe(true);
  });

  it('간격이 일정하거나 커서 이동이 없는 것만으로는 빼지 않는다', () => {
    expect(
      isAutomatedCareer(Array.from({ length: 12 }, () => json({ clicks: 25, moves: 5 }))),
    ).toBe(false);
  });
});
