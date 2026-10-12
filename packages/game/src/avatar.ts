// ───────── 도트 선수 아바타 (T-11-120 · T-11-191 미니형) ─────────
// 2026-10-12 승인한 미니형 그림(48×64 재질 글자 지도, avatar-mini-data.ts)을 모습대로 칠해(avatar-mini.ts) 색 격자 → 사각형 목록으로 만들고
// 웹(<svg><rect>)과 앱(react-native-svg Rect)이 같이 그린다. 외형(피부·머리)은 커리어 ID 해시로 정해 게임 RNG를 절대 쓰지 않고,
// 세이브에도 저장하지 않는다. 수염·흰머리·목발·정장 같은 건 나이와 상태에서 그때그때 정한다. 이 파일이 색표의 정본이다.
import { mix } from './color.js';
import { MINI_SPRITES } from './avatar-mini-data.js';
import { paintMini, type MiniColors } from './avatar-mini.js';
import type { Club } from './data.js';
import { hashStr } from './hash.js';
import { kitColorAt, kitOf, type KitSide, type KitSpec } from './kits.js';
import { LOOK_BEARDS, LOOK_EXPRS, LOOK_STYLES, parseLookCode } from './look.js';
import type { GameState, LookState } from './types.js';

export const AVATAR_W = 24;
export const AVATAR_H = 32;

const AVATAR_SKINS = [
  { s: '#f7d3b3', S: '#dcaa84' },
  { s: '#e6b088', S: '#c4875e' },
  { s: '#c58858', S: '#9a623b' },
  { s: '#86553a', S: '#643c26' },
  // T-11-191 꾸미기 전용.
  { s: '#fde6d2', S: '#e8c2a4' },
  { s: '#5e3a28', S: '#432819' },
] as const;
const AVATAR_HAIRS = [
  { h: '#2b2522', H: '#16110f' },
  { h: '#6e4428', H: '#4a2c19' },
  { h: '#e0b54e', H: '#b0832b' },
  { h: '#b04a2b', H: '#7c2f19' },
  { h: '#ebe5d6', H: '#bdb5a3' },
  // T-11-191 꾸미기 전용(기본 모습에는 나오지 않는다 — lookOf는 HAIR_PICK만 고른다).
  { h: '#3f6fd8', H: '#2a4c9c' },
  { h: '#e06aa5', H: '#a84478' },
  { h: '#4aa865', H: '#2f7442' },
  { h: '#b9c0c8', H: '#868d96' },
  { h: '#8a55c9', H: '#5f3790' },
  { h: '#e8823a', H: '#b05a20' },
  { h: '#7cc6ec', H: '#4f97bf' },
  // T-11-191 기록 아이템(look.ts LOOK_RECORDS): 발롱도르 금빛 머리.
  { h: '#fff1b8', H: '#d9b54a' },
] as const;
/** T-11-191 기록 아이템(look.ts LOOK_RECORDS)의 금빛. 일반 금색(#e2b13c · #f0b437)보다 밝다. */
const RECORD_GOLD = '#ffe36e';
/** T-11-191 헤어밴드 색(0은 없음). */
const BANDS = [
  null,
  '#f4f4ef',
  '#d63a33',
  '#1c1c1f',
  '#f0b437',
  '#3f6fd8',
  '#4aa865',
  '#ef7fa6',
  // 기록 아이템: 우승 헤어밴드.
  RECORD_GOLD,
] as const;
/** T-11-191 손목 밴드 색(0은 없음, 마지막은 기록 아이템 대표팀 손목 밴드). */
const WRISTS = [null, '#f4f4ef', '#d63a33', '#1c1c1f', '#3f6fd8', '#f0b437', RECORD_GOLD] as const;
/** T-11-191 양말 색(0은 구단 양말, 마지막은 기록 아이템 월드컵 양말). */
const SOCKS = [
  null,
  '#f4f4ef',
  '#1c1c1f',
  '#d63a33',
  '#3f6fd8',
  '#f0b437',
  '#ef7fa6',
  RECORD_GOLD,
] as const;
/** T-11-191 축구화 색(0은 기본 주황). */
const BOOTS = [
  '#ff7a3d',
  '#1c1c1f',
  '#f4f4ef',
  '#e2b13c',
  '#3f6fd8',
  '#ef7fa6',
  '#4aa865',
  '#8a55c9',
  '#d63a33',
  '#c9ced4',
  // 기록 아이템: 득점왕 황금 축구화.
  RECORD_GOLD,
] as const;
/** T-11-191 고글 테 · 알 색(0은 없음). */
const GOGGLES = [
  null,
  { G: '#1c1c1f', g: '#3a4252' },
  { G: '#2c6fd6', g: '#9fd3ff' },
  { G: '#b52a24', g: '#ff9b8f' },
  { G: '#b8860b', g: '#ffe08a' },
  { G: '#1c1c1f', g: '#1c1c1f' },
  // 기록 아이템: 빅이어 은빛 고글.
  { G: '#dfe4ea', g: '#ffffff' },
] as const;
/** T-11-191 꾸미기 선택지 색(웹 · 앱 견본). 색이 아닌 항목(머리 모양 · 수염)은 null, 선택지 '없음'은 null. */
export const LOOK_SWATCHES: Record<
  'skin' | 'hair' | 'band' | 'wrist' | 'socks' | 'boots' | 'glasses',
  readonly (string | null)[]
