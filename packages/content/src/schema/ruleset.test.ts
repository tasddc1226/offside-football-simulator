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

  it('rejects a league whose named teams leave no room for an unnamed rival opponent (D-77 회귀 방지)', () => {
    // buildLeagueRounds(schedule.ts)는 이름 있는 팀이 teamCount-1을 다 채우면 이름 없는
    // `${league.id}-opp-${n}` 상대를 하나도 만들지 않는다 — isRivalOpponent가 그 리그에서 영원히
    // false만 반환해 DERBY 챕터·TAG-DERBY-HERO 업적이 발동 불가능해진다(1.5.0 K1·K2 회귀).
    const ruleset = cloneRuleset();
    const league = ruleset.leagues.find((l) => l.id === 'league-tier3');
    if (!league) throw new Error('fixture missing league-tier3');
    const namedTeamCount = ruleset.teams.filter((t) => t.leagueId === league.id).length;
    league.teamCount = namedTeamCount + league.rivalOpponentIndex - 1;
    expect(() => RulesetSchema.parse(ruleset)).toThrowError(/이름 없는 라이벌 상대\(opp-1\)가 생기지 않아/);
  });

  it('allows a league with no room for an unnamed rival opponent when every team in it has rivalTeamId (PR #208 리뷰 후속 — 이름 있는 라이벌 쌍이 전 팀을 커버)', () => {
    const ruleset = cloneRuleset();
    const league = ruleset.leagues.find((l) => l.id === 'league-tier3');
    if (!league) throw new Error('fixture missing league-tier3');
    const teamsInLeague = ruleset.teams.filter((t) => t.leagueId === league.id) as Array<{
      id: string;
      rivalTeamId?: string;
    }>;
    if (teamsInLeague.length !== 4) throw new Error('fixture league-tier3 팀 수 가정이 깨졌다(4개 예상)');
    teamsInLeague[0]!.rivalTeamId = teamsInLeague[1]!.id;
    teamsInLeague[1]!.rivalTeamId = teamsInLeague[0]!.id;
    teamsInLeague[2]!.rivalTeamId = teamsInLeague[3]!.id;
    teamsInLeague[3]!.rivalTeamId = teamsInLeague[2]!.id;
    // 이름 없는 라이벌 슬롯(opp-1)이 하나도 남지 않게 teamCount를 줄인다 — rivalTeamId가 없었다면
    // 위 D-77 검증에 걸렸을 값이다.
    league.teamCount = teamsInLeague.length + league.rivalOpponentIndex - 1;
    expect(() => RulesetSchema.parse(ruleset)).not.toThrow();
  });

  it('rejects a team whose rivalTeamId points to itself', () => {
    const ruleset = cloneRuleset();
    const team = ruleset.teams[0] as { id: string; rivalTeamId?: string };
    team.rivalTeamId = team.id;
    expect(() => RulesetSchema.parse(ruleset)).toThrowError(/rivalTeamId가 자기 자신을 가리킨다/);
  });

  it('rejects a team whose rivalTeamId does not exist in teams', () => {
    const ruleset = cloneRuleset();
    const team = ruleset.teams[0] as { rivalTeamId?: string };
    team.rivalTeamId = 'not-a-real-team';
    expect(() => RulesetSchema.parse(ruleset)).toThrowError(/rivalTeamId가 teams에 없다/);
  });

  it('rejects a team whose rivalTeamId belongs to a different league', () => {
    const ruleset = cloneRuleset();
    const team = ruleset.teams.find((t) => t.leagueId === 'league-tier1') as
      | { leagueId: string; rivalTeamId?: string }
      | undefined;
    const otherLeagueTeam = ruleset.teams.find((t) => t.leagueId === 'league-tier2');
    if (!team || !otherLeagueTeam) throw new Error('fixture missing teams');
    team.rivalTeamId = otherLeagueTeam.id;
    expect(() => RulesetSchema.parse(ruleset)).toThrowError(/다른 리그 팀이다/);
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

  it('rejects a tacticalStyle whose preferredArchetypeIds for a position is empty', () => {
    const ruleset = cloneRuleset();
    const style = ruleset.tacticalStyles.find((s) => s.id === 'possession');
    if (!style) throw new Error('fixture missing possession style');
    (style.preferredArchetypeIds as Record<string, string[]>).W = [];
    expect(() => RulesetSchema.parse(ruleset)).toThrowError(/preferredArchetypeIds\.W는 1~2개여야 한다/);
  });

  it('rejects a tacticalStyle whose preferredArchetypeIds for a position covers all 3 archetypes', () => {
    const ruleset = cloneRuleset();
    const style = ruleset.tacticalStyles.find((s) => s.id === 'possession');
    if (!style) throw new Error('fixture missing possession style');
    const wArchetypeIds = ruleset.archetypes.filter((a) => a.position === 'W').map((a) => a.id);
    (style.preferredArchetypeIds as Record<string, string[]>).W = wArchetypeIds;
    expect(() => RulesetSchema.parse(ruleset)).toThrowError(/preferredArchetypeIds\.W는 1~2개여야 한다/);
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

  // T-4-001 D-49: 트랙 B 룰셋 섹션(injuryRules·managerRules·relationshipRules·reputationRules·nationalTeamRules).
  it('rejects an injuryRules.bodyParts entry whose sequelaKeys has a non-AttributeKey value', () => {
    const ruleset = cloneRuleset();
    const bodyPart = ruleset.injuryRules.bodyParts[0];
    if (!bodyPart) throw new Error('fixture missing injuryRules.bodyParts');
    (bodyPart as { sequelaKeys: string[] }).sequelaKeys = ['not-an-attribute-key'];
    expect(() => RulesetSchema.parse(ruleset)).toThrow();
  });

  it('rejects injuryRules.severityWeights that do not sum to 10000bp', () => {
    const ruleset = cloneRuleset();
    ruleset.injuryRules.severityWeights.MINOR += 1;
    expect(() => RulesetSchema.parse(ruleset)).toThrowError(/injuryRules\.severityWeights 합은 10000이어야 한다/);
  });

  it('rejects injuryRules.bodyParts whose weights do not sum to 100', () => {
    const ruleset = cloneRuleset();
    const bodyPart = ruleset.injuryRules.bodyParts[0];
    if (!bodyPart) throw new Error('fixture missing injuryRules.bodyParts');
    bodyPart.weight += 1;
    expect(() => RulesetSchema.parse(ruleset)).toThrowError(/injuryRules\.bodyParts weight 합은 100이어야 한다/);
  });

  it('rejects a recurrenceBaseBp out of the 0~10000 range', () => {
    const ruleset = cloneRuleset();
    const bodyPart = ruleset.injuryRules.bodyParts[0];
    if (!bodyPart) throw new Error('fixture missing injuryRules.bodyParts');
    (bodyPart as { recurrenceBaseBp: number }).recurrenceBaseBp = 10001;
    expect(() => RulesetSchema.parse(ruleset)).toThrow();
  });

  it('rejects duplicate managerRules.names', () => {
    const ruleset = cloneRuleset();
    const [first] = ruleset.managerRules.names;
    if (!first) throw new Error('fixture missing managerRules.names');
    ruleset.managerRules.names = [...ruleset.managerRules.names, first];
    expect(() => RulesetSchema.parse(ruleset)).toThrowError(/managerRules\.names에 중복된 이름이 있다/);
  });

  it('rejects managerRules.names that overlaps competitorNames', () => {
    const ruleset = cloneRuleset();
    const [competitorName] = ruleset.competitorNames;
    if (!competitorName) throw new Error('fixture missing competitorNames');
    ruleset.managerRules.names = [...ruleset.managerRules.names, competitorName];
    expect(() => RulesetSchema.parse(ruleset)).toThrowError(/managerRules\.names가 competitorNames와 겹친다/);
  });

  it('rejects nationalTeamRules.opponents when empty', () => {
    const ruleset = cloneRuleset();
    ruleset.nationalTeamRules.opponents = [];
    expect(() => RulesetSchema.parse(ruleset)).toThrow();
  });

  it('requires the strict national-team event ref, canonical outcome identities, and minRatingTenths additive fields', () => {
    const parsed = RulesetSchema.parse(ruleset100);
    expect(parsed.nationalTeamRules.event).toEqual({ id: 'EVT-NAT-001', version: 1 });
    expect(parsed.nationalTeamRules.outcomeByChoice).toEqual({
      A: { callUp: 'ACCEPT', id: 'A1', kind: 'FIXED', weight: 100 },
      B: { callUp: 'CONDITIONAL', id: 'B1', kind: 'FIXED', weight: 100 },
      C: { callUp: 'DECLINE', id: 'C1', kind: 'FIXED', weight: 100 },
    });
    expect(parsed.nationalTeamRules.minRatingTenths).toBe(70);

    const missingEvent = cloneRuleset();
    delete (missingEvent.nationalTeamRules as Record<string, unknown>).event;
    expect(() => RulesetSchema.parse(missingEvent)).toThrow();

    const missingOutcomeMap = cloneRuleset();
    delete (missingOutcomeMap.nationalTeamRules as Record<string, unknown>).outcomeByChoice;
    expect(() => RulesetSchema.parse(missingOutcomeMap)).toThrow();

    const extraOutcomeIdentityField = cloneRuleset();
    (extraOutcomeIdentityField.nationalTeamRules.outcomeByChoice.A as Record<string, unknown>).effects = [];
    expect(() => RulesetSchema.parse(extraOutcomeIdentityField)).toThrow();

    const extraField = cloneRuleset();
    (extraField.nationalTeamRules as Record<string, unknown>).naturalization = true;
    expect(() => RulesetSchema.parse(extraField)).toThrow();
  });

  // T-3-002 D-43/D-44: transferRules 정합성 4가지.
  describe('transferRules', () => {
    it('rejects a kindWeightsByRole whose TRANSFER+LOAN does not sum to 100', () => {
      const ruleset = cloneRuleset();
      ruleset.transferRules.kindWeightsByRole.STARTER.TRANSFER += 1;
      expect(() => RulesetSchema.parse(ruleset)).toThrowError(/TRANSFER\+LOAN 합은 100이어야 한다/);
    });

    it('rejects demandBands that are not ascending by maxIndexCenti', () => {
      const ruleset = cloneRuleset();
      const bands = ruleset.transferRules.demandBands;
      [bands[0]!.maxIndexCenti, bands[1]!.maxIndexCenti] = [bands[1]!.maxIndexCenti, bands[0]!.maxIndexCenti];
      expect(() => RulesetSchema.parse(ruleset)).toThrowError(/maxIndexCenti 오름차순이어야 한다/);
    });

    it('rejects feeByIndexBand whose last band is not maxIndexCenti 10000', () => {
      const ruleset = cloneRuleset();
      const bands = ruleset.transferRules.feeByIndexBand;
      bands[bands.length - 1]!.maxIndexCenti = 9999;
      expect(() => RulesetSchema.parse(ruleset)).toThrowError(/마지막 구간은 maxIndexCenti 10000이어야 한다/);
    });

    it('rejects a rivalPairs team id that does not exist in teams', () => {
      const ruleset = cloneRuleset();
      ruleset.transferRules.rivalPairs = [...ruleset.transferRules.rivalPairs, ['not-a-real-team', 'seorabeol-united']];
      expect(() => RulesetSchema.parse(ruleset)).toThrowError(/rivalPairs\[\d+\]의 팀이 teams에 없다/);
    });

    it('rejects relationshipCarry.newManagerTrustBase !== contractRules.newClubManagerTrust', () => {
      const ruleset = cloneRuleset();
      ruleset.transferRules.relationshipCarry.newManagerTrustBase += 1;
      expect(() => RulesetSchema.parse(ruleset)).toThrowError(/newManagerTrustBase\(\d+\)는 contractRules\.newClubManagerTrust\(\d+\)와 같아야 한다/);
    });
  });
});
