import { describe, expect, it } from 'vitest';
import { rulesetProto } from './__fixtures__/career-01.js';
import { findMatchingOfferBranch, generateOffers } from './offers.js';
import { rollInt, seedRng } from './rng.js';
import type { OfferBranch } from './ruleset.js';

const RULESET = rulesetProto;

function branch(id: string): OfferBranch {
  const found = RULESET.offerRules.branches.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`no such branch: ${id}`);
  return found;
}

describe('findMatchingOfferBranch', () => {
  it('requireTags가 모두 있는 첫 분기를 고른다', () => {
    const found = findMatchingOfferBranch(RULESET.offerRules, ['진로_아카데미']);
    expect(found?.id).toBe('academy');
  });

  it('forbidTags가 하나라도 있으면 그 분기는 건너뛴다', () => {
    // lower-league는 입단테스트_완료를 요구하고, lower-league-skipped는 그것을 금지한다.
    const skipped = findMatchingOfferBranch(RULESET.offerRules, ['진로_하부리그']);
    expect(skipped?.id).toBe('lower-league-skipped');
    const completed = findMatchingOfferBranch(RULESET.offerRules, ['진로_하부리그', '입단테스트_완료']);
    expect(completed?.id).toBe('lower-league');
  });

  it('어떤 분기도 맞지 않으면 null이다', () => {
    expect(findMatchingOfferBranch(RULESET.offerRules, ['아무_상관없는_태그'])).toBeNull();
  });
});

describe('generateOffers — 개수 수식', () => {
  // tiers [1,2,3] 풀은 3팀이라 desiredCount가 3까지 그대로 반영된다(풀 부족으로 축소되지 않음).
  const noBonusBranch = branch('tryout-success');
  const baseTags = ['진로_입단테스트', '테스트_성공'];

  it('보너스 태그 0개면 1건', () => {
    const generated = generateOffers(RULESET, noBonusBranch, baseTags, 50, 1, seedRng('s0'));
    expect(generated.offers).toHaveLength(1);
  });

  it('보너스 태그 1개면 2건', () => {
    const generated = generateOffers(RULESET, noBonusBranch, [...baseTags, '에이전트_계약'], 50, 1, seedRng('s1'));
    expect(generated.offers).toHaveLength(2);
  });

  it('보너스 태그 2개면 3건(상한 maxOffers)', () => {
    const generated = generateOffers(
      RULESET,
      noBonusBranch,
      [...baseTags, '에이전트_계약', '주목받는_유망주'],
      50,
      1,
      seedRng('s2'),
    );
    expect(generated.offers).toHaveLength(3);
  });

  it('maxOffers보다 커지지 않는다(상한 클램프, 풀 부족과 무관하게)', () => {
    const cappedRuleset = { ...RULESET, offerRules: { ...RULESET.offerRules, maxOffers: 2 } };
    const generated = generateOffers(
      cappedRuleset,
      noBonusBranch,
      [...baseTags, '에이전트_계약', '주목받는_유망주'],
      50,
      1,
      seedRng('s3'),
    );
    // 풀은 3팀(tier1~3)이라 여유가 있지만 maxOffers=2로 클램프된다.
    expect(generated.offers).toHaveLength(2);
  });

  it('fixedCount가 있으면 태그와 무관하게 그 수로 고정된다', () => {
    const generated = generateOffers(
      RULESET,
      branch('tryout-fail'),
      ['진로_입단테스트', '테스트_실패', '에이전트_계약', '주목받는_유망주'],
      50,
      1,
      seedRng('s4'),
    );
    expect(generated.offers).toHaveLength(1);
  });
});

describe('generateOffers — 팀 풀', () => {
  it('비복원 추출: 같은 제안 세트 안에 같은 팀이 중복되지 않는다', () => {
    const generated = generateOffers(
      RULESET,
      branch('lower-league'),
      ['진로_하부리그', '입단테스트_완료', '에이전트_계약', '주목받는_유망주'],
      50,
      1,
      seedRng('pool-seed'),
    );
    const teamIds = generated.offers.map((offer) => offer.teamId);
    expect(new Set(teamIds).size).toBe(teamIds.length);
  });

  it('풀이 desiredCount보다 작으면 풀 크기만큼만 만든다', () => {
    // lower-league 풀은 busan-tier2·daejeon-tier3 2팀뿐이다. 보너스 2개로 desiredCount=3을 요청해도 2건.
    const generated = generateOffers(
      RULESET,
      branch('lower-league'),
      ['진로_하부리그', '입단테스트_완료', '에이전트_계약', '주목받는_유망주'],
      50,
      1,
      seedRng('shrink-seed'),
    );
    expect(generated.offers).toHaveLength(2);
  });

  it('fixedTeamId 분기는 풀 크기 1로 강제된다(academy)', () => {
    const generated = generateOffers(
      RULESET,
      branch('academy'),
      ['진로_아카데미', '에이전트_계약', '주목받는_유망주'],
      50,
      1,
      seedRng('academy-seed'),
    );
    expect(generated.offers).toHaveLength(1);
    expect(generated.offers[0]!.teamId).toBe('hangang-u18');
  });
});

