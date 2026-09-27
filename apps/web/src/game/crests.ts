// ───────── 기본 엠블럼 (T-10-063) ─────────
// 유저가 로고를 바꾸지 않은 클럽의 기본 엠블럼. 실제 구단 엠블럼을 따라 그리지 않고 팀 색 · 유니폼 패턴 ·
// 방패/원형 틀 · 흔한 상징 하나만으로 "그 팀"을 떠올리게 한다 — 실제 문장 배치, 글자 로고(약칭 포함), 창단 연도,
// 그 구단만의 고유 상징(대포, 리버버드, 교차한 망치 등)은 쓰지 않는다. 글자는 게임 속 별칭의 도시 머리글자만 쓴다.
// 이미지가 아니라 64×64 벡터 설정값이라 16px에서도 선명하고, 저장·동기화 용량을 쓰지 않는다.
import type { Club } from './data.js';

export const CREST_SHAPES = {
  /** 방패 */
  s: 'M8 6h48v24c0 16-11 25-24 30C19 55 8 46 8 30z',
  /** 뾰족한 방패 */
  p: 'M9 7h46v23L32 58 9 30z',
  /** 원형 */
  r: 'M32 3a29 29 0 1 1 0 58a29 29 0 1 1 0-58z',
  /** 둥근 사각 */
  b: 'M16 6h32a10 10 0 0 1 10 10v32a10 10 0 0 1-10 10H16A10 10 0 0 1 6 48V16A10 10 0 0 1 16 6z',
} as const;

const lozenges = (() => {
  let d = '';
  for (let y = 0; y <= 64; y += 12)
    for (let x = y % 24 ? 6 : 0; x <= 64; x += 12) d += `M${x} ${y - 6}l6 6-6 6-6-6z`;
  return d;
})();
/** 바탕 위에 accent 색으로 칠하는 유니폼 패턴. tri는 오른쪽 3분의 1을 세 번째 색으로 더 칠한다. */
export const CREST_PATTERNS: Record<string, string> = {
  '-': '',
  v: 'M12 0h8v64h-8zM28 0h8v64h-8zM44 0h8v64h-8z',
  h: 'M0 14h64v8H0zM0 30h64v8H0zM0 46h64v8H0z',
  hoop: 'M0 38h64v9H0z',
  half: 'M32 0h32v64H32z',
  hh: 'M0 32h64v32H0z',
  sl: 'M0 0h18v64H0zM46 0h18v64H46z',
  band: 'M23 0h18v64H23z',
  sash: 'M0 10L10 0l54 54-10 10z',
  ch: 'M0 20l32 18 32-18v10L32 48 0 30z',
  q: 'M32 0h32v32H32zM0 32h32v32H0z',
  cr: 'M27 0h10v64H27zM0 27h64v10H0z',
  dz: lozenges,
  tri: 'M21 0h22v64H21z',
};
const TRI_THIRD = 'M43 0h21v64H43z';

const ring = (r: number, n: number, rr: number) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i * 2 * Math.PI) / n;
    const x = +(32 + r * Math.sin(a)).toFixed(1);
    const y = +(32 - r * Math.cos(a)).toFixed(1);
    return `M${x - rr} ${y}a${rr} ${rr} 0 1 0 ${rr * 2} 0a${rr} ${rr} 0 1 0 ${-rr * 2} 0z`;
  }).join('');
const rays = Array.from({ length: 8 }, (_, i) => {
  const a = (i * Math.PI) / 4;
  const p = (r: number, da: number) =>
    `${+(32 + r * Math.sin(a + da)).toFixed(1)} ${+(32 - r * Math.cos(a + da)).toFixed(1)}`;
  return `M${p(10, -0.25)}L${p(16, 0)}L${p(10, 0.25)}z`;
}).join('');

