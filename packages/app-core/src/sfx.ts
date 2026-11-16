// T-11-738 결과 효과음. 음원 파일 없이 음 몇 개를 합성한다(샘플을 쓰지 않아 저작권 · 라이선스 부담이 없다).
// 웹은 renderSfx로 만든 소리를 Web Audio 버퍼로 튼다. 앱(1.1.10 네이티브 빌드부터, expo-audio)은 같은 함수로 만든 WAV를
// 틀어 두 곳의 소리를 똑같이 맞춘다(encodeWav). 클릭음 · 공개 연출음은 웹 sfx.ts · revealPrefs.ts에 따로 있다.
//
// 결과 → 소리 짝은 sfxKind.ts(합성 코드 없이 가볍게 불러 쓰게).
// 넣는 곳은 결과가 나오는 순간뿐이다(탭 이동 · 토스트 · 오류 · 기다리는 동안에는 없다). 효과음 설정과 업무 모드를 따른다.

import type { SfxId } from './sfxKind';

export type { SfxId } from './sfxKind';

export interface SfxNote {
  type: 'sine' | 'triangle' | 'square' | 'noise';
  /** 시작 주파수(Hz). noise는 대역 필터 중심. */
  f: number;
  /** 끝 주파수 — 지수 곡선으로 미끄러진다. */
  f2?: number;
  /** 시작 시각 · 길이(초). */
  t: number;
  d: number;
  /** 최대 크기(0–1). 웹 클릭음이 0.12다. */
  g: number;
  /** 커지는 시간(초). 그 뒤 길이 끝까지 지수로 줄어든다. */
  a: number;
  /** 주파수 떨림(호루라기): 초당 r번, 폭 x Hz. */
  vib?: { r: number; x: number };
}

const C5 = 523.25,
  D5 = 587.33,
  E5 = 659.25,
  G5 = 783.99,
  A5 = 880,
  B5 = 987.77,
  C6 = 1046.5,
  G4 = 392;

const whistle = (t: number, d: number, g = 0.035): SfxNote[] => [
  { type: 'sine', f: 2900, t, d, g, a: 0.015, vib: { r: 38, x: 120 } },
  { type: 'noise', f: 2900, t, d, g: g * 0.35, a: 0.01 },
];

export const SFX: Readonly<Record<SfxId, readonly SfxNote[]>> = {
  reward: [
    { type: 'square', f: B5, t: 0, d: 0.07, g: 0.035, a: 0.003 },
    { type: 'square', f: B5 * 1.335, t: 0.065, d: 0.22, g: 0.035, a: 0.003 },
    { type: 'sine', f: B5 * 2.67, t: 0.065, d: 0.2, g: 0.02, a: 0.003 },
  ],
  good: [
    { type: 'triangle', f: E5, t: 0, d: 0.14, g: 0.09, a: 0.006 },
    { type: 'triangle', f: A5, t: 0.08, d: 0.26, g: 0.09, a: 0.006 },
    { type: 'sine', f: A5 * 2, t: 0.08, d: 0.22, g: 0.015, a: 0.006 },
  ],
  great: [
    { type: 'triangle', f: C5, t: 0, d: 0.12, g: 0.08, a: 0.006 },
    { type: 'triangle', f: E5, t: 0.07, d: 0.12, g: 0.08, a: 0.006 },
    { type: 'triangle', f: G5, t: 0.14, d: 0.12, g: 0.08, a: 0.006 },
    { type: 'triangle', f: C6, t: 0.21, d: 0.38, g: 0.09, a: 0.006 },
    { type: 'sine', f: C6 * 2, t: 0.21, d: 0.3, g: 0.015, a: 0.006 },
  ],
  keep: [{ type: 'sine', f: 420, f2: 380, t: 0, d: 0.12, g: 0.09, a: 0.004 }],
  bad: [
    { type: 'triangle', f: D5, t: 0, d: 0.13, g: 0.07, a: 0.006 },
    { type: 'triangle', f: 440, f2: 415, t: 0.11, d: 0.28, g: 0.07, a: 0.006 },
  ],
  found: [
    { type: 'sine', f: G4, t: 0, d: 0.32, g: 0.06, a: 0.01 },
    { type: 'sine', f: C5, t: 0.03, d: 0.32, g: 0.05, a: 0.01 },
    { type: 'sine', f: E5, t: 0.06, d: 0.34, g: 0.045, a: 0.01 },
    { type: 'sine', f: G5, t: 0.09, d: 0.36, g: 0.03, a: 0.01 },
  ],
  whistle: whistle(0, 0.45),
  trophy: [
    { type: 'triangle', f: G4, t: 0, d: 0.12, g: 0.07, a: 0.006 },
    { type: 'triangle', f: C5, t: 0.1, d: 0.12, g: 0.07, a: 0.006 },
    { type: 'triangle', f: E5, t: 0.2, d: 0.12, g: 0.07, a: 0.006 },
    { type: 'triangle', f: G5, t: 0.3, d: 0.5, g: 0.07, a: 0.006 },
    { type: 'triangle', f: E5, t: 0.3, d: 0.5, g: 0.045, a: 0.006 },
    { type: 'triangle', f: C5, t: 0.3, d: 0.5, g: 0.035, a: 0.006 },
  ],
  fulltime: [...whistle(0, 0.22), ...whistle(0.34, 0.22), ...whistle(0.68, 0.85, 0.032)],
};

