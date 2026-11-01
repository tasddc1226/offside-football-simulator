import { describe, expect, it } from 'vitest';
import { avatarImagePlan } from './avatar-image.js';
import {
  avatarSpec,
  createAvatarSpec,
  lookOf,
  primeAvatarSpec,
  retiredAvatarSpec,
} from './avatar.js';
import { newGame } from './engine.js';
import {
  LOOK_ITEMS,
  CREATE_LOOK_ITEMS,
  CREATE_LOOK_OPTIONS,
  createLookState,
  createLookValue,
  lookCode,
  lookOwned,
  parseLookCode,
  type CreateLook,
} from './look.js';
import {
  buyLookRecord,
  lookRecordCost,
  wearLookRecord,
  LOOK_RECORDS,
  buyLook,
  lookCost,
  setLook,
} from './look-shop.js';
import { createRng, setActiveRng } from './rng.js';
import type { GameState } from './types.js';

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

describe('선수 꾸미기 (T-11-191)', () => {
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

  it('기록 아이템은 칭호를 얻어야 사고, 항목을 산 것과 따로 산다', () => {
    const boots = LOOK_RECORDS.find((r) => r.id === 'scorer-boots')!;
    const s = player();
    expect(buyLook(s, 'boots', boots.value)).toBe(false);
    expect(buyLookRecord(s, boots)).toBe(false);
    s.titles = [{ id: 'topscorer', year: 2030 }];
    expect(lookRecordCost(s)).toBe(50_000);
    expect(buyLookRecord(s, boots)).toBe(true);
    expect(s.money).toBe(1e6 - 50_000);
    expect(s.look?.pick.boots).toBe(boots.value);
    expect(s.look?.owned).toEqual([]);
    expect(setLook(s, 'boots', boots.value)).toBe(false);
    expect(buyLookRecord(s, boots)).toBe(false);
    // 축구화 항목을 안 샀으면 벗을 때 기본 모습으로 돌아간다.
    expect(wearLookRecord(s, boots, false)).toBe(true);
    expect(s.look?.pick.boots).toBeUndefined();
    expect(wearLookRecord(s, boots, true)).toBe(true);
    expect(lookCode(s.look)).toBe(`b${boots.value}`);
    expect(parseLookCode(`b${boots.value}`).boots).toBe(boots.value);
    expect(avatarSpec(s).boots).toBe(boots.value);
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
    const pick = {
      skin: 1,
      hair: 2,
      beard: 1,
      style: 4,
      expr: 2,
      band: 3,
      wrist: 4,
      glasses: 2,
      boots: 5,
      socks: 6,
      gloves: 5,
      keeperKit: 4,
      kneePads: 3,
    };
    expect(lookCode({ owned: [], pick })).toBe('s1h2d1y4e2a3w4g2b5k6l5u4n3');
    expect(parseLookCode('s1h2d1y4e2a3w4g2b5k6l5u4n3')).toEqual(pick);
    // T-11-243 새 머리 모양은 뒤에 붙였다(옛 코드 값은 그대로다).
    expect(parseLookCode('y14')).toEqual({ style: 14 });
    expect(parseLookCode('y15')).toEqual({});
  });

  it('고른 모습이 그림에 들어가고, 은퇴 · 전성기 모습도 같은 꾸미기를 쓴다', () => {
    const s = player();
    const before = JSON.stringify(avatarImagePlan(avatarSpec(s)));
    buyLook(s, 'boots', 1);
    buyLook(s, 'glasses', 1);
    buyLook(s, 'beard', 0);
    const spec = avatarSpec(s);
    expect(spec).toMatchObject({ boots: 1, glasses: 1, beard: null });
    expect(JSON.stringify(avatarImagePlan(spec))).not.toBe(before);
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

describe('선수 만들기 외형 고르기 (T-11-545)', () => {
  const base = {
    name: 'a',
    number: 9,
    pos: 'FW',
    foot: '오른발',
    type: 'poacher',
    trait: 'late',
  } as const;
  const make = (extra: { look?: CreateLook; cid?: string }) => {
    setActiveRng(createRng(7));
    return newGame({ ...base, ...extra }, 7);
  };

  it('고르지 않으면 꾸미기 상태가 없고 예전과 같은 선수다', () => {
    const plain = make({});
    expect(plain.look).toBeUndefined();
    const picked = make({ look: { skin: 5 } });
    const strip = (g: GameState) => ({ ...g, cid: '', look: undefined });
    expect(strip(picked)).toEqual(strip(plain));
  });

  it('고른 항목은 산 것으로 치고 그림에 입혀진다', () => {
    const s = make({ look: { skin: 4, hair: 6, style: 6 } });
    expect(s.look).toEqual({
      owned: ['skin', 'hair', 'style'],
      pick: { skin: 4, hair: 6, style: 6 },
    });
    expect(lookOwned(s, 'hair')).toBe(true);
    expect(lookOwned(s, 'beard')).toBe(false);
    // 산 것으로 쳐서 가게가 다시 팔지 않고, 모양은 무료로 바꾼다.
    s.money = 1e6;
    expect(buyLook(s, 'hair', 2)).toBe(false);
    expect(setLook(s, 'hair', 2)).toBe(true);
    expect(s.money).toBe(1e6);
    const sp = avatarSpec(s);
    expect(sp.look.skin).toBe(4);
    expect(sp.hairStyle).toBe('afro');
    expect(lookCode(s.look)).toBe('s4h2y6');
  });

  it('선택지는 꾸미기 항목에서 기록 아이템 값만 뺀 것이다', () => {
    for (const k of CREATE_LOOK_ITEMS) {
      const plain = Array.from({ length: LOOK_ITEMS[k].options }, (_, v) => v).filter(
        (v) => !LOOK_RECORDS.some((r) => r.item === k && r.value === v),
      );
      expect(plain).toEqual(Array.from({ length: CREATE_LOOK_OPTIONS[k] }, (_, v) => v));
      for (const v of plain) expect(createLookValue(k, v)).toBe(true);
    }
  });

  it('기록 아이템 값 · 범위 밖 값은 버린다', () => {
    const gold = LOOK_RECORDS.find((r) => r.item === 'hair')!.value;
    expect(createLookState({ hair: gold })).toBeUndefined();
    expect(createLookState({ skin: 99, style: -1 })).toBeUndefined();
    expect(createLookState({ skin: 1.5, hair: 3 })).toEqual({ owned: ['hair'], pick: { hair: 3 } });
    expect(createLookState(undefined)).toBeUndefined();
  });

  it('미리보기에 쓴 커리어 ID로 만들면 미리보기와 같은 얼굴이다', () => {
    const cid = '0b6f3c1e-2a4d-4c8e-9f1a-7d2e5b3c4a10';
    const s = make({ cid, look: { hair: 7 } });
    expect(s.cid).toBe(cid);
    const pre = createAvatarSpec(cid, { hair: 7 });
    expect(pre.look).toEqual(avatarSpec(s).look);
    expect(pre.look.skin).toBe(lookOf(cid).skin);
    // 모양이 틀린 ID는 쓰지 않는다.
    expect(make({ cid: 'nope' }).cid).toMatch(/^[0-9a-f-]{36}$/);
  });
});