/** 상징: d는 상징 색, k(있으면)는 바탕색으로 다시 칠해 구멍·눈·줄무늬를 낸다. */
export const CREST_MOTIFS: Record<string, { d: string; k?: string; t?: string }> = {
  star: { d: 'M32 18l3.8 9.6 10.2.6-7.9 6.5 2.6 10-8.7-5.6-8.7 5.6 2.6-10-7.9-6.5 10.2-.6z' },
  crown: { d: 'M19 42h26l2-17-9 7-6-11-6 11-9-7z', k: 'M30 36h4v3h-4z' },
  ball: {
    d: 'M32 21a11 11 0 1 0 0 22a11 11 0 1 0 0-22z',
    k: 'M32 27l4.8 3.5-1.8 5.6h-6l-1.8-5.6z',
  },
  bird: {
    d: 'M12 25q12 0 20 14q8-14 20-14q-10 4-14 19h-12q-4-15-14-19zM29 31a3 3 0 1 0 6 0a3 3 0 1 0-6 0z',
  },
  wing: { d: 'M18 42l16-20-2 8 10-10-2 9 8-5-8 18z' },
  trident: { d: 'M30.5 17h3v31h-3zM22 19h3v9c0 3 3 5 7 5s7-2 7-5v-9h3v9c0 5-4 8-10 8s-10-3-10-8z' },
  hammer: { d: 'M21 17h22v8H21zM30 25h4v23h-4z', t: 'rotate(-35 32 33)' },
  tree: { d: 'M32 15l9 13H23zM32 22l12 15H20zM30 37h4v9h-4z' },
  cherry: {
    d: 'M25.5 38Q29 24 35.5 17.5l1.4 1.4Q30.5 25 27.5 38.5zM37 40q-.5-12-1.5-21.5h2Q38.5 28 39 40zM20 40a6 6 0 1 0 12 0a6 6 0 1 0-12 0zM32 42a6 6 0 1 0 12 0a6 6 0 1 0-12 0z',
  },
  tower: { d: 'M21 46V20h5v5h4v-5h4v5h4v-5h5v26z', k: 'M29 46v-7a3 3 0 0 1 6 0v7z' },
  bee: {
    d: 'M23 35a9 7 0 1 0 18 0a9 7 0 1 0-18 0zM24 25a4.5 3.2 0 1 0 9 0a4.5 3.2 0 1 0-9 0zM31 25a4.5 3.2 0 1 0 9 0a4.5 3.2 0 1 0-9 0z',
    k: 'M28 29h2.5v12H28zM33.5 29H36v12h-2.5z',
  },
  wolf: { d: 'M20 15l8 11h8l8-11 1 16-6 9-7 9-7-9-6-9z', k: 'M24 30l6 3-5 1zM40 30l-6 3 5 1z' },
  rose: { d: ring(7, 5, 5.5), k: 'M29 32a3 3 0 1 0 6 0a3 3 0 1 0-6 0z' },
  flower: { d: ring(8, 5, 6), k: 'M28.5 32a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0z' },
  cat: { d: 'M22 22l7 7h6l7-7v14a10 10 0 0 1-20 0z', k: 'M26 34l4 1-4 1.5zM38 34l-4 1 4 1.5z' },
  paw: {
    d: 'M32 31c-6 0-10 6-10 10 0 3 2.5 4.5 5 4.5 2 0 3-1 5-1s3 1 5 1c2.5 0 5-1.5 5-4.5 0-4-4-10-10-10zM18.5 29a3.5 4 0 1 0 7 0a3.5 4 0 1 0-7 0zM24.5 22a3.5 4 0 1 0 7 0a3.5 4 0 1 0-7 0zM32.5 22a3.5 4 0 1 0 7 0a3.5 4 0 1 0-7 0zM38.5 29a3.5 4 0 1 0 7 0a3.5 4 0 1 0-7 0z',
  },
  horns: {
    d: 'M16 20c1 9 7 13 16 13s15-4 16-13c-4 5-9 7-16 7s-12-2-16-7zM25 33h14l-3 13h-8z',
    k: 'M27 37l3 1-3 1zM37 37l-3 1 3 1z',
  },
  antler: { d: 'M30 46V32l-8-8v-8h2.5v7l3 3v-8H30v12h4V18h2.5v8l3-3v-7H42v8l-8 8v14z' },
  flame: { d: 'M32 13c2 8 12 12 12 23a12 12 0 0 1-24 0c0-6 4-9 6-14 1 4 3 6 4 6 0-5-1-9 2-15z' },
  bolt: { d: 'M37 13L21 35h10l-4 16 16-23H33l4-15z' },
  wave: {
    d: 'M15 27q4.25-5 8.5 0t8.5 0 8.5 0 8.5 0v5q-4.25 5-8.5 0t-8.5 0-8.5 0-8.5 0zM15 38q4.25-5 8.5 0t8.5 0 8.5 0 8.5 0v5q-4.25 5-8.5 0t-8.5 0-8.5 0-8.5 0z',
  },
  anchor: {
    d: 'M30.5 20h3v25h-3zM25 23h14v3H25zM32 12.5a4 4 0 1 0 0 8a4 4 0 1 0 0-8zM19 35l4-2q2 10 9 10t9-10l4 2q-3 13-13 13t-13-13z',
  },
  mountain: { d: 'M13 46l14-23 6 9 5-7 13 21z', k: 'M27 23l-3.5 6 2 1 1.5-2 1.5 2 2-1z' },
  sun: { d: `M25 32a7 7 0 1 0 14 0a7 7 0 1 0-14 0z${rays}` },
  fish: {
    d: 'M15 33q10-13 25-2l8-7v18l-8-7q-15 11-25-2z',
    k: 'M21 31a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0-3.6 0z',
  },
  diamond: { d: 'M32 15l14 17-14 17-14-17z', k: 'M32 23l7 9-7 9-7-9z' },
  arrows: {
    d: 'M23 46V24h2v22zM20 25l4-9 4 9zM31 46V24h2v22zM28 25l4-9 4 9zM39 46V24h2v22zM36 25l4-9 4 9z',
  },
  heart: { d: 'M32 46C20 38 18 31 22 27s8-2 10 2c2-4 6-6 10-2s2 11-10 19z' },
  lily: {
    d: 'M32 14c4 6 5 12 0 20-5-8-4-14 0-20zM30 34c-6-10-16-6-12 2 2-3 6-3 8 1zM34 34c6-10 16-6 12 2-2-3-6-3-8 1zM22 34h20v3H22zM30 37h4v9h-4z',
  },
  cross: { d: 'M28 15h8v13h13v8H36v13h-8V36H15v-8h13z' },
  bell: {
    d: 'M32 15a3 3 0 0 1 3 3c6 2 8 8 8 14v6l3 4H18l3-4v-6c0-6 2-12 8-14a3 3 0 0 1 3-3zM28 44h8a4 4 0 0 1-8 0z',
    k: 'M31 22h2v14h-2z',
  },
  bat: {
    d: 'M32 27l-2.5-4-1 4C22 23 15 25 13 31c4-1 7 1 8 4 2-2 5-2 7 0 2-2 3-1.5 4 0 1-1.5 2-2 4 0 2-2 5-2 7 0 1-3 4-5 8-4-2-6-9-8-15.5-4l-1-4z',
  },
  flag: {
    d: 'M32 17a11 10 0 0 1 11 10c0 4-2 6-4 7v5H25v-5c-2-1-4-3-4-7a11 10 0 0 1 11-10zM16 42l32 6-1 3-32-6zM48 42l-32 6 1 3 32-6z',
    k: 'M25.5 27a3 3 0 1 0 6 0a3 3 0 1 0-6 0zM32.5 27a3 3 0 1 0 6 0a3 3 0 1 0-6 0zM28 36h2v3h-2zM34 36h2v3h-2z',
  },
  sword: { d: 'M31 13h2l1.5 25h-5zM23 38h18v3H23zM30.5 41h3v7h-3z' },
  leaf: {
    d: 'M32 14l3 7 5-3-1 8 6-2-3 6 4 2-9 5 1 4-5-1v8h-2v-8l-5 1 1-4-9-5 4-2-3-6 6 2-1-8 5 3z',
  },
  arc: { d: 'M17 44a15 15 0 0 1 30 0h-5a10 10 0 0 0-20 0z' },
  ship: { d: 'M30 15v26H19zM34 17l10 24H34zM17 43h30l-4 6H21z' },
};

