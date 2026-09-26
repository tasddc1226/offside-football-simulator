import { describe, expect, it } from 'vitest';
import { EVENTS } from './events-data.js';
import './event-registry.js';

// T-10-046: EVENTS 순서가 곧 가중 추첨 순서(같은 시드의 결과)다. 순서를 바꾸는 변경은 이 스냅샷을 바꾼다 —
// 새 이벤트는 해당 목록 끝에 붙이고, 의도한 변경일 때만 `-u`로 갱신한다.
describe('이벤트 레지스트리 (T-10-046)', () => {
  it('id가 겹치지 않는다', () => {
    const ids = EVENTS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('등록 순서가 바뀌지 않는다', () => {
    expect(EVENTS.map((e) => e.id).join(' ')).toMatchSnapshot();
  });
});