> = {
  skin: AVATAR_SKINS.map((c) => c.s),
  hair: AVATAR_HAIRS.map((c) => c.h),
  band: BANDS,
  wrist: WRISTS,
  socks: SOCKS,
  boots: BOOTS,
  glasses: GOGGLES.map((c) => c?.g ?? null),
};
type HairStyle = keyof typeof MINI_SPRITES;
type AvatarAcc = 'armband' | 'crutch' | 'bandage' | 'suit' | 'bouquet';
/** 표정. blink · shout는 모션(서 있는 그림 프레임) 전용이다. */
type AvatarExpr = 'happy' | 'pain' | 'tired' | 'wink' | 'shout' | 'blink';
const GRAY = '#c9c6bf';
const SHADOW = 'rgba(0,0,0,.28)';
/** 현역 입대(상무 아님) 동안 입는 위장 무늬 훈련복. */
const ARMY_KIT: KitSpec = {
  body: '#5f6b3a',
  pat: '-',
  pc: '#3f4826',
  sleeve: '#5f6b3a',
  collar: '#7d8a4c',
  shorts: '#4a5430',
  socks: '#2b2b26',
  cuff: '#2b2b26',
};
/** 은퇴식 정장. */
const SUIT_KIT: KitSpec = {
  body: '#22314f',
  pat: '-',
  pc: '#22314f',
  sleeve: '#22314f',
  collar: '#f4f4ef',
  shorts: '#22314f',
  socks: '#22314f',
  cuff: '#22314f',
};
function shirtColor(k: KitSpec, x: number, y: number): string {
  if (k === ARMY_KIT) {
    const h = (x * 7 + y * 11) % 6;
    return h === 0 ? k.pc : h === 3 ? k.collar : k.body;
  }
  return kitColorAt(k, x, y);
}

/** 화면 너비에 맞는 아바타 너비(px). 칸이 고르게 보이게 정수배(좁으면 2배, 아니면 3배)로만 키운다. 웹 CSS도 같은 값이다. */
export const avatarWidth = (viewportW: number) => (viewportW < 360 ? AVATAR_W * 2 : AVATAR_W * 3);

// ───────── 외형·모습 ─────────
interface AvatarLook {
  skin: number;
  hair: number;
  style: HairStyle;
}
const STYLES: HairStyle[] = ['short', 'fringe', 'long', 'mohawk'];
const BASE_SKINS = 4;
// 검정·갈색이 흔하게(머리 색 5종에 가중치).
const HAIR_PICK = [0, 0, 0, 1, 1, 2, 3, 4];
/** 커리어 ID에서 기본 외형을 뽑는다. 같은 ID는 언제나 같은 얼굴이고 게임 RNG는 쓰지 않는다. */
export function lookOf(id: string): AvatarLook {
  const h = hashStr(`avatar:${id}`);
  return {
    // 기본 모습은 처음 4가지 피부색에서만 고른다(T-11-191 꾸미기 색이 늘어도 얼굴이 바뀌지 않게).
    skin: h % BASE_SKINS,
    hair: HAIR_PICK[(h >>> 4) % HAIR_PICK.length]!,
    style: STYLES[(h >>> 8) % STYLES.length]!,
  };
}