export interface Crest {
  shape: keyof typeof CREST_SHAPES;
  pattern: string;
  base: string;
  accent: string;
  /** tri 패턴의 세 번째 색. */
  third?: string;
  edge?: string;
  /** CREST_MOTIFS 키, 또는 '=글자'. */
  motif?: string;
  motifColor: string;
  /** 줄무늬처럼 복잡한 바탕 위 상징 뒤에 흰 원판을 깐다. */
  disc: boolean;
}

// 한 줄 = '틀 패턴 바탕 accent 테두리 상징 상징색 [d]' (색은 # 뺀 hex, 없으면 -). tri 패턴은 'tri:세번째색'.
// 배열 순서는 data.ts CLUB_NAMES와 같다(클럽 id = `${리그}-${위치}`). 고교·대학은 가상 학교라 아래 autoCrest로 만든다.
const SPECS: Record<string, string[]> = {
  k3: [
    'b - 1b5fa8 - f39800 bolt f39800',
    'r - 0b3d91 - fff =C fff',
    's - 004a98 - e60012 =B fff',
    'r - 2e8b57 - fff wave fff',
    'p - 0055a5 - fff =D fff',
    's - 1f5f3a - fff mountain fff',
    'r - 0089cf - fff wave fff',
    'b - fff - 0068b7 wave 0068b7',
    'r - 003876 - ffd200 fish ffd200',
    's - 0b6e3b - f7d117 =N f7d117',
    'b half 00a0b0 0a5a8a fff =C fff',
    'r - 004ea2 - fff anchor fff',
    'p - 2a9d8f - fff wave fff',
    's - f28c28 - fff sun fff',
  ],
  k2: [
    's - 0046a8 - e30613 wing fff',
    's - d7141a - fff ball fff',
    'r - 1f2a55 - d4a017 star d4a017',
    's - ffd400 - 111 flame 111',
    's - 111 - fff bird fff',
    'r - 58b7e8 - 0a2458 wing 0a2458',
    'p half d6001c 0b3d91 fff tower fff',
    's - e60012 - 1a1a1a wing fff',
    'b - d4af37 - 1c2c5b wave 1c2c5b',
    'r - 0055b8 - ffd200 arc ffd200',
    'p - 5bc2e7 - 0b2a4a wolf 0b2a4a',
    's - 00338d - e4002b sword fff',
    'r - 00843d - fff tree fff',
    's - 6b2c91 - d4af37 crown d4af37',
    'b - f37021 - fff star fff',
    'p - 0a3d7a - fff flame fff',
    's - 2b4c2f - d9c07a =P d9c07a',
  ],
  k1: [
    's - 0046a8 - ffd200 paw ffd200',
    's - 0b7a3b - 111 star ffd400',
    's v 111 d51f26 111 wave 111 d',
    'r v 111 d71920 d4af37 - -',
    'p half 5a2a82 00857c fff star fff',
    's v 111 0059a8 111 anchor 111 d',
    's - f47920 - fff mountain fff',
    's - ffcd00 - e60012 bolt e60012',
    'r - f58220 - fff wing fff',
    'b - 5f259f - fff =A fff',
    's - c8102e - 111 =95 fff',
  ],
  j1: [
    's - e6002d - fff diamond fff',
    'p - a50034 - 111 ship fff',
    's - b71c2e - 1b2a4e antler fff',
    's hoop 0a3a8c e60012 fff anchor fff',
    'r v 3aa6e0 111 111 fish 111 d',
    's - 5b2d8e - fff arrows fff',
    'r - ffe100 - 111 sun 111',
    'b - 0b3b8c - c9a227 star c9a227',
    's v 004ea2 111 111 - -',
    'r half 1d4fa0 d7102b fff - -',
    's - d7000f - f8b500 fish fff',
    'p - 5a2d82 - fff wing fff',
    's - e5006e - 1b1f5c flower fff',
    'r - 008c4a - fff star fff',
    'b - 0b1c3d - a0a8b3 bee ffd200',
    'p - f39800 - 0b3b8c wave fff',
    's - 9e1b32 - fff bird fff',
    'r - f39800 - 0055a5 ship 0055a5',
    'r - ffd400 - 00843d bird 00843d',
    'b - 0055a5 - fff flower fff',
  ],
  mls: [
    's - f7b5cd - 231f20 bird 231f20',
    'p - 071b2c - b19b69 bell b19b69',
    's - fff - 12284c wave 12284c',
    's - 111 - c39e6d wing c39e6d',
    'r - 0b1f41 - 00b2a9 wave 00b2a9',
    'p - f05323 - 263b80 paw 263b80',
    'b - fedd00 - 111 hammer 111',
    'r - 5d9741 - 236192 wave fff',
    'r - 585958 - 8cd2f4 bird 8cd2f4',
    's - 1a85c8 - 111 crown 111',
    'r - 6cace4 - 041e42 tower 041e42',
    's - ece83a - 1f1646 wolf 1f1646',
    'r - 004812 - d69a00 tree d69a00',
    'p - 00b140 - 111 tree 111',
    's - 633492 - fdd116 paw fdd116',
    's - c8102e - 0a174a flame fff',
    'r - fff - ed1e36 horns ed1e36',
    'r - b30838 - 013a81 crown f1aa00',
    'p - 0067b1 - 111 bolt fff',
    's - 862633 - 8bb8e8 wave 8bb8e8',
    'b - ff6b00 - 101820 flame 101820',
    'r - 00245d - ffd200 star ffd200',
    's v 111 80000a a19060 - -',
    'p - dd004a - 0a1e2c arc fff',
    'r dz 91b0d5 002f65 002f65 - -',
    's - 111 - ef3e42 wing fff',
    'r - 0033a1 - 111 lily fff',
    's - b81137 - 455560 leaf fff',
    's - 0a2240 - ce0e2d star fff',
    'r h e81f3e 2a4076 fff - -',
  ],
  ere: [
    's band fff d2122e d2122e - -',
    'r v fff ed1c24 ed1c24 - -',
    'r half ed1c24 fff 111 - -',
    's - e30613 - fff =A fff',
    'r - e30613 - fff =E fff',
    's - e30613 - fff tower fff',
    's half e30613 ffd200 111 wing 111',
    's tri:111 e30613 00843d 111 - -',
    's v fff 0057b8 0057b8 heart e30613 d',
    'p v fff e30613 111 - -',
    'r half 0065b3 00a651 fff =Z fff',
    's half fff 00843d 00843d star 00843d d',
    'r - ffd200 - 00843d star 00843d',
    's h ffd200 111 111 - -',
    'r v fff 111 111 - -',
    'b half e30613 111 111 =R fff',
    's - fff - 0a3a6e wing 0a3a6e',
    'r - f7941d - fff fish fff',
  ],
  l1: [
    's band 004170 da291c da291c tower fff',
    's - fff - 2faee0 star 2faee0',
    'r hh e30613 fff e30613 crown ffd200',
    'p - e01e13 - 16284c paw fff',
    'r - fff - da291c paw 1c3f94',
    's v 111 e2001a 111 wing 111 d',
    's half ffd100 e30613 111 - -',
    'r hh e30613 111 111 =R fff',
    's - 009fe3 - fff =S fff',
    'r - 5b2c86 - fff cross fff',
    'p - e30613 - fff ship fff',
    's - ffe600 - 00843d bird 00843d',
    'b - 1b2a4e - 7fb2e5 wave 7fb2e5',
    's - fff - 0055a5 =A 0055a5',
    'b v fff 111 111 - -',
    'r half 7fb2e5 0a2a5b 0a2a5b anchor 0a2a5b d',
    's - f58220 - 111 fish 111',
    's - 7b1e2e - fff cross fff',
  ],
  bl: [
    'r dz 0066b2 fff dc052d - -',
    'r - fde100 - 111 =D 111',
    's hh e32221 111 111 paw fff',
    's - fff - 0c2043 horns dd0741',
    'r - 111 - e1000f wing fff',
    's hoop fff e32219 e32219 antler 111',
    'p - 111 - e2001a =F fff',
    'r - 65b32e - fff wolf fff',
    's tri:00843d fff 111 111 - -',
    'r - c3141e - fff =M fff',
    's - d4011d - ffd200 hammer fff',
    'p - 1d9053 - fff diamond fff',
    'r - 1961b5 - fff =H fff',
    's half ba3733 46714d fff tree fff',
    's - 0a3f86 - 111 diamond fff',
    'p - ed1c24 - fff horns fff',
    's - 5c3a21 - fff flag fff',
    'r half e2001a 003b79 fff =H fff',
  ],
  sa: [
    'r v 111 0068a8 d4af37 - -',
    'p v 111 fff d4af37 - -',
    'r - 12a0d7 - fff wave fff',
    's v 111 e2001a 111 - -',
    'b v 111 1e71b8 111 - -',
    'p - 8e1f2f - f0bc42 wolf f0bc42',
    's - 87d8f7 - 0a2a4a wing 0a2a4a',
    'r - 002f6c - fff wave fff',
    's half c8102e 1a2f48 fff tower fff',
    'p - 4b2884 - fff lily fff',
    's - 881f19 - fff horns fff',
    's half 111 fff 111 star 111 d',
    'p half 1a2f5a b1102b fff wing fff',
    's cr fff 111 ffd200 - -',
    'r q b1102b 0a2a5b fff - -',
    's v 00a651 111 111 - -',
    's v ffd200 e2001a e2001a wolf 111 d',
    'p - 00338d - ffd200 =V ffd200',
    's v a5a5a5 e2001a e2001a tower e2001a d',
    'p band 111 0e3b83 111 cross fff',
  ],
  ll: [
    'r - fff - 3d195b crown d4af37',
    'p v 004d98 a50044 edcb00 - -',
    's v fff cb3524 272e61 - -',
    'r v fff ee2523 111 paw 111 d',
    'b - ffe667 - 005187 wave 005187',
    's - fff - d71a28 =S d71a28',
    'r v fff 0067b1 0067b1 crown ffd200 d',
    's v fff 0bb363 0bb363 crown 0bb363 d',
    's - 8ac3ee - e2001a cross e2001a',
    'r - fff - ee3524 bat 111',
    'p - d91a21 - 0a346f =P fff',
    's sash fff e53027 e53027 - -',
    'r - 005999 - fff =G fff',
    'b v fff cd2534 cd2534 - -',
    'r v fff 007fc8 007fc8 - -',
    's hh e20613 111 ffd200 crown ffd200',
    'p v fff 0761af 0761af - -',
    's hoop fff 05642c 05642c - -',
    'b v b4053f 004d98 fff - -',
    's - 0055a5 - ffd200 tree fff',
  ],
  pl: [
    'r - 6cabdd - 1c2c5b ball fff',
    's - c8102e - f6eb61 bird f6eb61',
    's sl ef0107 fff 9c824a - -',
    'r - 034694 - fff star dba111',
    's - da291c - 111 trident fbe122',
    's - fff - 132257 ball 132257',
    's v fff 111 111 - -',
    's half 670e36 95bfe5 f3d459 - -',
    'r - 0057b8 - fff bird fff',
    'r - dd0000 - fff tree fff',
    'r v e30613 fff 111 bee 111 d',
    's half 1b458f c4122e fff wing fff',
    's v 111 da291c 111 cherry da291c d',
    's hoop fff 111 111 - -',
    'r - 003399 - fff tower fff',
    's sl 7a263a 1bb1e7 1bb1e7 hammer fff',
    'r - fdb913 - 231f20 wolf 231f20',
    'r - fff - 1d428a rose ffcd00',
    's v fff eb172b 111 cat 111 d',
    's ch 6c1d45 99d6ea 99d6ea - -',
  ],
};
/** 김천 상무(military.SANGMU) — K리그1에 병역 중에만 소속된다. */
const SANGMU_SPEC = 'p - 1f4d2b - e60012 star ffd400';