export const SFX_IDS = Object.keys(SFX) as SfxId[];

/** 소리 길이(초). */
export const sfxSeconds = (id: SfxId) => Math.max(...SFX[id].map((n) => n.t + n.d));

const FLOOR = 0.0001;

/** 합성한 소리(모노, -1–1). 같은 입력이면 늘 같은 값이다(잡음도 고정 시드). */
export function renderSfx(id: SfxId, sampleRate: number): Float32Array {
  const out = new Float32Array(Math.ceil((sfxSeconds(id) + 0.02) * sampleRate));
  let seed = 0x2f6b1d;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 31 - 1;
  };
  for (const n of SFX[id]) {
    const start = Math.round(n.t * sampleRate);
    const len = Math.round(n.d * sampleRate);
    // 잡음 대역 필터(RBJ band-pass, Q 8).
    const w0 = (2 * Math.PI * n.f) / sampleRate;
    const alpha = Math.sin(w0) / (2 * 8);
    const a0 = 1 + alpha;
    const [b0, b2, a1, a2] = [alpha / a0, -alpha / a0, (-2 * Math.cos(w0)) / a0, (1 - alpha) / a0];
    let x1 = 0,
      x2 = 0,
      y1 = 0,
      y2 = 0;
    let phase = 0;
    for (let i = 0; i < len && start + i < out.length; i++) {
      const t = i / sampleRate;
      const env =
        t < n.a
          ? FLOOR * (n.g / FLOOR) ** (t / n.a)
          : n.g * (FLOOR / n.g) ** ((t - n.a) / (n.d - n.a));
      let v: number;
      if (n.type === 'noise') {
        const x = rand();
        v = b0 * x + b2 * x2 - a1 * y1 - a2 * y2;
        x2 = x1;
        x1 = x;
        y2 = y1;
        y1 = v;
      } else {
        let f = n.f2 ? n.f * (n.f2 / n.f) ** (t / n.d) : n.f;
        if (n.vib) f += n.vib.x * Math.sin(2 * Math.PI * n.vib.r * t);
        phase = (phase + f / sampleRate) % 1;
        v =
          n.type === 'sine'
            ? Math.sin(2 * Math.PI * phase)
            : n.type === 'square'
              ? phase < 0.5
                ? 1
                : -1
              : 1 - 4 * Math.abs(phase - 0.5);
      }
      out[start + i] = (out[start + i] ?? 0) + v * env;
    }
  }
  for (let i = 0; i < out.length; i++) out[i] = Math.max(-1, Math.min(1, out[i] ?? 0));
  return out;
}

/** 16비트 모노 WAV(앱 음원 만들기용). */
export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) =>
    [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + samples.length * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, samples.length * 2, true);
  samples.forEach((s, i) => v.setInt16(44 + i * 2, Math.round(s * 32767), true));
  return new Uint8Array(buf);
}

/** 같은 소리를 짧은 간격으로 겹쳐 틀지 않게(강화 연타). 틀어도 되면 true. */
export function createSfxGate(minGapMs = 120) {
  const last = new Map<SfxId, number>();
  return (id: SfxId, now: number): boolean => {
    const prev = last.get(id);
    if (prev !== undefined && now - prev < minGapMs) return false;
    last.set(id, now);
    return true;
  };
}
