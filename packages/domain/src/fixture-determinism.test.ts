import { describe, expect, it } from 'vitest';
import golden from './__fixtures__/career-01.golden.json';
import { careerFixture, runCareerFixture } from './__fixtures__/career-01.js';
import { verifySnapshot } from './simulate.js';

describe('career-01 fixture 결정론', () => {
  it('golden 값과 정확히 일치한다', () => {
    const snapshot = runCareerFixture();
    expect(snapshot.revision).toBe(golden.revision);
    expect(snapshot.stateHash).toBe(golden.stateHash);
    expect(snapshot.state.rngState.draws).toBe(golden.rngStateDraws);
    expect(verifySnapshot(snapshot)).toEqual({ ok: true });
  });

  it('같은 fixture를 1,000회 실행해도 매번 golden hash와 같다(5초 이내)', () => {
    const start = Date.now();
    for (let i = 0; i < 1000; i++) {
      const snapshot = runCareerFixture();
      expect(snapshot.stateHash).toBe(golden.stateHash);
    }
    const elapsedMs = Date.now() - start;
    expect(elapsedMs).toBeLessThan(5000);
  });

  it('seed 한 글자를 바꾸면 hash가 달라진다', () => {
    const mutated: typeof careerFixture = {
      ...careerFixture,
      createCareer: { ...careerFixture.createCareer, seed: `${careerFixture.createCareer.seed}x` },
    };
    const snapshot = runCareerFixture(mutated);
    expect(snapshot.stateHash).not.toBe(golden.stateHash);
  });

  it('명령 순서를 바꾸면 hash가 달라진다', () => {
    // ADVANCE는 RNG를 소비하지 않으므로 인접한 ADVANCE·RESOLVE_EVENT를 맞바꿔도
    // 우연히 같은 outcome이 선택되면 hash가 같을 수 있다. 두 RESOLVE_EVENT(EVT-P01, EVT-P02)의
    // 순서를 맞바꿔 서로 다른 weight 구간·effect가 서로 다른 roll을 받게 만든다.
    const commands = [...careerFixture.commands];
    const p01Index = commands.findIndex(
      (command) => command.type === 'RESOLVE_EVENT' && (command.payload as { eventId: string }).eventId === 'EVT-P01',
    );
    const p02Index = commands.findIndex(
      (command) => command.type === 'RESOLVE_EVENT' && (command.payload as { eventId: string }).eventId === 'EVT-P02',
    );
    const p01 = commands[p01Index] as (typeof commands)[number];
    const p02 = commands[p02Index] as (typeof commands)[number];
    commands[p01Index] = p02;
    commands[p02Index] = p01;

    const mutated: typeof careerFixture = { ...careerFixture, commands };
    const snapshot = runCareerFixture(mutated);
    expect(snapshot.stateHash).not.toBe(golden.stateHash);
  });

  it('golden snapshot의 state.attributes.shooting을 +1 하면 verifySnapshot이 실패한다', () => {
    const snapshot = runCareerFixture();
    const tampered = {
      ...snapshot,
      state: { ...snapshot.state, attributes: { ...snapshot.state.attributes, shooting: snapshot.state.attributes.shooting + 1 } },
    };
    expect(verifySnapshot(tampered)).toEqual({ ok: false, reason: 'STATE_HASH_MISMATCH' });
  });
});