export interface AvatarSpec {
  look: AvatarLook;
  hairStyle: HairStyle;
  /** 흰머리 비율(0~1). */
  gray: number;
  beard: 'stubble' | 'full' | null;
  expr: AvatarExpr | null;
  acc: AvatarAcc[];
  kit: KitSpec;
  /** 가슴 엠블럼 점의 구단(구단 유니폼일 때만 찍는다). */
  club: Pick<Club, 'id' | 'name'>;
  /** T-11-191 꾸미기: 헤어밴드 · 축구화 · 고글 선택지 번호(없으면 기본). */
  band?: number;
  boots?: number;
  glasses?: number;
  wrist?: number;
  socks?: number;
}

/**
 * T-11-191 산 꾸미기를 모습에 입힌다. 피부 · 머리색 · 머리 모양 · 수염은 고른 값이 나이로 정한 값을 이긴다(흰머리는 나이 그대로).
 * 군 복무 중 까까머리는 그대로 둔다.
 */
function withLook(sp: AvatarSpec, pick: LookState['pick'], forceStyle = false): AvatarSpec {
  const out = { ...sp, look: { ...sp.look } };
  if (pick.skin !== undefined) out.look.skin = pick.skin;
  if (pick.hair !== undefined) out.look.hair = pick.hair;
  if (pick.style !== undefined && !forceStyle) out.hairStyle = LOOK_STYLES[pick.style]!;
  if (pick.beard !== undefined) out.beard = LOOK_BEARDS[pick.beard] ?? null;
  if (pick.band) out.band = pick.band;
  if (pick.boots) out.boots = pick.boots;
  if (pick.glasses) out.glasses = pick.glasses;
  if (pick.wrist) out.wrist = pick.wrist;
  if (pick.socks) out.socks = pick.socks;
  // 표정: 부상 중 아픈 표정은 그대로 둔다.
  if (pick.expr && sp.expr !== 'pain') out.expr = LOOK_EXPRS[pick.expr] ?? sp.expr;
  return out;
}

const grayAt = (age: number) => (age >= 29 ? Math.min(0.45, (age - 28) * 0.1) : 0);

/** 은퇴한 선수(은퇴 리포트·명예의 전당): 커리어 ID와 은퇴 나이만으로 은퇴식 정장 모습을 그린다. */
export function retiredAvatarSpec(id: string, age: number, code?: string | null): AvatarSpec {
  const look = lookOf(id);
  return withLook(
    {
      look,
      club: { id: '', name: '' },
      hairStyle: look.style,
      gray: grayAt(age),
      beard: age >= 24 ? 'stubble' : null,
      expr: 'happy',
      acc: ['suit', 'bouquet'],
      kit: SUIT_KIT,
    },
    parseLookCode(code),
  );
}

/** 명예의 전당 시상대: 커리어 ID로 얼굴을, 마지막 소속 구단으로 홈 유니폼을 정한 전성기 모습.
 * 실제 전성기 나이는 목록 응답에 없어 27세(짧은 수염·흰머리 없음)로 그린다. 구단 id가 없는 옛 기록은 이름으로 유니폼을 찾는다. */
export function primeAvatarSpec(e: {
  id: string;
  lastClub: string;
  lastClubId?: string | null | undefined;
  /** T-11-191 은퇴 때 올린 꾸미기 코드(look.ts lookCode). */
  look?: string | null | undefined;
}): AvatarSpec {
  const look = lookOf(e.id);
  const club = { id: e.lastClubId ?? '', name: e.lastClub };
  return withLook(
    {
      look,
      club,
      hairStyle: look.style,
      gray: 0,
      beard: 'stubble',
      expr: 'happy',
      acc: [],
      kit: kitOf(club),
    },
    parseLookCode(e.look),
  );
}

