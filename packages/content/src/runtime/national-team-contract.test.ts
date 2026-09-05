import { describe, expect, it } from 'vitest';
import { loadContentPack } from '../packs/load-content-pack.ts';
import { loadRuleset } from '../rulesets/load-ruleset.ts';

const CHOICE_IDS = ['A', 'B', 'C'] as const;

describe('EVT-NAT-001과 nationalTeamRules canonical contract', () => {
  it.each(['0.1.0', '0.2.0'] as const)('%s pack choices match ruleset outcome identity and call-up mapping', (packVersion) => {
    const event = loadContentPack(packVersion).eventsById.get('EVT-NAT-001');
    const ruleset = loadRuleset('1.0.0');
    if (event === undefined) throw new Error(`${packVersion}에 EVT-NAT-001이 없다`);

    expect(event.version).toBe(1);
    expect(event.choices.map((choice) => choice.id)).toEqual(CHOICE_IDS);

    for (const choice of event.choices) {
      if (!(CHOICE_IDS as readonly string[]).includes(choice.id)) throw new Error(`알 수 없는 대표팀 choice: ${choice.id}`);
      const choiceId = choice.id as (typeof CHOICE_IDS)[number];
      const canonicalOutcome = ruleset.nationalTeamRules.outcomeByChoice[choiceId];
      expect(choice.callUp).toBe(canonicalOutcome.callUp);
      expect(choice.outcomes).toHaveLength(1);

      const outcome = choice.outcomes[0];
      if (outcome === undefined) throw new Error(`${packVersion} ${choice.id} outcome이 없다`);
      expect({ id: outcome.id, kind: outcome.kind, weight: outcome.weight }).toEqual(
        { id: canonicalOutcome.id, kind: canonicalOutcome.kind, weight: canonicalOutcome.weight },
      );
    }
  });
});

describe('CHP-NAT-001 대표팀 데뷔 preview contract', () => {
  it.each(['0.1.0', '0.2.0'] as const)('%s pack uses national/debut-neutral preview wording', (packVersion) => {
    const chapter = loadContentPack(packVersion).chaptersById.get('CHP-NAT-001');
    expect(chapter).toBeDefined();
    const previewLabels = chapter!.decisions.flatMap((decision) =>
      decision.options.map((option) => option.previewEffects.map((effect) => effect.label)),
    );
    expect(previewLabels).toEqual([
      ['대표팀 데뷔 맥락 유지'],
      ['대표팀 데뷔 맥락 유지'],
      ['대표팀 데뷔 맥락 유지'],
    ]);
  });
});
