import { describe, expect, it } from 'vitest';
import { avatarPixels, avatarSpec, lookOf, primeAvatarSpec, retiredAvatarSpec } from './avatar.js';
import { newGame } from './engine.js';
import {
  LOOK_ITEMS,
  buyLook,
  lookCode,
  lookCost,
  lookOwned,
  parseLookCode,
  setLook,
} from './look.js';
import { createRng, setActiveRng } from './rng.js';

const player = (money = 1e6, salary: number | null = 100_000) => {
  setActiveRng(createRng(7));
  const s = newGame(
    { name: 'a', number: 9, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' },
    7,
  );
  s.money = money;
  s.age = 25;
  s.contract = salary == null ? null : { years: 2, salary };
  return s;
};

describe('도트 선수 꾸미기 (T-11-191)', () => {
  it('가격은 max(최소, 연봉 × 비율) — 연봉이 없으면 최소 값', () => {
    expect(lookCost(player(), 'skin')).toBe(15_000);
    expect(lookCost(player(), 'glasses')).toBe(60_000);
    expect(lookCost(player(1e6, null), 'style')).toBe(LOOK_ITEMS.style.min);
  });

  it('한 번 사면 자금이 줄고, 그 뒤 모양 바꾸기는 무료다', () => {
    const s = player();
    expect(buyLook(s, 'hair', 5)).toBe(true);
    expect(s.money).toBe(1e6 - 15_000);
    expect(lookOwned(s, 'hair')).toBe(true);
    expect(buyLook(s, 'hair', 1)).toBe(false);
    expect(setLook(s, 'hair', 2)).toBe(true);
    expect(s.money).toBe(1e6 - 15_000);
    expect(s.look?.pick.hair).toBe(2);
  });

  it('자금이 모자라거나 없는 선택지 · 사지 않은 항목은 바꾸지 않는다', () => {
    const poor = player(100);
    expect(buyLook(poor, 'skin', 1)).toBe(false);
    expect(poor.look).toBeUndefined();
    const s = player();
    expect(buyLook(s, 'skin', 99)).toBe(false);
    expect(setLook(s, 'band', 1)).toBe(false);
  });

  it('은퇴하면 사거나 바꿀 수 없다', () => {
    const s = player();
    buyLook(s, 'band', 2);
    s.retired = true;
    expect(buyLook(s, 'boots', 1)).toBe(false);
    expect(setLook(s, 'band', 3)).toBe(false);
    expect(s.look?.pick.band).toBe(2);
  });

  it('서버 코드로 줄였다 되살린다 — 모르는 글자 · 범위 밖 값은 버린다', () => {
    const s = player();
    buyLook(s, 'skin', 3);
    buyLook(s, 'style', 4);
    buyLook(s, 'glasses', 2);
    expect(lookCode(s.look)).toBe('s3y4g2');
    expect(parseLookCode('s3y4g2')).toEqual({ skin: 3, style: 4, glasses: 2 });
    expect(parseLookCode('s9z1h7')).toEqual({ hair: 7 });
    expect(lookCode(undefined)).toBeUndefined();
  });

  it('고른 모습이 그림에 들어가고, 은퇴 · 전성기 모습도 같은 꾸미기를 쓴다', () => {
    const s = player();
    const before = avatarPixels(avatarSpec(s));
    buyLook(s, 'boots', 1);
    buyLook(s, 'glasses', 1);
    buyLook(s, 'beard', 0);
    const spec = avatarSpec(s);
    expect(spec).toMatchObject({ boots: 1, glasses: 1, beard: null });
    expect(avatarPixels(spec)).not.toEqual(before);
    const code = lookCode(s.look);
    expect(retiredAvatarSpec(s.cid, 36, code)).toMatchObject({ glasses: 1, beard: null });
    expect(primeAvatarSpec({ id: s.cid, lastClub: '', look: code })).toMatchObject({ boots: 1 });
    // 꾸미기가 없으면 예전과 같은 모습(커리어 ID 얼굴).
    expect(primeAvatarSpec({ id: s.cid, lastClub: '' }).look).toEqual(lookOf(s.cid));
  });

  it('군 복무 중에는 고른 머리 모양 대신 까까머리', () => {
    const s = player();
    buyLook(s, 'style', 2);
    s.mil.serving = true;
    expect(avatarSpec(s).hairStyle).toBe('buzz');
  });
});