const col = (h: string) => `#${h}`;
export function parseCrest(spec: string): Crest {
  const [shape, pat, base, accent, edge, motif, mc, disc] = spec.split(' ') as string[];
  const [pattern, third] = pat!.split(':') as [string, string?];
  return {
    shape: shape as Crest['shape'],
    pattern: pattern,
    base: col(base!),
    accent: accent === '-' ? col(base!) : col(accent!),
    ...(third ? { third: col(third) } : {}),
    ...(edge !== '-' ? { edge: col(edge!) } : {}),
    ...(motif !== '-' ? { motif } : {}),
    motifColor: mc === '-' ? '#ffffff' : col(mc!),
    disc: disc === 'd',
  };
}

// 고교·대학: 학교 색 조합 + 틀·패턴을 id 해시로 고르고, 학교 이름 첫 글자를 넣는다(이름을 바꾸면 글자도 따라간다).
const SCHOOL_COLORS = [
  ['0b2a5b', 'd4a017'],
  ['7a1f2b', 'ffffff'],
  ['1d5b3a', 'ffffff'],
  ['1c4f9c', 'ffffff'],
  ['1a1a1a', 'e3b021'],
  ['c8102e', 'ffffff'],
  ['4b2a7b', 'ffffff'],
  ['0f6e8c', 'f2c14e'],
  ['5a3a1e', 'f0e2c0'],
  ['23395d', 'c8102e'],
] as const;
const SCHOOL_PATTERNS = ['-', 'v', 'hoop', 'half', 'sash', 'ch', 'band', '-'];
const SCHOOL_SHAPES = ['s', 'p', 'b', 's', 'r'] as const;
function fnv(id: string): number {
  let h = 0x811c9dc5;
  for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}
