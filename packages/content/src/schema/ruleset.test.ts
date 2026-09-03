import { describe, expect, it } from 'vitest';
import { ATTRIBUTE_KEYS as DOMAIN_ATTRIBUTE_KEYS } from '@offside/domain';
import { ATTRIBUTE_KEYS, RulesetSchema } from './ruleset.ts';
import ruleset100 from '../../rulesets/1.0.0/ruleset.json' with { type: 'json' };

function cloneRuleset(): typeof ruleset100 {
  return JSON.parse(JSON.stringify(ruleset100)) as typeof ruleset100;
}

describe('ATTRIBUTE_KEYS', () => {
  it('is a runtime clone that matches @offside/domain exactly (devDependency, test-time only)', () => {
    expect(ATTRIBUTE_KEYS).toEqual(DOMAIN_ATTRIBUTE_KEYS);
  });
});

describe('RulesetSchema', () => {
  it('parses ruleset 1.0.0 without errors', () => {
    expect(() => RulesetSchema.parse(ruleset100)).not.toThrow();
  });

  it('rejects an archetype whose roleWeights do not sum to 1', () => {
    const ruleset = cloneRuleset();
    const archetype = ruleset.archetypes.find((a) => a.id === 'inside-forward');
    if (!archetype) throw new Error('fixture missing inside-forward');
    const weights = archetype.roleWeights as Record<string, number>;
    weights.shooting = (weights.shooting ?? 0) + 0.05;
    expect(() => RulesetSchema.parse(ruleset)).toThrowError(/roleWeights의 합/);
  });

  it('rejects a ruleset where a position does not have exactly 3 archetypes', () => {
    const ruleset = cloneRuleset();
    ruleset.archetypes = ruleset.archetypes.filter((a) => a.id !== 'inside-forward');
    expect(() => RulesetSchema.parse(ruleset)).toThrowError(/아키타입 수는 3이어야 한다/);
  });

  it('rejects a background with an unknown startTeamId', () => {
    const ruleset = cloneRuleset();
    const background = ruleset.backgrounds.find((b) => b.id === 'club-academy');
    if (!background) throw new Error('fixture missing club-academy');
    background.startTeamId = 'not-a-real-team';
    expect(() => RulesetSchema.parse(ruleset)).toThrowError(/startTeamId가 teams에 없다/);
  });

  it('rejects a team referencing an unknown wageBandId', () => {
    const ruleset = cloneRuleset();
    const team = ruleset.teams[0];
    if (!team) throw new Error('fixture missing teams');
    (team as { wageBandId: string }).wageBandId = 'tier-nonexistent';
    // wageBandId는 contractRules.wageBands의 고정 4키(tier1/tier2/tier3/youth) enum이라
    // 참조 무결성이 타입 자체로 보장된다. 존재하지 않는 값은 즉시 스키마 오류가 된다.
    expect(() => RulesetSchema.parse(ruleset)).toThrowError(/wageBandId/);
  });

  it('rejects an archetype whose template value is out of range', () => {
    const ruleset = cloneRuleset();
    const archetype = ruleset.archetypes.find((a) => a.id === 'inside-forward');
    if (!archetype) throw new Error('fixture missing inside-forward');
    archetype.template.shooting = 90;
    expect(() => RulesetSchema.parse(ruleset)).toThrowError(/30~72/);
  });

  it('rejects a GK archetype whose own goalkeeping template value is out of the 30~72 range', () => {
    const ruleset = cloneRuleset();
    const archetype = ruleset.archetypes.find((a) => a.id === 'gk-shot-stopper');
    if (!archetype) throw new Error('fixture missing gk-shot-stopper');
    archetype.template.goalkeeping = 90;
    expect(() => RulesetSchema.parse(ruleset)).toThrowError(/30~72/);
  });

  it('rejects a non-GK archetype with a goalkeeping roleWeight', () => {
    const ruleset = cloneRuleset();
    const archetype = ruleset.archetypes.find((a) => a.id === 'inside-forward');
    if (!archetype) throw new Error('fixture missing inside-forward');
    const weights = archetype.roleWeights as Record<string, number>;
    weights.goalkeeping = 0.05;
    for (const k of Object.keys(weights)) {
      if (k !== 'goalkeeping') weights[k] = (weights[k] ?? 0) * 0.95;
    }
    expect(() => RulesetSchema.parse(ruleset)).toThrowError(/goalkeeping을 가질 수 없다/);
  });

  it('rejects nationalities whose first entry is not KR', () => {
    const ruleset = cloneRuleset();
    ruleset.nationalities = [...ruleset.nationalities].reverse();
    expect(() => RulesetSchema.parse(ruleset)).toThrowError(/국적 첫 항목은 KR/);
  });

  it("inside-forward archetype matches the prototype's Base OVR weights and template", () => {
    const parsed = RulesetSchema.parse(ruleset100);
    const insideForward = parsed.archetypes.find((a) => a.id === 'inside-forward');
    expect(insideForward?.position).toBe('W');
    expect(insideForward?.roleWeights).toEqual({
      shooting: 0.2,
      passing: 0.14,
      crossing: 0.06,
      dribbling: 0.14,
      firstTouch: 0.11,
      acceleration: 0.06,
      pace: 0.04,
      agility: 0.03,
      stamina: 0.02,
      positioning: 0.09,
      composure: 0.05,
      decisions: 0.04,
      concentration: 0.02,
    });
    expect(insideForward?.template).toEqual({
      shooting: 60,
      passing: 54,
      dribbling: 66,
      tackling: 30,
      firstTouch: 62,
      crossing: 45,
      goalkeeping: 10,
      pace: 68,
      acceleration: 70,
      agility: 64,
      jumping: 50,
      stamina: 55,
      strength: 42,
      durability: 60,
      decisions: 52,
      concentration: 48,
      composure: 52,
      positioning: 60,
      leadership: 35,
      consistency: 45,
    });
  });

  it('club-academy background matches the phase-1 plan D-5 initial values exactly (golden)', () => {
    const parsed = RulesetSchema.parse(ruleset100);
    const clubAcademy = parsed.backgrounds.find((b) => b.id === 'club-academy');
    expect(clubAcademy?.attributeDeltas).toEqual({});
    expect(clubAcademy?.state).toEqual({ form: 50, fitness: 80, morale: 60 });
    expect(clubAcademy?.context).toEqual({ tacticalFit: 58, squadStatus: 40, positionProficiency: 100 });
    expect(clubAcademy?.relationships).toEqual({ managerTrust: 40, captain: 50, rival: 50, fans: 50, agent: 50 });
  });

  it('nationalities lists KR first', () => {
    const parsed = RulesetSchema.parse(ruleset100);
    expect(parsed.nationalities[0]).toEqual({ code: 'KR', name: '대한민국' });
  });

  // T-2-002 D-34: 브리프 인수 조건 "룰셋 검증: 정원 합 ≠ 11, roleWeights 합 ≠ 1, 존재하지 않는
  // tacticalStyleId·leagueId, 이름 중복 — 각각 로더에서 거부된다"를 각각 확인한다.
  it('rejects a tacticalStyle whose slots do not sum to 11', () => {
    const ruleset = cloneRuleset();
    const style = ruleset.tacticalStyles.find((s) => s.id === 'possession');
    if (!style) throw new Error('fixture missing possession style');
    style.slots.ST += 1;
    expect(() => RulesetSchema.parse(ruleset)).toThrowError(/slots 합은 11이어야 한다/);
  });

  it('rejects a tacticalStyle whose roleWeights for a position do not sum to 1', () => {
    const ruleset = cloneRuleset();
    const style = ruleset.tacticalStyles.find((s) => s.id === 'possession');
    if (!style) throw new Error('fixture missing possession style');
    const weights = style.roleWeights.W as Record<string, number>;
    const [firstKey] = Object.keys(weights);
    if (!firstKey) throw new Error('fixture missing W roleWeights');
    weights[firstKey] = (weights[firstKey] ?? 0) + 0.1;
    expect(() => RulesetSchema.parse(ruleset)).toThrowError(/roleWeights의 합은 1/);
  });

  it('rejects a team referencing an unknown tacticalStyleId', () => {
    const ruleset = cloneRuleset();
    const team = ruleset.teams[0];
    if (!team) throw new Error('fixture missing teams');
    (team as { tacticalStyleId: string }).tacticalStyleId = 'not-a-real-style';
    expect(() => RulesetSchema.parse(ruleset)).toThrowError(/tacticalStyleId가 tacticalStyles에 없다/);
  });

  it('rejects a team referencing an unknown leagueId', () => {
    const ruleset = cloneRuleset();
    const team = ruleset.teams[0];
    if (!team) throw new Error('fixture missing teams');
    (team as { leagueId: string }).leagueId = 'not-a-real-league';
    expect(() => RulesetSchema.parse(ruleset)).toThrowError(/leagueId가 leagues에 없다/);
  });

  it('rejects duplicate competitorNames', () => {
    const ruleset = cloneRuleset();
    const [first] = ruleset.competitorNames;
    if (!first) throw new Error('fixture missing competitorNames');
    ruleset.competitorNames = [...ruleset.competitorNames, first];
    expect(() => RulesetSchema.parse(ruleset)).toThrowError(/competitorNames에 중복된 이름이 있다/);
  });
});
