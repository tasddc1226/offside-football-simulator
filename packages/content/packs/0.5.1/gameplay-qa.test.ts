import { describe, expect, it } from 'vitest';
import { loadContentPack } from '../../src/packs/load-content-pack.ts';
import { selectEligibleEvents } from '../../src/runtime/select-eligible-events.ts';
import { buildTestState, TEST_DRAFT, TEST_PROFILE } from '../../src/runtime/build-test-state.ts';

// 이슈 #104: 골키퍼에게 윙어 전용 서사(EVT-REL-001·EVT-CON-001)가 노출되던 문제. 팩은 불변
// 아티팩트(ADR-004)라 0.5.0을 고치지 않고 0.5.1에서 포지션 조건만 더한다(서사 문구는 그대로).
describe('packs/0.5.1 게임성 QA', () => {
  const previous = loadContentPack('0.5.0');
  const pack = loadContentPack('0.5.1');
  const POSITION_GATED = ['EVT-REL-001', 'EVT-CON-001'];

  it('0.5.0 전체를 품고 포지션 조건이 붙은 두 이벤트만 다르다', () => {
    expect(pack.manifest.contentPackVersion).toBe('0.5.1');
    expect(pack.manifest.compatibleRulesetVersions).toEqual(['1.3.0', '1.4.0']);
    expect(pack.events.map((event) => event.id).sort()).toEqual(
      previous.events.map((event) => event.id).sort(),
    );
    for (const event of previous.events) {
      const next = pack.eventsById.get(event.id);
      if (POSITION_GATED.includes(event.id)) {
        expect({ ...next, triggers: undefined }, event.id).toEqual({
          ...event,
          triggers: undefined,
        });
        expect(JSON.stringify(next?.triggers), event.id).toContain('player.primaryPosition');
      } else {
        expect(next, event.id).toEqual(event);
      }
    }
    for (const chapter of previous.chapters) {
      expect(pack.chaptersById.get(chapter.id), chapter.id).toEqual(chapter);
    }
  });

  it('EVT-REL-001은 W에게는 열리고 GK에게는 열리지 않는다', () => {
    const at = (position: 'W' | 'GK', archetypeId: string) =>
      selectEligibleEvents(
        pack,
        buildTestState({
          currentStep: 4,
          player: {
            draft: { ...TEST_DRAFT, position, archetypeId },
            profile: {
              ...TEST_PROFILE,
              preferredPosition: position,
              primaryPosition: position,
              archetypeId,
            },
          },
        }),
      ).map((event) => event.eventId);

    expect(at('W', 'inside-forward')).toContain('EVT-REL-001');
    expect(at('GK', 'gk-shot-stopper')).not.toContain('EVT-REL-001');
  });
});
