import { describe, expect, it } from 'vitest';
import golden from './__fixtures__/career-05-chapter.golden.json';
import pendingGolden from './__fixtures__/career-05-chapter-pending.json';
import { runChapterFixture } from './__fixtures__/career-05-chapter.js';
import { verifySnapshot } from './simulate.js';

// T-2-004 D-38 golden 절차: CHAPTER 모드, 유스 첫 시즌 step 3에서 데뷔전 챕터(CHP-MATCH-001,
// MAJOR, 판단 2개)가 열려 판단 2개를 확정하고 시즌 결산까지 간다.
describe('career-05-chapter fixture 결정론(데뷔전 챕터)', () => {
  it('golden 값과 정확히 일치한다(revision·stateHash·rngStateDraws·age·seasonHistory)', () => {
    const { snapshot } = runChapterFixture();
    expect(snapshot.revision).toBe(golden.revision);
    expect(snapshot.stateHash).toBe(golden.stateHash);
    expect(snapshot.state.rngState.draws).toBe(golden.rngStateDraws);
    expect(snapshot.state.age).toBe(golden.age);
    expect(snapshot.state.season).toBeNull();
    expect(snapshot.state.pending).toBeNull();
    expect(snapshot.state.seasonHistory).toEqual(golden.seasonHistory);
    expect(verifySnapshot(snapshot)).toEqual({ ok: true });
  });

  it('SETTLE_SEASON 직전 경기 수·선수 시즌 통계·평균 평점·대회 기록이 golden과 같다', () => {
    const { beforeSettlement } = runChapterFixture();
    expect(beforeSettlement).toEqual(golden.beforeSettlement);
  });

  // 브리프: "데뷔전 판단 도중에 멈춘 pending 스냅샷"(career-05-chapter-pending.json)을 별도로 고정한다.
  it('판단 1(D1) 확정 직후에는 판단 2가 남아 pending CHAPTER가 유지된다', () => {
    const { pendingAfterFirstDecision } = runChapterFixture();
    expect(pendingAfterFirstDecision.revision).toBe(pendingGolden.revision);
    expect(pendingAfterFirstDecision.stateHash).toBe(pendingGolden.stateHash);
    expect(pendingAfterFirstDecision.rngStateDraws).toBe(pendingGolden.rngStateDraws);
    expect(pendingAfterFirstDecision.pending).toEqual(pendingGolden.pending);
    expect(pendingAfterFirstDecision.matchRatingTenths).toBe(pendingGolden.matchRatingTenths);
  });

  it('판단 2(마지막)까지 확정되면 season.chapters에 ChapterRecord 1건이 golden과 같이 남는다', () => {
    const { chapterRecord } = runChapterFixture();
    expect(chapterRecord).toEqual(golden.chapterRecord);
  });

  // 브리프 "재생 불변": 같은 명령 로그를 다시 돌려도 revision·stateHash·rngState.draws가 같다(roll을
  // 두 번 소비하지 않는다 — 매번 새 CareerState에서 처음부터 재생하므로 결정론이면 자동으로 보장된다).
  it('같은 fixture를 100회 실행해도 매번 golden hash·rngStateDraws와 같다', { timeout: 15000 }, () => {
    for (let i = 0; i < 100; i++) {
      const { snapshot } = runChapterFixture();
      expect(snapshot.stateHash).toBe(golden.stateHash);
      expect(snapshot.state.rngState.draws).toBe(golden.rngStateDraws);
    }
  });
});
