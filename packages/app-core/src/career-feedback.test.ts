import { describe, expect, it } from 'vitest';
import * as g from '@offside/game/index';
import { createRng, getActiveRng, setActiveRng } from '@offside/game/rng';
import { spreadAttr } from '@offside/game/attributes';
import type { GameState, MarketResult, OfferOption } from '@offside/game/types';
import { careerGoals, coachFeedback, marketFeedback, offerFeedback } from './career-feedback.js';

const fresh = (seed = 11): GameState => {
  setActiveRng(createRng(seed));
  return g.newGame(
    { name: 'T', number: 9, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' },
    seed,
  );
};
const offer: OfferOption = {
  kind: 'offer',
  clubId: 'test',
  name: 'T',
  leagueId: 'k2',
  str: 60,
  years: 2,
  salary: 5000,
  fee: 0,
  role: '벤치 경쟁',
};
const market: MarketResult = { options: [offer], note: '', canRetire: false };

describe('코치 메모', () => {
  it('시즌 시작 수치와 소수 단위 능력치 변화를 설명한다', () => {
    const s = fresh();
    spreadAttr(s, 'sho', 0.4);
    expect(coachFeedback(s).summary).toContain('슈팅 +0.4');
    expect(coachFeedback(s).summary).toContain('이번 시즌 OVR');
  });
  it('변화가 없으면 요약만 두고 고정 안내 줄은 붙이지 않는다', () => {
    const c = coachFeedback(fresh());
    expect(c.summary).toContain('아직 표시할 능력치 변화가 없어요.');
    expect(c.notes).toEqual([]);
  });
  it('시즌 시작 기록이 없는 옛 세이브를 현재 수치로 추정하지 않는다', () => {
    const s = fresh();
    s.seasonStartSub = {};
    expect(coachFeedback(s).summary).toContain('시작 능력치 기록이 없어요');
  });
  it('컨디션과 사기의 효과를 구분한다', () => {
    const s = fresh();
    s.cond = 20;
    s.morale = 20;
    const text = coachFeedback(s).notes.join(' ');
    expect(text).toContain('부상 위험');
    expect(text).toContain('사기가 낮으면');
    expect(text).not.toContain('컨디션이 낮으면 성장이');
  });
  it('치우친 훈련의 감속을 공개 능력치로만 설명한다', () => {
    const s = fresh();
    s.attrs.sho = 98;
    expect(coachFeedback(s).notes.join(' ')).toContain('슈팅이 다른 핵심 능력치보다 앞서');
  });
  it('부상과 군 복무를 일반 훈련 정체로 오인하지 않는다', () => {
    const s = fresh();
    s.injury = 5;
    expect(coachFeedback(s).notes.join(' ')).toContain('5경기 결장');
    s.mil.serving = true;
    expect(coachFeedback(s).notes).toEqual([
      '군 복무 중이에요. 복무를 마치면 구단에서의 훈련과 출전을 다시 준비해요.',
    ]);
  });
  it('숨은 잠재력·보너스·재평가가 달라도 안내가 같다', () => {
    const a = fresh();
    const b = structuredClone(a);
    b.pot = 96;
    b.bloom = 10;
    b.flags.potBonus = 20;
    b.flags.rescout = 2;
    expect(coachFeedback(b)).toEqual(coachFeedback(a));
    expect(marketFeedback(b, market)).toBe(marketFeedback(a, market));
    expect(careerGoals(b)).toEqual(careerGoals(a));
  });
});

describe('제의 설명과 기록 목표', () => {
  it('현재 공개 기록과 일반 평가 요소를 설명하고 제의를 보장하지 않는다', () => {
    const s = fresh();
    s.fame = 140;
    expect(marketFeedback(s, market)).toContain('인기 140');
    expect(marketFeedback(s, market)).toContain('보장하지는 않아요');
    expect(offerFeedback(s, offer)).toContain('팀 전력 60');
    expect(offerFeedback(s, offer)).toContain('벤치 경쟁');
  });
  it('스카우트 플래그 소모 뒤 제의별 원인을 추측하지 않는다', () => {
    const s = fresh();
    s.flags.scouted = true;
    const before = marketFeedback(s, market);
    s.flags.scouted = false;
    expect(marketFeedback(s, market)).toBe(before);
  });
  it('복무·강제 은퇴·대학 잔류만 있을 때 구단 제의 설명을 만들지 않는다', () => {
    const s = fresh();
    s.mil.serving = true;
    expect(marketFeedback(s, market)).toBeUndefined();
    s.mil.serving = false;
    expect(marketFeedback(s, { ...market, options: [] })).toBeUndefined();
    const uni = { kind: 'uni', name: '대학 진학', desc: '' } as const;
    expect(marketFeedback(s, { ...market, options: [uni] })).toBeUndefined();
    expect(offerFeedback(s, uni)).toBeUndefined();
  });
  it('아마추어 구단에는 단년 시즌으로 달성하기 어려운 구단 장기 목표를 표시하지 않는다', () => {
    expect(careerGoals(fresh()).some((x) => x.key === 'club-apps')).toBe(false);
  });
  it('현재 구단의 기록은 이름이 같아도 ID가 다르면 합치지 않는다', () => {
    const s = fresh();
    g.endSeason(s);
    s.leagueId = 'k2';
    s.career[0]!.apps = 20;
    s.career[0]!.clubId = 'another';
    s.career[0]!.club = s.club.name;
    expect(careerGoals(s).find((x) => x.key === 'club-apps')!.have).toBe(0);
    s.career[0]!.clubId = s.club.id;
    expect(careerGoals(s).find((x) => x.key === 'club-apps')!.have).toBe(20);
  });
  it('현재 구단 기록의 옛 이름 호환과 군 복무 제외, 다음 목표 구간을 유지한다', () => {
    const s = fresh();
    g.endSeason(s);
    s.leagueId = 'k2';
    const row = s.career[0]!;
    delete row.clubId;
    row.club = s.club.name;
    row.apps = 50;
    expect(careerGoals(s).find((x) => x.key === 'club-apps')).toMatchObject({
      have: 50,
      target: 100,
      remaining: 50,
    });
    row.mil = true;
    expect(careerGoals(s).find((x) => x.key === 'club-apps')!.have).toBe(0);
  });
  it('골키퍼도 대표팀·우승·출전 목표를 볼 수 있고 은퇴 뒤에는 새 목표가 없다', () => {
    const s = fresh();
    s.pos = 'GK';
    s.leagueId = 'k2';
    expect(careerGoals(s).map((x) => x.key)).toEqual(
      expect.arrayContaining(['apps', 'caps', 'trophy', 'club-apps']),
    );
    s.retired = true;
    expect(careerGoals(s)).toEqual([]);
  });
});

/** 안내를 매 구간·시장에 반복 렌더링한 경우와 렌더링하지 않은 경우의 실제 커리어·RNG를 비교한다. */
function play(seed: number, show: boolean): GameState {
  const s = fresh(seed);
  while (!s.retired && s.age < 32) {
    for (let ph = 0; ph <= g.LAST_PHASE; ph++) {
      if (show)
        for (let render = 0; render < 3; render++) {
          coachFeedback(s);
          careerGoals(s);
        }
      s.training = s.cond < 45 ? 'rest' : 'dri';
      const { ev } = g.playPhase(s);
      if (ev) g.resolveChoice(s, ev, 0);
    }
    g.endSeason(s);
    const m = g.market(s);
    if (show)
      for (let render = 0; render < 3; render++) {
        marketFeedback(s, m);
        for (const o of m.options) offerFeedback(s, o);
      }
    if (!m.options.length) break;
    g.acceptOption(s, m.options[0]!, m.options);
  }
  return { ...s, cid: '' };
}

describe('밸런스·저장·RNG 보존', () => {
  it.each([11, 21, 33, 42, 99, 61003])('시드 %i: 반복 렌더링 후에도 커리어 전체가 같다', (seed) => {
    expect(play(seed, true)).toEqual(play(seed, false));
  });
  it('세 상태 모델은 입력을 수정하지 않는다', () => {
    const s = fresh();
    const before = JSON.stringify(s);
    const rng = getActiveRng().getState();
    coachFeedback(s);
    marketFeedback(s, market);
    offerFeedback(s, offer);
    careerGoals(s);
    expect(JSON.stringify(s)).toBe(before);
    expect(getActiveRng().getState()).toEqual(rng);
  });
});
