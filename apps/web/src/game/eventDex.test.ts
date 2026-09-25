import { describe, expect, it } from 'vitest';
import './index.js';
import { EVENTS } from './events-data.js';
import { eventDex, isHiddenEvent } from './eventDex.js';
import { createRng, getActiveRng, rnd, setActiveRng } from './rng.js';

describe('확률 도감', () => {
  it('모든 이벤트가 한 번씩 들어가고, 스토리·연쇄 이벤트는 가려진다', () => {
    const dex = eventDex();
    expect(dex.flatMap((e) => e.ids).sort()).toEqual(EVENTS.map((e) => e.id).sort());
    expect(EVENTS.filter(isHiddenEvent).every((e) => !!(e.story || e.chain))).toBe(true);
    expect(dex.find((e) => e.ids.includes('rival-2'))).toMatchObject({ group: 'story', story: { name: '평생의 라이벌', stage: 2 } });
    expect(dex.find((e) => e.ids.includes('fw-drought'))).toMatchObject({ group: 'position', pos: 'FW' });
  });

  it('선택지 확률 범위와 영향 요인을 식에서 뽑는다', () => {
    const talk = eventDex().find((e) => e.ids.includes('bench-talk'))!;
    // 출전 요구: clamp(0.4 + (OVR − 팀 전력)×0.05 + 신뢰×0.06 + (명성−60)/250, 0.08, 0.85)
    const demand = talk.choices[0]!;
    expect(demand.kind).toBe('odds');
    expect(demand.min).toBe(8);
    expect(demand.max).toBe(85);
    const f = Object.fromEntries(demand.factors.map((x) => [x.label, x.up]));
    expect(f['종합 능력치(OVR)']).toBe(true);
    expect(f['소속팀 전력']).toBe(false);
    expect(f['감독 신뢰']).toBe(true);

    // 고정 확률은 범위가 한 점이고 요인이 없다.
    const fixed = eventDex().flatMap((e) => e.choices).find((c) => c.label === '잠깐만 들른다')!;
    expect(fixed).toMatchObject({ min: 70, max: 70, factors: [] });
    // 특성으로만 갈리는 확률(강철 체력 80% / 그 외 50%).
    const tough = eventDex().flatMap((e) => e.choices).find((c) => c.label === '참고 다음 경기에 뛴다')!;
    expect(tough).toMatchObject({ min: 50, max: 80 });
    expect(tough.factors).toEqual([{ label: "특성 '강철 체력'", up: true }]);
  });

  it('게임 RNG 흐름을 건드리지 않는다', () => {
    const prev = getActiveRng();
    setActiveRng(createRng(7));
    const expected = (() => {
      const r = createRng(7);
      return [r.next(), r.next()];
    })();
    eventDex();
    expect([rnd(), rnd()]).toEqual(expected);
    setActiveRng(prev);
  });
});
