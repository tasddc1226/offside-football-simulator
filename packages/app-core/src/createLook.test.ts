import { describe, expect, it } from 'vitest';
import { LOOK_RECORDS } from '@offside/game/look-shop';
import { createLookRows, withCreateLook } from './createLook';
import { draftCid } from './state';

describe('선수 만들기 외형 고르기 (T-11-545)', () => {
  it('피부 · 머리색 · 머리 모양만, 기록 아이템 값은 빼고 보인다', () => {
    const rows = createLookRows({ hair: 3 });
    expect(rows.map((r) => r.item)).toEqual(['skin', 'hair', 'style']);
    expect(rows[0]!.options).toHaveLength(6);
    expect(rows[0]!.options.every((o) => o.swatch && o.label === null)).toBe(true);
    const gold = LOOK_RECORDS.find((r) => r.item === 'hair')!.value;
    expect(rows[1]!.options.map((o) => o.value)).not.toContain(gold);
    expect(rows[1]!.current).toBe(3);
    expect(rows[0]!.current).toBeNull();
    expect(rows[2]!.options.every((o) => o.label && o.swatch === null)).toBe(true);
  });

  it('고르면 더하고 기본으로 되돌리면 뺀다(원본은 그대로)', () => {
    const a = {};
    const b = withCreateLook(a, 'skin', 2);
    expect(b).toEqual({ skin: 2 });
    expect(a).toEqual({});
    expect(withCreateLook(b, 'skin', null)).toEqual({});
    expect(withCreateLook(b, 'hair', 99)).toEqual({ skin: 2 });
  });

  it('미리보기 ID는 한 번 정하면 그대로다', () => {
    const c: { cid?: string } = {};
    const id = draftCid(c);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(draftCid(c)).toBe(id);
  });
});
