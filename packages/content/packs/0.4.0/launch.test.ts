import { describe, expect, it } from 'vitest';
import { simulate } from '@offside/domain';
import { loadContentPack } from '../../src/packs/load-content-pack.ts';
import { loadRuleset } from '../../src/rulesets/load-ruleset.ts';
import { selectEligibleEvents } from '../../src/runtime/select-eligible-events.ts';
import { EventDefinitionSchema } from '../../src/schema/event.ts';

describe('packs/0.4.0 19세 시작 계약', () => {
  const pack = loadContentPack('0.4.0');
  const ruleset = loadRuleset('1.2.0');
  const path = pack.eventsById.get('EVT-CON-002');

  it('실물 registry와 호환 버전·체크섬을 고정한다', () => {
    expect(pack.manifest.contentPackVersion).toBe('0.4.0');
    expect(pack.manifest.compatibleRulesetVersions).toEqual(['1.2.0']);
    expect(pack.manifest.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(ruleset.version).toBe('1.2.0');
    expect(ruleset.initialAge).toBe(19);
  });

  it('첫 계약 전에는 PATH만 eligible이다', () => {
    const created = simulate({ snapshot: null, command: { type: 'CREATE_CAREER', commandId: 'create', expectedRevision: 0, payload: { careerId: 'path-fixture', seed: 'path-fixture', simulationMode: 'CHAPTER', rulesetVersion: '1.2.0', contentPackVersion: '0.4.0' } }, ruleset, rulesetVersion: '1.2.0', contentPackVersion: '0.4.0' });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const state = { ...created.snapshot.state, status: 'ACTIVE' as const, seasonPhase: 'SETTLEMENT' as const, currentStep: 12 };
    expect(selectEligibleEvents(pack, state).map((event) => event.eventId)).toEqual(['EVT-CON-002']);
  });

  it('A/B/C 세 분기 정의가 서로 다른 진로 태그와 후속을 유지한다', () => {
    const parsed = EventDefinitionSchema.parse(path);
    expect(parsed.minAge).toBe(19);
    expect(parsed.maxAge).toBe(19);
    expect(parsed.choices).toHaveLength(3);
    expect(parsed.choices.map((choice) => choice.outcomes[0]?.addTags)).toEqual([
      ['진로_입단테스트'],
      ['늦은_출발', '진로_아카데미'],
      ['밑바닥부터', '진로_하부리그'],
    ]);
    expect(parsed.choices[0]?.outcomes[0]?.followUps?.[0]?.eventId).toBe('EVT-CON-003');
    expect(parsed.choices[2]?.outcomes[0]?.followUps?.[0]?.eventId).toBe('EVT-CON-003');
  });
});
