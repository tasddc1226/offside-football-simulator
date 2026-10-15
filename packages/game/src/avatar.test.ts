import { describe, expect, it } from 'vitest';
import { avatarImagePlan } from './avatar-image.js';
import {
  cardAvatarSpec,
  avatarSpec,
  lookOf,
  primeAvatarSpec,
  retiredAvatarSpec,
} from './avatar.js';
import { CLUBS } from './data.js';
import { newGame } from './engine.js';
import { KIT_PATTERNS, kitOf } from './kits.js';
import { KIT_SPECS } from './kits-data.js';
import { LOOK_ITEMS, LOOK_ORDER, LOOK_STYLES, lookCode } from './look.js';
import { SANGMU } from './military.js';
import { createRng, getActiveRng, setActiveRng } from './rng.js';

const HEX6 = /^#[0-9a-f]{6}$/i;
const player = () => {
  setActiveRng(createRng(7));
  return newGame(
    { name: 'a', number: 9, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' },
    7,
  );
};

describe('구단 유니폼 (T-11-120)', () => {
  it('정의는 있는 구단만 가리키고, 모든 구단(상무 포함)이 6자리 색 홈·원정 유니폼을 갖는다', () => {
    const ids = new Set([...CLUBS.map((c) => c.id), SANGMU.id]);
    expect(Object.keys(KIT_SPECS).filter((id) => !ids.has(id))).toEqual([]);
    for (const c of [...CLUBS, SANGMU])
      for (const side of ['home', 'away'] as const) {
        const k = kitOf(c, side);
        expect(KIT_PATTERNS).toContain(k.pat);
        for (const v of [k.body, k.pc, k.sleeve, k.collar, k.shorts, k.socks, k.cuff])
          expect([c.id, side, v]).toEqual([c.id, side, expect.stringMatching(HEX6)]);
      }
  });
});

describe('선수 모습 (T-11-120)', () => {
  it('외형은 커리어 ID로 정해지고 게임 난수를 쓰지 않는다', () => {
    expect(lookOf('cid-1')).toEqual(lookOf('cid-1'));
    const s = player();
    const before = getActiveRng().getState();
    avatarImagePlan(avatarSpec(s));
    expect(getActiveRng().getState()).toEqual(before);
  });

  it('나이·부상·은퇴·입대에 따라 모습이 바뀐다', () => {
    const s = player();
    expect(avatarSpec(s).hairStyle).toBe('fringe');
    expect(avatarSpec({ ...s, age: 29 }).beard).toBe('full');
    expect(avatarSpec({ ...s, injury: 3 }).acc).toContain('crutch');
    expect(avatarSpec({ ...s, retired: true }).acc).toEqual(['suit', 'bouquet']);
    // 은퇴 기록(커리어 ID·은퇴 나이)만으로 그린 모습은 은퇴 직후 세이브로 그린 모습과 같다.
    expect(retiredAvatarSpec(s.cid, 33)).toEqual(avatarSpec({ ...s, age: 33, retired: true }));
    // 명예의 전당 시상대: 같은 얼굴에 마지막 구단 홈 유니폼(흰머리 없는 전성기).
    const prime = primeAvatarSpec({
      id: s.cid,
      lastClub: CLUBS[0]!.name,
      lastClubId: CLUBS[0]!.id,
    });
    expect([prime.look, prime.kit, prime.gray]).toEqual([lookOf(s.cid), kitOf(CLUBS[0]!), 0]);
    const army = avatarSpec({ ...s, mil: { ...s.mil, serving: true, type: 'army' } });
    expect(army.hairStyle).toBe('buzz');
  });
  it('은퇴 상세 화면은 꾸미기와 상관없이 정장이고, 다른 화면은 꾸민 모습이다', () => {
    const s = player();
    // 모든 꾸미기 항목을 고른 코드(옷 · 축구화 · 양말 포함).
    const pick = Object.fromEntries(LOOK_ORDER.map((k) => [k, LOOK_ITEMS[k].options - 1]));
    const code = lookCode({ owned: [...LOOK_ORDER], pick });
    const suit = retiredAvatarSpec(s.cid, 40, code);
    expect(suit.acc).toEqual(['suit', 'bouquet']);
    expect(avatarImagePlan(suit).layers.map((l) => l.layer)).toContain('suit');
    for (const sp of [
      primeAvatarSpec({
        id: s.cid,
        lastClub: CLUBS[0]!.name,
        lastClubId: CLUBS[0]!.id,
        look: code,
      }),
      cardAvatarSpec({ careerId: s.cid, look: code }),
    ]) {
      expect(sp.acc).not.toContain('suit');
      expect(sp.hairStyle).toBe(suit.hairStyle);
      expect(sp.look).toEqual(suit.look);
      expect(avatarImagePlan(sp).layers.map((l) => l.layer)).not.toContain('suit');
    }
  });
});

describe('선수 카드 초상', () => {
  it('옛 선수는 커리어 ID로 얼굴을 정하고 꾸미기는 저장된 코드대로 입힌다', () => {
    const s = player();
    expect(cardAvatarSpec({ careerId: s.cid }).look).toEqual(lookOf(s.cid));
    const sp = cardAvatarSpec({ careerId: s.cid, look: 's5h6y2b2e2a3g2' });
    expect(sp.look.skin).toBe(5);
    expect(sp.look.hair).toBe(6);
    expect(sp.hairStyle).toBe(LOOK_STYLES[2]);
    expect(sp.gray).toBe(0);
    expect(sp.acc).toEqual([]);
  });

  it('모든 머리 모양의 얼굴과 어깨를 같은 크기로 자르고 RNG를 건드리지 않는다', () => {
    const s = player();
    const rng = getActiveRng().getState();
    for (let style = 0; style < LOOK_STYLES.length; style++) {
      const sp = cardAvatarSpec({ careerId: s.cid, look: `y${style}` });
      const plan = avatarImagePlan(sp, true);
      expect(plan.layers.length).toBeGreaterThan(0);
      // 완전 민머리(bald)는 맨몸 머리 그대로다.
      if (LOOK_STYLES[style] !== 'bald')
        expect(plan.layers.map((l) => l.layer)).toContain(`hair-${LOOK_STYLES[style]}`);
      expect(plan).toEqual(
        avatarImagePlan(cardAvatarSpec({ careerId: s.cid, look: `y${style}` }), true),
      );
    }
    expect(getActiveRng().getState()).toEqual(rng);
  });
});
