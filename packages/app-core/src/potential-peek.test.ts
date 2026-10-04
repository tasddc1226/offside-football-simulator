import { describe, expect, it } from 'vitest';
import type { GameState } from '@offside/game/types';
import { PEEK_LOCKED, parsePeek, peekOf, peekOpen, peekView } from './potential-peek.js';

const st = (o: { seasons?: number; pot?: number; rescout?: number; year?: number } = {}) =>
  ({
    cid: 'c1',
    year: o.year ?? 2027,
    pot: o.pot ?? 86,
    bloom: 3,
    career: Array.from({ length: o.seasons ?? 1 }, () => ({})),
    flags: { rescout: o.rescout },
  }) as unknown as GameState;

describe('T-11-079 잠재력 엿보기', () => {
  it('첫 시즌을 마치기 전에는 열 수 없다(리세 방지)', () => {
    const s = st({ seasons: 0 });
    expect(peekView(s, peekOf(s), true)).toEqual({ kind: 'locked', text: PEEK_LOCKED });
  });

  it('광고 제거 구매 여부로 버튼 문구만 바뀐다', () => {
    const s = st();
    expect(peekView(s, null, false)).toMatchObject({
      kind: 'available',
      button: '광고 보고 이번 시즌 평가 보기',
    });
    expect(peekView(s, null, true)).toMatchObject({
      kind: 'available',
      button: '이번 시즌 평가 보기',
    });
  });

  it('연 시즌에는 화면용 스카우트 평가를 보여 주고 재평가 전에는 범위다', () => {
    const s = st({ pot: 86 });
    // 재평가 전 오차 ±4 → 82(B)~90(S). 숨은 bloom은 넣지 않는다.
    expect(peekView(s, peekOf(s), false)).toEqual({
      kind: 'shown',
      grade: 'B~S',
      text: 'B~S등급 · 2027 시즌 스카우트 평가',
    });
    expect(peekView(st({ pot: 86, rescout: 2 }), peekOf(s), false)).toMatchObject({ grade: 'A' });
  });

  it('다음 시즌이나 다른 커리어에서는 다시 닫힌다', () => {
    const s = st();
    const peek = peekOf(s);
    expect(peekOpen(st({ year: 2028 }), peek)).toBe(false);
    expect(peekOpen({ ...s, cid: 'c2' }, peek)).toBe(false);
    expect(peekOpen(s, peek)).toBe(true);
  });

  it('기기에 남은 값이 깨졌으면 없는 것으로 읽는다', () => {
    expect(parsePeek(JSON.stringify({ cid: 'c1', year: 2027 }))).toEqual({ cid: 'c1', year: 2027 });
    for (const raw of [null, '', '{', '{"cid":1,"year":2027}', '{"cid":"c1","year":"2027"}'])
      expect(parsePeek(raw)).toBeNull();
  });
});
