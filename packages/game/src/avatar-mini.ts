// ───────── T-11-191 미니형 도트 선수 칠하기 ─────────
// 생성 이미지에서 옮긴 48×64 재질 글자 지도(avatar-mini-data.ts · 모션은 avatar-mini-motion/<머리 모양>.ts)를 모습(AvatarSpec)대로 칠한다.
// 색표(피부 · 머리 · 꾸미기)는 avatar.ts가 정본이고 여기서는 받은 색만 쓴다. 그림마다 얼굴 위치가 조금씩 달라서
// 표정 · 수염 · 헤어밴드 · 고글은 흰자(w) 자리를 찾아 그 둘레에 얹는다.
import type { AvatarSpec } from './avatar.js';
import { mix } from './color.js';
import { crestOf } from './crests.js';
import { paintEquipment } from './avatar-mini-equipment.js';

export const MINI_W = 48;
export const MINI_H = 64;

/** avatar.ts가 모습에서 고른 색. */
export interface MiniColors {
  skin: string;
  hair: string;
  boot: string;
  sock: string;
  band: string | null;
  wrist: string | null;
  goggle: { G: string; g: string } | null;
  /** 셔츠 칸 색(유니폼 무늬 · 군복 위장 무늬). 좌표는 서 있는 자세의 24×32 칸이다. */
  shirt: (x: number, y: number) => string;
  suit: boolean;
  shorts: string;
  glove: string | null;
  longSleeve: boolean;
  kneePad: string | null;
}

/** 몸에 붙는 소품 자리(서 있는 자세 기준값, 모션 프레임은 프레임마다 따로 둔다). */
export interface MiniBody {
  /** 가슴 엠블럼 왼쪽 위. */
  crest: readonly [number, number] | null;
  /** 주장 완장(화면 왼쪽 위팔) 왼쪽 위. */
  arm: readonly [number, number] | null;
  /** 손목 밴드 자리(왼쪽 위, 3×2). */
  wrists: readonly (readonly [number, number])[];
  /** 셔츠 무늬를 읽을 때 쓰는 기준: 서 있는 그림의 왼쪽 끝 x와 칼라 줄 y. */
  ox: number;
  collarY: number;
}

export const MINI_STAND: MiniBody = {
  crest: [27, 38],
  arm: [11, 39],
  wrists: [
    [9, 44],
    [37, 44],
  ],
  ox: 0,
  collarY: 34,
};

const OUT = '#16171e';
const WHITE = '#fff4e3';
const MOUTH_IN = '#7a2a2a';
const shadow = (c: string, t: number) => mix(c, '#171b31', t);
const light = (c: string, t: number) => mix(c, '#fff5dc', t);
const SKIN = 'sSLN';

interface Face {
  eyes: { x0: number; x1: number; y0: number; y1: number }[];
  mouth: { x: number; y: number }[];
}

