import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { legendScore } from './legend.js';
import type { GameState } from './types.js';
import { playCareer } from './__fixtures__/play-career.js';

// T-10-044: 결정성 골든 테스트 — 리팩터링의 안전망. 고정 시드로 커리어를 은퇴까지 돌려 최종 상태의 해시를
// 스냅샷으로 고정한다. 동작을 보존하는 리팩터링(파일 분할·함수 추출·타입 정리)은 이 스냅샷을 바꾸면 안 된다.
// 스냅샷이 바뀌면 RNG 소비 순서나 게임 결과가 달라졌다는 뜻이다 — 의도한 밸런스 변경일 때만 `-u`로 갱신한다.
// 커리어 진행은 __fixtures__/play-career.ts.

const CAREERS = 32;

/** cid(crypto.randomUUID)만 비우고 최종 상태 전체를 해시한다 — 세이브에 남는 모든 필드가 비교 대상이다. */
function stateHash(s: GameState): string {
  return createHash('sha256')
    .update(JSON.stringify({ ...s, cid: '' }))
    .digest('hex')
    .slice(0, 16);
}

describe('결정성 골든 (T-10-044)', () => {
  it(`고정 시드 커리어 ${CAREERS}개의 최종 상태가 바뀌지 않는다`, () => {
    const rows = Array.from({ length: CAREERS }, (_, i) => {
      const s = playCareer(i);
      const pro = s.career.filter((r) => r.pro);
      const goals = pro.reduce((n, r) => n + r.goals, 0);
      return `${i} ${s.pos} age${s.age} peak${s.peak} seasons${s.career.length} g${goals} caps${s.nat.caps} score${legendScore(s)} titles${s.titles?.length ?? 0} ${stateHash(s)}`;
    });
    expect(rows).toMatchSnapshot();
  });
});
