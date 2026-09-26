// 클릭 효과음. 음원 파일 없이 Web Audio로 짧은 '톡' 소리를 합성한다(용량·라이선스 부담 없음).
// 버튼·링크 등 눌리는 요소를 클릭할 때만 난다. 설정에서 끌 수 있고, 이 기기에만 저장된다(ft_sfx).
import { loadKey, saveKey } from '../game/season.js';

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

function tick() {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
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
      if (!enabled) return;
      const el = (e.target as Element | null)?.closest?.(CLICKABLE);
      if (el && !(el as HTMLButtonElement).disabled) tick();
    },
    { capture: true, passive: true },
  );
}
