import { describe, expect, it } from 'vitest';
import career01 from './__fixtures__/career-01.golden.json';
import career02 from './__fixtures__/career-02-season.golden.json';
import career03 from './__fixtures__/career-03-underdog.golden.json';
import career04 from './__fixtures__/career-04-gk.golden.json';
import career05 from './__fixtures__/career-05-chapter.golden.json';
import career06 from './__fixtures__/career-06-settled.golden.json';
import career07 from './__fixtures__/career-07-df.golden.json';
import career08 from './__fixtures__/career-08-mf.golden.json';
import career09 from './__fixtures__/career-09-fw.golden.json';
import career10 from './__fixtures__/career-10-transfer.golden.json';
import career11 from './__fixtures__/career-11-loan.golden.json';

type GoldenDecision = { revision: number; rngStateDraws: number };

const expectedLegacyDecisions: Record<string, GoldenDecision[]> = {
  'career-01': [{ revision: 10, rngStateDraws: 30 }],
  'career-02-season': [
    { revision: 15, rngStateDraws: 404 },
    { revision: 25, rngStateDraws: 409 },
  ],
  'career-03-underdog': [{ revision: 11, rngStateDraws: 398 }],
  'career-04-gk': [{ revision: 16, rngStateDraws: 403 }],
  'career-05-chapter': [{ revision: 18, rngStateDraws: 406 }],
  'career-06-settled': [{ revision: 15, rngStateDraws: 404 }],
  'career-07-df': [{ revision: 16, rngStateDraws: 403 }],
  'career-08-mf': [{ revision: 15, rngStateDraws: 404 }],
  'career-09-fw': [{ revision: 15, rngStateDraws: 398 }],
  // career-10은 두 번째 결산의 정확한 7000 INTEREST 시장과 안전 잔류 응답을 fixture에 추가했다.
  // 시장의 비안전 제안 생성이 main stream 4회를 소비하고, OFR-23-0 수락 자체는 소비하지 않는다.
  'career-10-transfer': [{ revision: 25, rngStateDraws: 1146 }],
  'career-11-loan': [{ revision: 23, rngStateDraws: 1140 }],
};

const currentGoldens: Record<string, unknown> = {
  'career-01': career01,
  'career-02-season': career02,
  'career-03-underdog': career03,
  'career-04-gk': career04,
  'career-05-chapter': career05,
  'career-06-settled': career06,
  'career-07-df': career07,
  'career-08-mf': career08,
  'career-09-fw': career09,
  'career-10-transfer': career10,
  'career-11-loan': career11,
};

function decisionsOf(golden: unknown): GoldenDecision[] {
  const entries =
    golden !== null && typeof golden === 'object' && 'FAST' in golden && 'CHAPTER' in golden
      ? [(golden as { FAST: unknown }).FAST, (golden as { CHAPTER: unknown }).CHAPTER]
      : Array.isArray(golden)
        ? golden
        : [golden];
  return entries.map((entry) => {
    if (entry === null || typeof entry !== 'object') throw new Error('golden 형식이 객체가 아니다.');
    const record = entry as { revision?: unknown; rngStateDraws?: unknown };
    if (typeof record.revision !== 'number' || typeof record.rngStateDraws !== 'number') {
      throw new Error('golden에 revision/rngStateDraws가 없다.');
    }
    return { revision: record.revision, rngStateDraws: record.rngStateDraws };
  });
}

describe('legacy golden decision-stream invariants', () => {
  it('origin/main 기준 기존 모든 golden의 revision·decision rngState.draws를 보존한다', () => {
    for (const [name, expected] of Object.entries(expectedLegacyDecisions)) {
      expect(decisionsOf(currentGoldens[name]), name).toEqual(expected);
    }
  });
});