function autoCrest(club: Pick<Club, 'id' | 'name'>): Crest {
  const h = fnv(club.id);
  const [bg, fg] = SCHOOL_COLORS[h % SCHOOL_COLORS.length]!;
  const pattern = SCHOOL_PATTERNS[(h >>> 4) % SCHOOL_PATTERNS.length]!;
  return {
    shape: SCHOOL_SHAPES[(h >>> 8) % SCHOOL_SHAPES.length]!,
    pattern,
    base: col(bg),
    accent: col(fg),
    edge: col(fg),
    motif: `=${[...club.name][0] ?? '?'}`,
    motifColor: pattern === '-' ? col(fg) : col(bg),
    disc: pattern !== '-',
  };
}

const AUTO_LEAGUES = new Set(['hs', 'uni']);
const cache = new Map<string, Crest>();
/** 클럽의 기본 엠블럼. 정의가 없는 클럽(새로 추가된 클럽 등)은 null — 글자 엠블럼으로 그린다. */
export function crestOf(club: Pick<Club, 'id' | 'name'>): Crest | null {
  const cut = club.id.lastIndexOf('-');
  const league = club.id.slice(0, cut);
  if (AUTO_LEAGUES.has(league)) return autoCrest(club);
  let c = cache.get(club.id);
  if (!c) {
    const spec =
      club.id === 'sangmu' ? SANGMU_SPEC : SPECS[league]?.[Number(club.id.slice(cut + 1))];
    if (!spec) return null;
    c = parseCrest(spec);
    cache.set(club.id, c);
  }
  return c;
}
/** 테스트용: 리그별 정의 줄 수. */
export const crestSpecCount = (league: string) => SPECS[league]?.length ?? 0;
export const TRI_THIRD_PATH = TRI_THIRD;