const faces = new WeakMap<readonly string[], Face | null>();
const wrists = new WeakMap<readonly string[], { x: number; y: number }[]>();
/** 흰자(w) 두 덩어리 = 두 눈, 그 아래 얼굴 안의 어두운 칸 = 입. 못 찾으면 null(표정은 그리지 않는다). */
function faceOf(src: readonly string[]): Face | null {
  if (faces.has(src)) return faces.get(src)!;
  const ws: { x: number; y: number }[] = [];
  src.forEach((row, y) => {
    for (let x = 0; x < row.length; x++)
      // 긴 머리의 흰 헤어밴드(10~15줄)와 옷깃은 눈 후보에서 뺀다.
      if (row[x] === 'w' && y >= 16 && y < src.length * 0.55) ws.push({ x, y });
  });
  // 흰자는 가로로 붙은 두 덩어리다(옷깃 흰색은 아래쪽이라 위 55%만 본다). 가장 위에 있는 흰자 줄 근처만 쓴다.
  let face: Face | null = null;
  if (ws.length) {
    const top = Math.min(...ws.map((p) => p.y));
    const near = ws.filter((p) => p.y <= top + 4);
    const xs = [...new Set(near.map((p) => p.x))].sort((a, b) => a - b);
    const groups: number[][] = [];
    for (const x of xs) {
      const g = groups.at(-1);
      if (g && x - g.at(-1)! <= 3) g.push(x);
      else groups.push([x]);
    }
    if (groups.length >= 2) {
      const eyes = groups.slice(0, 2).map((g) => {
        const x0 = g[0]!,
          x1 = g.at(-1)!;
        // 눈동자(e)까지 넓힌다.
        let ex1 = x1;
        const ys = near.filter((p) => p.x >= x0 && p.x <= x1).map((p) => p.y);
        const y0 = Math.min(...ys),
          y1 = Math.max(...ys);
        for (let y = y0; y <= y1; y++)
          for (let x = x1 + 1; x <= x1 + 3; x++) if (src[y]![x] === 'e') ex1 = Math.max(ex1, x);
        return { x0, x1: ex1, y0, y1 };
      });
      const [l, r] = eyes as [Face['eyes'][0], Face['eyes'][0]];
      const mouth: Face['mouth'] = [];
      const by = Math.max(l.y1, r.y1);
      for (let y = by + 2; y <= by + 7; y++)
        for (let x = l.x1; x <= r.x1; x++) {
          const ch = src[y]?.[x];
          if (ch && ch !== '.' && !SKIN.includes(ch) && ch !== 'O' && ch !== 'w')
            if (SKIN.includes(src[y - 1]?.[x] ?? '.') || SKIN.includes(src[y + 1]?.[x] ?? '.'))
              mouth.push({ x, y });
        }
      // 가장 위 줄의 입 덩어리만 쓴다(턱 아래 바깥선이 섞이지 않게).
      const my = mouth.length ? Math.min(...mouth.map((p) => p.y)) : by + 5;
      face = { eyes, mouth: mouth.filter((p) => p.y <= my + 1) };
      if (!face.mouth.length) {
        const cx = Math.round((l.x1 + r.x0) / 2) + 1;
        face.mouth = [0, 1, 2].map((d) => ({ x: cx - 1 + d, y: my }));
      }
    }
  }
  faces.set(src, face);
  return face;
}

/**
 * 재질 글자 지도 → 색 격자(null은 투명). body는 몸 소품 자리(서 있는 자세는 MINI_STAND).
 * pose는 모션 자세일 때: 얼굴은 서 있는 그림(stand)의 눈 · 입 자리를 at만큼 옮겨 쓰고, 선택한 표정도 같은 자리에 그린다.
 */
