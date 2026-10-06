// 명예의 전당 시상대 단상 도트 그림(웹 HofPodium.svelte · 앱 HofPodium.tsx). 도트 선수(avatar.ts)가 윗면에 올라선다.
// 가로 40칸 고정, 높이는 순위별로 다르다. 웹·앱은 width 100%로 늘려 그리고, 값·순위 글자는 앞면 위에 겹쳐 쓴다.
// 시상대는 홈 첫 화면 청크에 있어 유니폼 표가 든 avatar.ts를 가져오지 않는다.

export const PODIUM_W = 40;
/** 1·2·3위 단상 높이(칸). */
export const PODIUM_H: Record<1 | 2 | 3, number> = { 1: 36, 2: 30, 3: 25 };
/** 앞면 글자 자리(칸): 윗면·띠 아래부터 받침 위까지. */
export const PODIUM_FACE_TOP = 9;
export const PODIUM_FACE_BOTTOM = 3;

interface Tone {
  line: string;
  dark: string;
  base: string;
  light: string;
  shine: string;
  /** 앞면에 겹쳐 쓰는 글자색(앞면 base 대비 4.5:1 이상). */
  ink: string;
}
export const PODIUM_TONES: Record<1 | 2 | 3, Tone> = {
  1: {
    line: '#3d2a04',
    dark: '#9c6d0c',
    base: '#d9a21b',
    light: '#f0c548',
    shine: '#fbe7a0',
    ink: '#2a1c02',
  },
  2: {
    line: '#2b3238',
    dark: '#6f7a84',
    base: '#a7b1ba',
    light: '#cdd4da',
    shine: '#eef1f4',
    ink: '#1a1f24',
  },
  3: {
    line: '#3a200b',
    dark: '#8a5225',
    base: '#c07a3d',
    light: '#dd9c62',
    shine: '#f2c79e',
    ink: '#241306',
  },
};

/** 단상 색 격자(null은 빈칸). 윗면(밟는 곳) → 메달 띠 → 앞면(돌 무늬) → 받침. */
export function podiumPixels(rank: 1 | 2 | 3): (string | null)[][] {
  const t = PODIUM_TONES[rank];
  const W = PODIUM_W;
  const H = PODIUM_H[rank];
  const g: (string | null)[][] = Array.from({ length: H }, () =>
    Array<string | null>(W).fill(null),
  );
  const set = (x: number, y: number, c: string) => {
    if (x >= 0 && x < W && y >= 0 && y < H) g[y]![x] = c;
  };
  const row = (y: number, x0: number, x1: number, c: string) => {
    for (let x = x0; x <= x1; x++) set(x, y, c);
  };

  // 윗면: 앞쪽이 살짝 넓은 사다리꼴로 원근을 준다.
  row(0, 3, W - 4, t.line);
  row(1, 2, W - 3, t.shine);
  row(2, 2, W - 3, t.light);
  row(3, 1, W - 2, t.light);
  set(2, 1, t.line);
  set(W - 3, 1, t.line);
  set(1, 2, t.line);
  set(W - 2, 2, t.line);
  set(0, 3, t.line);
  set(W - 1, 3, t.line);
  // 윗면 반짝임.
  row(1, 5, 9, '#ffffff');
  row(2, 4, 5, '#ffffff');
  // 모서리 선.
  row(4, 0, W - 1, t.line);

  // 메달 띠(5~7행): 진한 띠 위에 밝은 징을 4칸마다.
  for (let y = 5; y <= 7; y++) {
    row(y, 0, W - 1, y === 6 ? t.dark : t.base);
    set(0, y, t.line);
    set(W - 1, y, t.line);
  }
  for (let x = 3; x < W - 2; x += 4) set(x, 6, t.shine);
  row(8, 0, W - 1, t.line);

  // 앞면: 왼쪽 빛·오른쪽 그늘, 돌 무늬 점은 자리를 고정(난수 없음).
  for (let y = 9; y < H - 3; y++) {
    row(y, 0, W - 1, t.base);
    set(0, y, t.line);
    set(1, y, t.light);
    set(W - 2, y, t.dark);
    set(W - 1, y, t.line);
    // 글자가 읽히도록 성기게만 찍는다.
    for (let x = 3; x < W - 3; x++) {
      const k = (x * 7 + y * 13 + rank * 5) % 53;
      if (k === 0) set(x, y, t.light);
      else if (k === 26) set(x, y, t.dark);
    }
  }

  // 받침: 한 칸씩 더 넓게 보이도록 그늘 두 줄과 바닥선.
  row(H - 3, 0, W - 1, t.line);
  row(H - 2, 0, W - 1, t.dark);
  set(0, H - 2, t.line);
  set(W - 1, H - 2, t.line);
  for (let x = 2; x < W - 2; x += 6) set(x, H - 2, t.base);
  row(H - 1, 0, W - 1, t.line);
  return g;
}

/** 사각형 목록(viewBox 0 0 PODIUM_W PODIUM_H[rank]). 같은 색이 이어진 가로 칸은 하나로 합친다. */
export function podiumRects(rank: 1 | 2 | 3): { x: number; y: number; w: number; fill: string }[] {
  const out: { x: number; y: number; w: number; fill: string }[] = [];
  podiumPixels(rank).forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      const c = row[x];
      let w = 1;
      while (x + w < row.length && row[x + w] === c) w++;
      if (c) out.push({ x, y, w, fill: c });
      x += w;
    }
  });
  return out;
}
