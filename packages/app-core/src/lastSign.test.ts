import { describe, expect, it } from 'vitest';
import { inkPaths, packInk, parseLastSign } from './lastSign';

describe('마지막 계약서 사인 (T-11-412)', () => {
  it('손 사인은 정수로 줄이고 가까운 점은 버린다', () => {
    const mark = packInk(300.4, 149.6, [
      [
        { x: 10.2, y: 20.7 },
        { x: 10.9, y: 21.1 },
        { x: 20, y: 30 },
      ],
      [],
    ]);
    expect(mark).toEqual({ kind: 'ink', w: 300, h: 150, strokes: [[10, 21, 20, 30]] });
  });

  it('점은 모든 획을 합쳐 600개까지만 남긴다', () => {
    const line = Array.from({ length: 500 }, (_, i) => ({ x: i * 3, y: 0 }));
    const mark = packInk(300, 150, [line, line]);
    if (mark.kind !== 'ink') throw new Error('ink');
    expect(mark.strokes.reduce((n, s) => n + s.length / 2, 0)).toBe(600);
  });

  it('저장값을 읽고, 모양이 다르면 null', () => {
    const ok = {
      cid: 'c1',
      club: '한울대',
      mark: { kind: 'ink', w: 300, h: 150, strokes: [[1, 2, 3, 4]] },
    };
    expect(parseLastSign(JSON.stringify(ok))).toEqual(ok);
    expect(
      parseLastSign(
        JSON.stringify({ cid: 'c1', club: 'x', mark: { kind: 'name', name: '홍길동' } }),
      ),
    ).not.toBeNull();
    expect(parseLastSign(null)).toBeNull();
    expect(parseLastSign('{')).toBeNull();
    expect(
      parseLastSign(JSON.stringify({ ...ok, mark: { ...ok.mark, strokes: [[1, 2, 3]] } })),
    ).toBeNull();
    expect(parseLastSign(JSON.stringify({ ...ok, mark: { ...ok.mark, strokes: [] } }))).toBeNull();
    expect(parseLastSign(JSON.stringify({ ...ok, mark: { kind: 'name', name: '' } }))).toBeNull();
  });

  it('획마다 SVG 경로와 길이를 낸다', () => {
    const [a, b] = inkPaths({
      kind: 'ink',
      w: 300,
      h: 150,
      strokes: [
        [0, 0, 30, 40, 60, 80],
        [5, 5],
      ],
    });
    expect(a!.d).toBe('M0,0Q0,0 15,20Q30,40 60,80');
    expect(a!.len).toBe(100);
    expect(b!.d).toBe('M5,5l0.1,0');
  });
});
