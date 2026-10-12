import { describe, expect, it } from 'vitest';
import {
  AVATAR_H,
  AVATAR_W,
  avatarPixels,
  avatarRects,
  avatarSpec,
  lookOf,
  primeAvatarSpec,
  retiredAvatarSpec,
} from './avatar.js';
import { MOTION_H, MOTION_IDS, MOTION_TOP, MOTIONS, motionFrames } from './avatar-motion.js';
import { CLUBS } from './data.js';
import { newGame } from './engine.js';
import { KIT_PATTERNS, kitOf } from './kits.js';
import { KIT_SPECS } from './kits-data.js';
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

describe('도트 아바타 (T-11-120)', () => {
  it('외형은 커리어 ID로 정해지고 게임 난수를 쓰지 않는다', () => {
    expect(lookOf('cid-1')).toEqual(lookOf('cid-1'));
    const s = player();
    const before = getActiveRng().getState();
    avatarRects(avatarPixels(avatarSpec(s)));
    expect(getActiveRng().getState()).toEqual(before);
  });

  it('격자는 24×32이고, 나이·부상·은퇴·입대에 따라 모습이 바뀐다', () => {
    const s = player();
    const px = avatarPixels(avatarSpec(s));
    expect([px.length, ...new Set(px.map((r) => r.length))]).toEqual([AVATAR_H, AVATAR_W]);
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
});

describe('도트 선수 모션 (T-11-191)', () => {
  it('모든 모션은 24×36 프레임이고, 대기 첫 프레임은 서 있는 모습을 4줄 내린 것과 같다', () => {
    const sp = avatarSpec(player());
    for (const id of MOTION_IDS) {
      const frames = motionFrames(sp, id);
      expect(frames).toHaveLength(MOTIONS[id].frames.length);
      for (const f of frames) {
        expect(f).toHaveLength(MOTION_H);
        for (const row of f) expect(row).toHaveLength(AVATAR_W);
      }
    }
    const still = avatarPixels(sp);
    expect(motionFrames(sp, 'idle')[0]!.slice(MOTION_TOP)).toEqual(still);
  });

  it('꾸미기(축구화 · 손목 밴드)가 움직이는 팔 · 다리에도 칠해진다', () => {
    const sp = { ...avatarSpec(player()), boots: 4, wrist: 4 };
    const colors = (id: (typeof MOTION_IDS)[number]) =>
      new Set(motionFrames(sp, id).flatMap((f) => f.flat()));
    for (const id of ['banzai', 'run', 'wave'] as const) {
      expect(colors(id)).toContain('#3f6fd8');
    }
  });
});
