import { describe, expect, it } from 'vitest';
import { rulesetProto } from './__fixtures__/career-01.js';
import { generateCompetitors } from './competitors.js';
import { seedRng } from './rng.js';

const RULESET = rulesetProto;
const rules = RULESET.selectionRules;

function team(id: string) {
  const found = RULESET.teams.find((t) => t.id === id);
  if (found === undefined) throw new Error(`fixture team ${id} not found`);
  return found;
}

describe('generateCompetitors — CMD-SIM-001(D-34)', () => {
  it('ruleset.positions × competitorRule.perPosition명을 생성한다', () => {
    const result = generateCompetitors(RULESET, team('seoul-tier1'), seedRng('gen-count'));
    expect(result.competitors.length).toBe(RULESET.positions.length * rules.competitorRule.perPosition);
  });

  it('포지션마다 perPosition명씩, id가 COMP-<position>-<n> 형식이다', () => {
    const result = generateCompetitors(RULESET, team('seoul-tier1'), seedRng('gen-ids'));
    for (const position of RULESET.positions) {
      const atPosition = result.competitors.filter((c) => c.position === position);
      expect(atPosition.length).toBe(rules.competitorRule.perPosition);
      atPosition.forEach((c, index) => expect(c.id).toBe(`COMP-${position}-${index + 1}`));
    }
  });

  it('이름은 competitorNames 풀에서 중복 없이 뽑는다', () => {
    const result = generateCompetitors(RULESET, team('seoul-tier1'), seedRng('gen-names'));
    const names = result.competitors.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(RULESET.competitorNames).toContain(name);
  });

  it('baseOvr는 squadStrength ± ovrSpread 범위 안이다', () => {
    for (const teamId of ['hangang-u18', 'seoul-tier1', 'busan-tier2', 'daejeon-tier3']) {
      const t = team(teamId);
      const result = generateCompetitors(RULESET, t, seedRng(`gen-ovr-${teamId}`));
      for (const c of result.competitors) {
        expect(c.baseOvr).toBeGreaterThanOrEqual(t.squadStrength - rules.competitorRule.ovrSpread);
        expect(c.baseOvr).toBeLessThanOrEqual(t.squadStrength + rules.competitorRule.ovrSpread);
      }
    }
  });

  it('managerTrust는 managerTrustBase ± managerTrustSpread 범위 안이다', () => {
    const result = generateCompetitors(RULESET, team('seoul-tier1'), seedRng('gen-trust'));
    const { managerTrustBase, managerTrustSpread } = rules.competitorRule;
    for (const c of result.competitors) {
      expect(c.managerTrust).toBeGreaterThanOrEqual(managerTrustBase - managerTrustSpread);
      expect(c.managerTrust).toBeLessThanOrEqual(managerTrustBase + managerTrustSpread);
    }
  });

  it('tacticalFit·squadStatus는 0~100 범위 안이다', () => {
    const result = generateCompetitors(RULESET, team('seoul-tier1'), seedRng('gen-fit'));
    for (const c of result.competitors) {
      expect(c.tacticalFit).toBeGreaterThanOrEqual(0);
      expect(c.tacticalFit).toBeLessThanOrEqual(100);
      expect(c.squadStatus).toBeGreaterThanOrEqual(0);
      expect(c.squadStatus).toBeLessThanOrEqual(100);
    }
  });

  it('RNG 소비 순서: 포지션 × perPosition명 × (아키타입 1 + 이름 1 + 속성 jitter 20 + managerTrust 1) = 23롤이다', () => {
    const before = seedRng('gen-rng-order');
    const result = generateCompetitors(RULESET, team('seoul-tier1'), before);
    const expectedRolls = RULESET.positions.length * rules.competitorRule.perPosition * 23;
    expect(result.rngState.draws - before.draws).toBe(expectedRolls);
  });

  it('같은 rngState로 다시 생성하면 완전히 같은 결과다(결정론)', () => {
    const rng = seedRng('gen-determinism');
    const first = generateCompetitors(RULESET, team('seoul-tier1'), rng);
    const second = generateCompetitors(RULESET, team('seoul-tier1'), rng);
    expect(second.competitors).toEqual(first.competitors);
    expect(second.rngState).toEqual(first.rngState);
  });

  it('시드가 다르면 결과(적어도 이름 뽑는 순서)가 달라진다', () => {
    const a = generateCompetitors(RULESET, team('seoul-tier1'), seedRng('gen-seed-a'));
    const b = generateCompetitors(RULESET, team('seoul-tier1'), seedRng('gen-seed-b'));
    expect(a.competitors.map((c) => c.name)).not.toEqual(b.competitors.map((c) => c.name));
  });
});
