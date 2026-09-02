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
    expect(snapshot.state.player.profile?.baseOvr).toBe(golden.baseOvr);
    expect(snapshot.state.attributes).toEqual(golden.attributes);
    expect(snapshot.state.player.profile?.scoutedPotentialMin).toBe(golden.scoutedPotential.min);
    expect(snapshot.state.player.profile?.scoutedPotentialMax).toBe(golden.scoutedPotential.max);
    expect(snapshot.state.contract).toEqual({
      id: golden.contract.id,
      offerId: 'OFR-9-0',
      teamId: golden.contract.teamId,
      teamName: '서울 유나이티드',
      leagueTier: golden.contract.leagueTier,
      lengthSeasons: golden.contract.lengthSeasons,
      wageMinorPerWeek: 1200000,
      signingBonusMinor: 30000000,
      rolePromise: golden.contract.rolePromise,
      shirtNumber: 13,
      signatureType: 'AUTO',
      signedAtRevision: golden.revision,
    });
    expect(snapshot.state.pending).toBeNull();
    expect(verifySnapshot(snapshot)).toEqual({ ok: true });
  });

  it('계약 직전 pending.offers 개수가 golden offersCount와 같다', () => {
    const truncated: typeof careerFixture = { ...careerFixture, commands: careerFixture.commands.slice(0, -1) };
    const snapshot = runCareerFixture(truncated);
    expect(snapshot.state.pending?.kind).toBe('OFFERS');
    expect(snapshot.state.pending?.kind === 'OFFERS' ? snapshot.state.pending.offers.length : -1).toBe(
      golden.offersCount,
    );
  });

  // 시간 예산 검사는 hash 일치 검사와 별도 테스트로 나눈다(2026-09-02, 워크스페이스 전체 병렬
  // 실행 시 부하로 5초 예산을 넘긴 적이 있다. 단독 실행은 1초 미만이었다). 예산은 10초.
  it('같은 fixture를 1,000회 실행해도 매번 golden hash와 같다(10초 이내)', { timeout: 15000 }, () => {
    const start = Date.now();
    for (let i = 0; i < 1000; i++) {
      const snapshot = runCareerFixture();
      expect(snapshot.stateHash).toBe(golden.stateHash);
    }
    const elapsedMs = Date.now() - start;
    expect(elapsedMs).toBeLessThan(10000);
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
    // UPDATE_PLAYER_DRAFT 두 개는 서로 다른 필드를 채우므로 순서를 바꿔도 최종 draft는
    // 같아진다. 대신 두 RESOLVE_EVENT(EVT-CON-002, EVT-CON-003)의 ADVANCE·RESOLVE_EVENT 쌍을
    // 통째로 맞바꿔 서로 다른 outcome 확률·effect가 다른 roll을 받게 만든다.
    const commands = [...careerFixture.commands];
    const con002Start = commands.findIndex(
      (command) => command.type === 'ADVANCE' && (command.payload as { eligibleEvents: Array<{ eventId: string }> }).eligibleEvents[0]?.eventId === 'EVT-CON-002',
    );
    const con003Start = commands.findIndex(
      (command) => command.type === 'ADVANCE' && (command.payload as { eligibleEvents: Array<{ eventId: string }> }).eligibleEvents[0]?.eventId === 'EVT-CON-003',
    );
    const block002 = commands.slice(con002Start, con002Start + 2);
    const block003 = commands.slice(con003Start, con003Start + 2);
    const reordered = [...commands.slice(0, con002Start), ...block003, ...block002];

    const mutated: typeof careerFixture = { ...careerFixture, commands: reordered };
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
