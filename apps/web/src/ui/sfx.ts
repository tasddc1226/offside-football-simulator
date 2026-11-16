// 클릭 효과음. 음원 파일 없이 Web Audio로 짧은 '톡' 소리를 합성한다(용량·라이선스 부담 없음).
// 버튼·링크 등 눌리는 요소를 클릭할 때만 난다. 설정에서 끌 수 있고, 이 기기에만 저장된다(ft_sfx).
// T-11-738 결과 효과음(playSfx)도 같은 설정 · 같은 오디오를 쓴다. 소리 설계는 @offside/app-core/sfx(앱과 같은 소리).
import type { SfxId } from '@offside/app-core/sfx';
import { loadKey, saveKey } from '@offside/game/storage';
import { sheetOn } from './skin.svelte.js';

const KEY = 'ft_sfx';
const CLICKABLE =
  'button, a[href], summary, label, select, [role="button"], input[type="checkbox"], input[type="radio"]';

let enabled = loadKey<boolean>(KEY) ?? true;
let ctx: AudioContext | null = null;

export const sfxEnabled = () => enabled;
export function setSfxEnabled(on: boolean) {
  enabled = on;
  saveKey(KEY, on);
}

/** 오디오를 깨운다. 아이폰은 사용자 동작 안에서 만들거나 깨운 컨텍스트만 소리를 내므로 클릭 처리 안에서 먼저 부른다. */
function audio(): AudioContext {
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tick() {
  try {
    const ctx = audio();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(900, t);
    osc.frequency.exponentialRampToValueAtTime(520, t + 0.05);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.12, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.08);
  } catch {
    // 오디오를 못 쓰는 환경(권한·미지원)은 조용히 넘어간다.
  }
}

export function installClickSound() {
  document.addEventListener(
    'click',
    (e) => {
      // T-11-022 업무 모드에서는 소리를 내지 않는다.
      if (!enabled || sheetOn()) return;
      const el = (e.target as Element | null)?.closest?.(CLICKABLE);
      if (!el || (el as HTMLButtonElement).disabled) return;
      try {
        audio();
      } catch {
        return;
      }
      // 같은 클릭이 결과음을 냈으면(중계 건너뛰기 등) 클릭음은 뺀다 — 버튼 처리가 끝난 뒤에 판단한다.
      const at = performance.now();
      setTimeout(() => lastSfxAt < at && tick(), 0);
    },
    { capture: true, passive: true },
  );
}

// ───────── T-11-738 결과 효과음 ─────────
type Sfx = typeof import('@offside/app-core/sfx');
let lib: Promise<Sfx> | null = null;
let gate: ((id: SfxId, now: number) => boolean) | null = null;
const buffers = new Map<SfxId, AudioBuffer>();
let lastSfxAt = -Infinity;

/** 결과 효과음을 튼다. 효과음이 꺼졌거나 업무 모드면 아무것도 하지 않는다. 합성 코드는 처음 틀 때 받는다(첫 화면 번들 밖). */
export function playSfx(id: SfxId): void {
  if (!enabled || sheetOn()) return;
  lastSfxAt = performance.now();
  let c: AudioContext;
  try {
    c = audio();
  } catch {
    return;
  }
  lib ??= import('@offside/app-core/sfx');
  void lib
    .then((m) => {
      gate ??= m.createSfxGate();
      if (!gate(id, performance.now())) return;
      let buf = buffers.get(id);
      if (!buf) {
        const pcm = m.renderSfx(id, c.sampleRate);
        buf = c.createBuffer(1, pcm.length, c.sampleRate);
        buf.getChannelData(0).set(pcm);
        buffers.set(id, buf);
      }
      const src = c.createBufferSource();
      src.buffer = buf;
      src.connect(c.destination);
      src.start();
    })
    .catch(() => {
      // 오디오를 못 쓰거나 청크를 못 받았으면 조용히 넘어간다.
    });
}
