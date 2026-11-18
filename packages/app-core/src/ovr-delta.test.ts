import { expect, test } from 'vitest';
import { nextOvrShown, ovrDeltaText } from './ovr-delta';

test('처음 열거나 다른 커리어로 바꾸면 변화로 알리지 않는다', () => {
  const a = nextOvrShown(null, 'c1', 70, false);
  expect(a).toEqual({ cid: 'c1', n: 70, delta: 0, seq: 0 });
  expect(nextOvrShown(a, 'c2', 82, false)).toEqual({ cid: 'c2', n: 82, delta: 0, seq: 0 });
});

test('값이 그대로면 같은 객체를 돌려준다', () => {
  const a = nextOvrShown(null, 'c1', 70, false);
  expect(nextOvrShown(a, 'c1', 70, false)).toBe(a);
});

test('시트가 덮는 동안 쌓인 변화는 닫힐 때 한 번에 알린다', () => {
  let v = nextOvrShown(null, 'c1', 70, false);
  v = nextOvrShown(v, 'c1', 71, true);
  v = nextOvrShown(v, 'c1', 73, true);
  expect(v).toMatchObject({ n: 70, seq: 0 });
  v = nextOvrShown(v, 'c1', 73, false);
  expect(v).toEqual({ cid: 'c1', n: 73, delta: 3, seq: 1 });
});

test('내린 변화와 같은 폭의 연속 변화', () => {
  let v = nextOvrShown(null, 'c1', 80, false);
  v = nextOvrShown(v, 'c1', 79, false);
  expect(v).toMatchObject({ n: 79, delta: -1, seq: 1 });
  v = nextOvrShown(v, 'c1', 78, false);
  expect(v).toMatchObject({ n: 78, delta: -1, seq: 2 });
  // 덮인 동안 올랐다가 제자리로 오면 알리지 않는다.
  const back = nextOvrShown(nextOvrShown(v, 'c1', 79, true), 'c1', 78, false);
  expect(back).toBe(v);
});

test('변화 폭 글자', () => {
  expect(ovrDeltaText(2)).toBe('+2');
  expect(ovrDeltaText(-1)).toBe('−1');
});