export function paintMini(
  src: readonly string[],
  sp: AvatarSpec,
  c: MiniColors,
  body: MiniBody = MINI_STAND,
  pose?: { stand: readonly string[]; at: readonly [number, number]; id?: string },
): (string | null)[][] {
  const cache = new Map<string, string[]>();
  const tones = (base: string) => {
    let t = cache.get(base);
    if (!t)
      cache.set(base, (t = [base, shadow(base, 0.28), light(base, 0.16), shadow(base, 0.52)]));
    return t;
  };
  const skinT = tones(c.skin),
    hairT = tones(c.hair),
    shortT = tones(c.shorts),
    sockT = tones(c.sock),
    bootT = tones(c.boot);
  const H = src.length,
    W = src[0]!.length;
  const px = src.map((row, y) =>
    [...row].map((ch, x): string | null => {
      if (ch === '.') return null;
      // 은퇴식: 바지 아래로 보이는 다리는 정장 바지가 된다.
      if (c.suit && y >= body.collarY + 14 && y < body.collarY + 24 && SKIN.includes(ch))
        return shortT[1]!;
      const k = 'kKlz'.indexOf(ch);
      if (k >= 0) {
        // 자세 그림은 소매를 따로 나눴으니, 몸을 숙여 몸통이 옆으로 나가도 몸통 무늬 칸(7~16) 안에서 읽는다.
        const sx = Math.floor((x - body.ox) / 2);
        return tones(
          c.shirt(
            body === MINI_STAND ? sx : Math.min(16, Math.max(7, sx)),
            13 + Math.floor((y - body.collarY) / 2),
          ),
        )[k]!;
      }
      // 소매(모션 자세 그림만): 팔이 몸통 위로 올라가도 소매색으로. 화면 왼쪽 · 오른쪽 소매 칸으로 읽는다.
      const v = 'vVgG'.indexOf(ch);
      if (v >= 0) {
        const side = x < body.ox + MINI_W / 2 ? 0 : 23;
        return tones(c.shirt(side, 13 + Math.floor((y - body.collarY) / 2)))[v]!;
      }
      const i = SKIN.indexOf(ch);
      if (i >= 0) return skinT[i]!;
      const armSkin = 'uUiI'.indexOf(ch);
      if (armSkin >= 0) return skinT[armSkin]!;
      const h = 'hHjJ'.indexOf(ch);
      if (h >= 0) return hairT[h]!;
      // Closely shaved scalp follows skin; the mullet's lower section stays darker than its top.
      if (ch === 'r') return mix(c.skin, c.hair, 0.18);
      if (ch === 'f') return shadow(c.hair, 0.72);
      if (ch === 'F') return shadow(c.hair, 0.86);
      const p = 'pPq'.indexOf(ch);
      if (p >= 0) return shortT[p]!;
      const s = 'cCd'.indexOf(ch);
      if (s >= 0) return sockT[s]!;
      const b = 'bBD'.indexOf(ch);
      if (b >= 0) return bootT[b]!;
      if (ch === 'w') return WHITE;
      if (ch === 't') return sp.kit.collar;
      if (ch === 'm') return shadow(c.skin, 0.7);
      return OUT;
    }),
  );
  const put = (x: number, y: number, col: string | null) => {
    if (y >= 0 && y < H && x >= 0 && x < W) px[y]![x] = col;
  };
  const rect = (x: number, y: number, w: number, h: number, col: string) => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) put(xx, yy, col);
  };
  const onSkin = (x: number, y: number) => SKIN.includes(src[y]?.[x] ?? '.');

  const own = pose ? faceOf(pose.stand) : faceOf(src);
  const face: Face | null =
    own && pose
      ? {
          eyes: own.eyes.map((e) => ({
            x0: e.x0 + pose.at[0],
            x1: e.x1 + pose.at[0],
            y0: e.y0 + pose.at[1],
            y1: e.y1 + pose.at[1],
          })),
          mouth: own.mouth.map((p) => ({ x: p.x + pose.at[0], y: p.y + pose.at[1] })),
        }
      : own;
  if (face) {
    const [l, r] = face.eyes as [Face['eyes'][0], Face['eyes'][0]];
    const mx0 = Math.min(...face.mouth.map((p) => p.x)),
      mx1 = Math.max(...face.mouth.map((p) => p.x)),
      my = Math.min(...face.mouth.map((p) => p.y));
    // 수염: 입 둘레 아래쪽 얼굴 피부. 짧은 수염은 턱만, 덥수룩한 수염은 볼까지.
    if (sp.beard) {
      const from = sp.beard === 'full' ? my - 2 : my + 1;
      const col = sp.beard === 'full' ? shadow(c.hair, 0.3) : mix(c.skin, c.hair, 0.35);
      for (let y = from; y < my + 6; y++)
        for (let x = l.x0 - 3; x <= r.x1 + 2; x++)
          if (onSkin(x, y) && (sp.beard === 'full' || (x >= mx0 - 3 && x <= mx1 + 3)))
            put(x, y, col);
    }
    const closeEye = (e: Face['eyes'][0], mid = false) => {
      rect(e.x0, e.y0, e.x1 - e.x0 + 1, e.y1 - e.y0 + 1, c.skin);
      rect(e.x0, mid ? Math.round((e.y0 + e.y1) / 2) : e.y1, e.x1 - e.x0 + 1, 1, OUT);
    };
    const clearMouth = () => {
      for (const p of face.mouth) put(p.x, p.y, c.skin);
    };
    const cx = Math.round((mx0 + mx1) / 2);
    const smile = () => {
      clearMouth();
      rect(cx - 1, my, 3, 1, OUT);
      put(cx - 2, my - 1, OUT);
      put(cx + 2, my - 1, OUT);
    };
    switch (sp.expr) {
      case 'blink':
        closeEye(l);
        closeEye(r);
        break;
      case 'wink':
        closeEye(r);
        smile();
        break;
      case 'happy':
        smile();
        break;
      case 'shout':
        clearMouth();
        rect(cx - 2, my - 1, 4, 4, OUT);
        rect(cx - 1, my, 2, 2, MOUTH_IN);
        break;
      case 'pain':
        closeEye(l, true);
        closeEye(r, true);
        clearMouth();
        rect(cx - 2, my, 5, 1, OUT);
        break;
      case 'tired':
        rect(l.x0, l.y1 + 1, l.x1 - l.x0 + 1, 1, skinT[1]!);
        rect(r.x0, r.y1 + 1, r.x1 - r.x0 + 1, 1, skinT[1]!);
        break;
    }
    // 헤어밴드: 눈썹 위 이마 두 줄. 너비는 서 있는 그림의 머리 폭이고(든 팔 위로 넘치지 않게), 그림이 있는 칸에만 칠한다.
    if (c.band) {
      const stand = pose?.stand ?? src;
      const [ax, ay] = pose?.at ?? [0, 0];
      const by = Math.min(l.y0, r.y0) - 6;
      for (let y = by; y < by + 2; y++) {
        const row = stand[y - ay] ?? '';
        const x0 = row.search(/[^.]/) + 1,
          x1 = row.length - 2 - [...row].reverse().join('').search(/[^.]/);
        if (x0 <= 0) continue;
        for (let x = x0 + ax; x <= x1 + ax; x++)
          if (src[y]?.[x] && src[y]![x] !== '.') put(x, y, c.band);
      }
    }
    if (c.goggle) {
      const g = c.goggle;
      for (const e of [l, r]) {
        rect(e.x0 - 1, e.y0 - 1, e.x1 - e.x0 + 3, e.y1 - e.y0 + 3, g.G);
        rect(e.x0, e.y0, e.x1 - e.x0 + 1, e.y1 - e.y0 + 1, g.g);
      }
      rect(l.x1 + 2, l.y0, r.x0 - l.x1 - 3, 1, g.G);
    }
    if (sp.acc.includes('bandage')) rect(r.x1 - 1, r.y0 - 5, 4, 2, WHITE);
  }
  if (c.wrist) for (const [x, y] of body.wrists) rect(x, y, 3, 2, c.wrist);
  // 자세 그림의 손목은 소매와 맞닿은 피부다. 얼굴 피부에는 칠하지 않고, 팔이 올라가거나 굽어도 소매 끝을 따라간다.
  if (c.wrist && pose) {
    let points = wrists.get(src);
    if (!points) {
      const edge: { x: number; y: number; distance: number }[] = [];
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const armSkin = 'uUiI'.includes(src[y]?.[x] ?? '.');
          if (!onSkin(x, y) && !armSkin) continue;
          const hy = y - pose.at[1],
            hx = x - pose.at[0];
          if (!armSkin && hy >= 0 && hy < 33 && (pose.stand[hy]?.[hx] ?? '.') !== '.') continue;
          let distance = 10;
          for (let dy = -8; dy <= 8; dy++)
            for (let dx = -8; dx <= 8; dx++)
              if ('vVgGkKlz'.includes(src[y + dy]?.[x + dx] ?? '.'))
                distance = Math.min(distance, Math.abs(dx) + Math.abs(dy));
          if (distance < 10) edge.push({ x, y, distance });
        }
      const near = Math.min(...edge.map((p) => p.distance));
      points = edge.filter((p) => p.distance <= near + 1);
      wrists.set(src, points);
    }
    for (const p of points) put(p.x, p.y, c.wrist);
  }
  // Gloves cover wristbands; the selected band returns when gloves are removed.
  paintEquipment(px, src, c, body, pose);
  if (sp.acc.includes('armband') && body.arm) rect(body.arm[0], body.arm[1], 4, 2, '#f0b437');
  if (body.crest && !c.suit && sp.club.id) {
    const crest = crestOf(sp.club);
    const [x, y] = body.crest;
    rect(x, y, 3, 3, crest.base);
    put(x + 2, y + 2, crest.motifColor);
  }
  if (body === MINI_STAND) {
    if (sp.acc.includes('bandage')) rect(18, 52, 4, 2, WHITE);
    if (sp.acc.includes('crutch')) {
      rect(43, 40, 2, 21, OUT);
      rect(43, 42, 1, 18, '#b7bec4');
      rect(40, 39, 7, 2, OUT);
      rect(41, 39, 5, 1, '#b7bec4');
    }
    if (c.suit) {
      for (let y = 36; y < 46; y++) {
        const w = y < 40 ? 6 - (y - 36) : 2;
        rect(25 - Math.floor(w / 2), y, w, 1, WHITE);
      }
      rect(25, 38, 2, 8, '#ba423d');
    }
    if (sp.acc.includes('bouquet')) {
      rect(36, 46, 3, 9, '#46a457');
      for (const [x, y, col] of [
        [33, 43, '#ef7fa6'],
        [37, 42, '#c74a78'],
        [40, 44, '#ef7fa6'],
        [36, 46, '#c74a78'],
      ] as const) {
        rect(x, y, 3, 3, col);
        put(x + 1, y + 1, '#fff2bf');
      }
      rect(35, 49, 5, 6, '#f4f0e4');
    }
  }
  return px;
}
