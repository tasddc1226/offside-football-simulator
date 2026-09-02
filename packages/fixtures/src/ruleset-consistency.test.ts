import { describe, expect, it } from 'vitest';
import { loadRuleset } from '@offside/content';
import { rulesetProto } from './index.js';

const ruleset100 = loadRuleset('1.0.0');

/**
 * 실제로 다른 순수 설명 문구 키만 적는다(2026-09-02 오케스트레이터 결정). archetype.summary와
 * background.blurb는 게임 규칙에 영향을 주지 않는 자유서술 문구라, 이 워커가 건드릴 수 없는
 * domain fixture(`packages/domain/src/__fixtures__/ruleset-proto.json`)와 content 1.0.0
 * 실데이터에서 문구만 다르게 다듬어졌다. name·id·roleWeights·template·수치·태그·startTeamId 등
 * 규칙에 영향을 주는 값은 이 목록에 없으며 전부 비교 대상이다.
 */
const PRESENTATION_KEYS = new Set(['summary', 'blurb']);

function stripPresentationKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripPresentationKeys);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !PRESENTATION_KEYS.has(key))
        .map(([key, v]) => [key, stripPresentationKeys(v)]),
    );
  }
  return value;
}

function findById(items: unknown, id: string, label: string): unknown {
  const found = (items as Array<{ id: string }>).find((item) => item.id === id);
  if (!found) throw new Error(`${label}에 id를 찾을 수 없음: ${id}`);
  return found;
}

const content = stripPresentationKeys(ruleset100) as typeof ruleset100;
const fixture = stripPresentationKeys(rulesetProto) as typeof rulesetProto;

describe('content 룰셋 1.0.0과 fixtures rulesetProto(최소 테스트 룰셋) 일치(설명 문구 제외)', () => {
  it('inside-forward 아키타입이 같다', () => {
    expect(findById(content.archetypes, 'inside-forward', 'content ruleset 1.0.0 archetypes')).toEqual(
      findById(fixture.archetypes, 'inside-forward', 'fixtures rulesetProto archetypes'),
    );
  });

  it.each(['club-academy', 'school', 'street'])('%s 배경이 같다', (id) => {
    expect(findById(content.backgrounds, id, 'content ruleset 1.0.0 backgrounds')).toEqual(
      findById(fixture.backgrounds, id, 'fixtures rulesetProto backgrounds'),
    );
  });

  it('hangang-u18 팀이 같다', () => {
    expect(findById(content.teams, 'hangang-u18', 'content ruleset 1.0.0 teams')).toEqual(
      findById(fixture.teams, 'hangang-u18', 'fixtures rulesetProto teams'),
    );
  });

  it('offerRules가 같다', () => {
    expect(content.offerRules).toEqual(fixture.offerRules);
  });

  it('contractRules가 같다', () => {
    expect(content.contractRules).toEqual(fixture.contractRules);
  });

  it('scoutRange가 같다', () => {
    expect(content.scoutRange).toEqual(fixture.scoutRange);
  });

  it('draftRules가 같다', () => {
    expect(content.draftRules).toEqual(fixture.draftRules);
  });
});
