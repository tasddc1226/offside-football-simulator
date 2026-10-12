import { describe, expect, it } from 'vitest';
import {
  AVATAR_H,
  AVATAR_PORTRAIT_H,
  avatarPortraitRects,
  cardAvatarSpec,
  AVATAR_W,
  avatarPixels,
  avatarRects,
  avatarSpec,
  lookOf,
  primeAvatarSpec,
  retiredAvatarSpec,
} from './avatar.js';
import {
  loadMotionPoses,
  MINI_POSES,
  MOTION_H,
  MOTION_IDS,
  MOTION_TOP,
  MOTION_W,
  MOTIONS,
  motionFrame,
  motionFrames,
} from './avatar-motion.js';
import { MINI_SPRITES } from './avatar-mini-data.js';
import { CLUBS } from './data.js';
import { newGame } from './engine.js';
import { KIT_PATTERNS, kitOf } from './kits.js';
import { KIT_SPECS } from './kits-data.js';
import { LOOK_STYLES } from './look.js';
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

  it('격자는 24×32를 2배로 다듬은 48×64이고, 나이·부상·은퇴·입대에 따라 모습이 바뀐다', () => {
    const s = player();
    const px = avatarPixels(avatarSpec(s));
    expect([px.length, ...new Set(px.map((r) => r.length))]).toEqual([AVATAR_H * 2, AVATAR_W * 2]);
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

describe('미니형 도트 선수 (T-11-191)', () => {
  it('머리 모양 9종 그림이 48×64이고, 모든 피부 · 머리색으로 칠해진다', () => {
    const base = avatarSpec(player());
    for (const hairStyle of LOOK_STYLES) {
      const rows = MINI_SPRITES[hairStyle];
      expect([rows.length, ...new Set(rows.map((r) => r.length))]).toEqual([
        AVATAR_H * 2,
        AVATAR_W * 2,
      ]);
      for (let skin = 0; skin < 6; skin++)
        for (let hair = 0; hair < 13; hair++) {
          const px = avatarPixels({ ...base, hairStyle, look: { ...base.look, skin, hair } });
          expect(px.flat().every((c) => c === null || HEX6.test(c))).toBe(true);
        }
    }
  });

  it('유니폼 무늬 · 표정 · 수염 · 꾸미기가 그림에 나온다', () => {
    const base = avatarSpec(player());
    const plain = { ...base.kit, body: '#1289a4', pc: '#e2ba52', sleeve: '#1289a4' };
    const renders = KIT_PATTERNS.map((pat) =>
      JSON.stringify(avatarPixels({ ...base, kit: { ...plain, pat } })),
    );
    expect(new Set(renders).size).toBe(KIT_PATTERNS.length);
    const fresh = JSON.stringify(avatarPixels(base));
    for (const o of [
      { expr: 'happy' },
      { expr: 'wink' },
      { expr: 'pain' },
      { beard: 'full' },
      { band: 2 },
      { glasses: 1 },
      { wrist: 3 },
    ] as const)
      expect(JSON.stringify(avatarPixels({ ...base, ...o }))).not.toBe(fresh);
  });
});

describe('도트 선수 모션 (T-11-191)', () => {
  it('모든 모션은 64×72 프레임이고, 대기 첫 프레임은 서 있는 모습을 가운데 아래에 놓은 것과 같다', async () => {
    const sp = avatarSpec(player());
    const poses = await loadMotionPoses(sp.hairStyle);
    for (const p of [null, poses])
      for (const id of MOTION_IDS) {
        const frames = motionFrames(sp, id, p);
        expect(frames).toHaveLength(MOTIONS[id].frames.length);
        for (const f of frames) {
          expect(f).toHaveLength(MOTION_H * 2);
          for (const row of f) expect(row).toHaveLength(MOTION_W * 2);
        }
      }
    const still = avatarPixels(sp);
    const idle = motionFrames(sp, 'idle', poses)[0]!;
    const x0 = MOTION_W - still[0]!.length / 2;
    expect(
      idle
        .slice(MOTION_TOP * 2, MOTION_TOP * 2 + still.length - 3)
        .map((r) => r.slice(x0, x0 + still[0]!.length)),
    ).toEqual(still.slice(0, -3));
  });

  it('머리 모양 9종 자세 그림이 모두 있고, 꾸미기(축구화)가 움직이는 자세에도 칠해진다', async () => {
    for (const hairStyle of LOOK_STYLES) {
      const poses = await loadMotionPoses(hairStyle);
      for (const k of MINI_POSES) {
        expect(poses[k].rows).toHaveLength(MOTION_H * 2);
        expect(poses[k].rows.every((r) => r.length === MOTION_W * 2)).toBe(true);
      }
      const sp = { ...avatarSpec(player()), hairStyle };
      for (const id of ['banzai', 'run', 'wave'] as const)
        expect(JSON.stringify(motionFrames({ ...sp, boots: 4 }, id, poses))).not.toBe(
          JSON.stringify(motionFrames(sp, id, poses)),
        );
    }
  });

  it('움직이는 자세에도 선택한 표정과 손목 밴드가 보이고, 난수와 저장본은 바꾸지 않는다', async () => {
    const s = player();
    const saved = structuredClone(s);
    const rng = getActiveRng().getState();
    for (const hairStyle of LOOK_STYLES) {
      const poses = await loadMotionPoses(hairStyle);
      const sp = { ...avatarSpec(s), hairStyle };
      const normal = motionFrame(sp, { ms: 100, pose: 'runL' }, poses);
      expect(motionFrame({ ...sp, expr: 'wink' }, { ms: 100, pose: 'runL' }, poses)).not.toEqual(
        normal,
      );
      for (const pose of MINI_POSES) {
        const band = motionFrame({ ...sp, wrist: 3 }, { ms: 100, pose }, poses);
        expect(
          band.flat().filter((c) => c === '#1c1c1f').length,
          `${hairStyle}/${pose}`,
        ).toBeGreaterThan(0);
      }
    }
    expect(s).toEqual(saved);
    expect(getActiveRng().getState()).toEqual(rng);
  });

  it('목발 · 은퇴식 소품은 모션에서도 보존하고, 다친 선수가 뛰거나 점프하지 않는다', async () => {
    const s = player();
    for (const sp of [avatarSpec({ ...s, injury: 3 }), retiredAvatarSpec(s.cid, 33)]) {
      const poses = await loadMotionPoses(sp.hairStyle);
      const idle = motionFrame(sp, { ms: 100 }, poses);
      const still = avatarPixels(sp);
      // 무대 그림자는 투명 칸 뒤에만 추가한다. 선수와 소품의 모든 불투명 픽셀은 그대로다.
      still.forEach((row, y) =>
        row.forEach((c, x) => {
          if (c) expect(idle[y + 8]![x + 8]).toBe(c);
        }),
      );
      for (const id of MOTION_IDS)
        for (const frame of motionFrames(sp, id, poses)) expect(frame).toEqual(idle);
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
      const rects = avatarPortraitRects(sp);
      expect(rects.length).toBeGreaterThan(100);
      expect(rects).toEqual(avatarRects(avatarPixels(sp)).filter((r) => r.y < AVATAR_PORTRAIT_H));
      expect(
        rects.every((r) => r.y + r.h <= AVATAR_PORTRAIT_H && r.x >= 0 && r.x + r.w <= AVATAR_W),
      ).toBe(true);
      expect(rects.some((r) => r.opacity !== undefined)).toBe(false);
    }
    expect(getActiveRng().getState()).toEqual(rng);
  });
});