describe('generateOffers — rng 소비 횟수', () => {
  it('고정 팀(fixedTeamId)은 제안 1건당 4회 소비한다', () => {
    const rng = seedRng('rng-fixed');
    const generated = generateOffers(RULESET, branch('academy'), ['진로_아카데미'], 50, 1, rng);
    expect(generated.offers).toHaveLength(1);
    expect(generated.rngState.draws).toBe(rng.draws + 4);
  });

  it('팀을 추출하는 분기는 제안 1건당 5회 소비한다', () => {
    const rng = seedRng('rng-extract');
    const generated = generateOffers(RULESET, branch('tryout-fail'), ['진로_입단테스트', '테스트_실패'], 50, 1, rng);
    expect(generated.offers).toHaveLength(1);
    expect(generated.rngState.draws).toBe(rng.draws + 5);
  });

  it('제안 2건이면 팀 추출 분기는 10회(5회×2) 소비한다', () => {
    const rng = seedRng('rng-extract-two');
    const generated = generateOffers(
      RULESET,
      branch('lower-league'),
      ['진로_하부리그', '입단테스트_완료', '에이전트_계약'],
      50,
      1,
      rng,
    );
    expect(generated.offers).toHaveLength(2);
    expect(generated.rngState.draws).toBe(rng.draws + 10);
  });
});

describe('generateOffers — 주급·계약금 ovrBand 경계', () => {
  // tryout-fail은 fixedCount 1, tiers [3]이라 daejeon-tier3(wageBandId 'tier3') 하나로 고정된다
  // (풀 크기 1이라 rollInt(state,1)이 항상 0을 돌려주므로 팀 선택이 결정적이다).
  const tier3Branch = branch('tryout-fail');
  const tags = ['진로_입단테스트', '테스트_실패'];

  it('baseOvr 54는 low band', () => {
    const generated = generateOffers(RULESET, tier3Branch, tags, 54, 1, seedRng('band-54'));
    expect(generated.offers[0]!.wageMinorPerWeek).toBe(RULESET.contractRules.wageBands.tier3!.low);
    expect(generated.offers[0]!.signingBonusMinor).toBe(RULESET.contractRules.signingBonus.tier3!.low);
  });

  it('baseOvr 55는 mid band', () => {
    const generated = generateOffers(RULESET, tier3Branch, tags, 55, 1, seedRng('band-55'));
    expect(generated.offers[0]!.wageMinorPerWeek).toBe(RULESET.contractRules.wageBands.tier3!.mid);
    expect(generated.offers[0]!.signingBonusMinor).toBe(RULESET.contractRules.signingBonus.tier3!.mid);
  });

  it('baseOvr 64는 여전히 mid band', () => {
    const generated = generateOffers(RULESET, tier3Branch, tags, 64, 1, seedRng('band-64'));
    expect(generated.offers[0]!.wageMinorPerWeek).toBe(RULESET.contractRules.wageBands.tier3!.mid);
  });

  it('baseOvr 65는 high band', () => {
    const generated = generateOffers(RULESET, tier3Branch, tags, 65, 1, seedRng('band-65'));
    expect(generated.offers[0]!.wageMinorPerWeek).toBe(RULESET.contractRules.wageBands.tier3!.high);
    expect(generated.offers[0]!.signingBonusMinor).toBe(RULESET.contractRules.signingBonus.tier3!.high);
  });
});

describe('generateOffers — topTierMinOvr 경계(59/60)', () => {
  const successBranch = branch('tryout-success'); // tiers [1,2,3], topTierMinOvr 60
  const tags = ['진로_입단테스트', '테스트_성공'];
  // tiers [1,2,3] 풀은 id 오름차순으로 [busan-tier2, daejeon-tier3, seoul-tier1]이다.
  const sortedPool = ['busan-tier2', 'daejeon-tier3', 'seoul-tier1'];

  it('baseOvr 60(경계 포함)이면 첫 제안은 항상 tier1 팀(seoul-tier1)에서만 뽑힌다', () => {
    for (const seed of ['top-a', 'top-b', 'top-c', 'top-d']) {
      const generated = generateOffers(RULESET, successBranch, tags, 60, 1, seedRng(seed));
      expect(generated.offers[0]!.teamId).toBe('seoul-tier1');
    }
  });

  it('baseOvr 59면 tier1 강제가 없다 — 전체 풀에서 roll 결과 그대로 뽑힌다', () => {
    const rng = seedRng('boundary-59-seed');
    const generated = generateOffers(RULESET, successBranch, tags, 59, 1, rng);
    const predicted = rollInt(rng, sortedPool.length);
    expect(generated.offers[0]!.teamId).toBe(sortedPool[predicted.value]);
  });
});