/** 커리어 상태 → 지금 모습. 나이에 따라 수염·흰머리가 생기고, 부상·입대·은퇴 때 옷과 소품이 바뀐다. */
export function avatarSpec(s: GameState, side: KitSide = 'home'): AvatarSpec {
  const pick = s.look?.pick ?? {};
  if (s.retired) return withLook(retiredAvatarSpec(s.cid, s.age), pick);
  const look = lookOf(s.cid);
  const serving = s.mil.serving;
  return withLook(
    {
      look,
      club: s.club,
      hairStyle: serving ? 'buzz' : s.age < 20 ? 'fringe' : look.style,
      gray: grayAt(s.age),
      beard: serving ? null : s.age >= 28 ? 'full' : s.age >= 24 ? 'stubble' : null,
      kit: serving && s.mil.type === 'army' ? ARMY_KIT : kitOf(s.club, side),
      expr: s.injury > 0 ? 'pain' : s.age >= 30 ? 'tired' : null,
      acc: s.injury > 0 ? ['bandage', 'crutch'] : s.nat.captain ? ['armband'] : [],
    },
    pick,
    serving,
  );
}

/** T-11-191 미니형 그림(avatar-mini.ts)에 칠할 색. 색표는 이 파일이 정본이다. */
export function miniColors(sp: AvatarSpec): MiniColors {
  const suit = sp.acc.includes('suit');
  const hair = AVATAR_HAIRS[sp.look.hair % AVATAR_HAIRS.length]!;
  return {
    skin: AVATAR_SKINS[sp.look.skin % AVATAR_SKINS.length]!.s,
    hair: sp.gray > 0 ? mix(hair.h, GRAY, sp.gray) : hair.h,
    boot: suit ? '#18181b' : (BOOTS[sp.boots ?? 0] ?? BOOTS[0]),
    sock: (!suit && SOCKS[sp.socks ?? 0]) || sp.kit.socks,
    band: BANDS[sp.band ?? 0] ?? null,
    wrist: WRISTS[sp.wrist ?? 0] ?? null,
    goggle: GOGGLES[sp.glasses ?? 0] ?? null,
    shirt: (x, y) => shirtColor(sp.kit, x, y),
    suit,
  };
}

/** 모습 → 48×64 색 격자(null은 투명). 승인된 미니형 그림을 모습대로 칠한다. */
export function avatarPixels(sp: AvatarSpec): (string | null)[][] {
  return paintMini(MINI_SPRITES[sp.hairStyle], sp, miniColors(sp));
}

/** 색 격자 → 사각형 목록(viewBox 0 0 24 32). 같은 색이 이어진 가로 칸은 사각형 하나로 합치고, 그림자 칸은 반투명 검정이다. */
export function avatarRects(px: (string | null)[][]) {
  const out: { x: number; y: number; w: number; h: number; fill: string; opacity?: number }[] = [];
  px.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const c = row[x];
      let w = 1;
      while (x + w < row.length && row[x + w] === c) w++;
      if (c)
        // 고해상도 격자(refinePixels)는 한 칸이 0.5 — viewBox(24×32)는 그대로 둔다.
        out.push(
          c === SHADOW
            ? { x: x / 2, y: y / 2, w: w / 2, h: 0.5, fill: '#000', opacity: 0.28 }
            : { x: x / 2, y: y / 2, w: w / 2, h: 0.5, fill: c },
        );
      x += w;
    }
  });
  return out;
}

/** 선수 카드용 전성기 얼굴. 커리어 ID와 은퇴 때 굳은 꾸미기로 같은 선수를 그린다.
 * 카드에는 마지막 구단 정보가 없으므로 기본 유니폼을 쓰고, 나이·소품은 얼굴에 얹지 않는다. */
export function cardAvatarSpec(p: {
  careerId: string;
  look?: string | null | undefined;
}): AvatarSpec {
  return primeAvatarSpec({ id: p.careerId, lastClub: '', look: p.look });
}

/** 얼굴과 어깨까지만 남긴 카드 초상(viewBox 0 0 24 21). 다리·그림자는 그리지 않는다. */
export const AVATAR_PORTRAIT_H = 21;
export function avatarPortraitRects(sp: AvatarSpec) {
  return avatarRects(avatarPixels(sp)).filter((r) => r.y < AVATAR_PORTRAIT_H);
}
