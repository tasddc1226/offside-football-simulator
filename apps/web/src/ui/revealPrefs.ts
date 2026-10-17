// T-11-371 공개 연출 설정 · 소리. 선수 만들기 · 선수 탭 · 은퇴 리포트 · 설정 청크에서만 불러온다(첫 화면 번들 밖).
import { loadKey, saveKey } from '@offside/game/storage';
import { REVEAL_SHORT_KEY, type RevealTier } from '@offside/app-core/reveal';
import { sfxEnabled } from './sfx.js';
import { sheetOn } from './skin.svelte.js';

/** "연출 짧게" — 이 기기에만 저장한다. */
export const revealShort = (): boolean => loadKey<boolean>(REVEAL_SHORT_KEY) === true;
export const setRevealShort = (on: boolean) => saveKey(REVEAL_SHORT_KEY, on);

let ctx: AudioContext | null = null;
/** 음원 파일 없이 합성한 짧은 음(sfx.ts와 같은 방식). 단서 · 결과 · 대박. 효과음 설정(ft_sfx)과 업무 모드를 따른다. */
export function revealTone(kind: 'hint' | RevealTier) {
  if (!sfxEnabled() || sheetOn() || kind === 'normal') return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    const notes = kind === 'hint' ? [660] : kind === 'good' ? [660, 880] : [660, 880, 1320];
    notes.forEach((f, i) => {
      const t = ctx!.currentTime + i * 0.09;
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(kind === 'hint' ? 0.05 : 0.1, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(t);
      osc.stop(t + 0.18);
    });
  } catch {
    // 오디오를 못 쓰는 환경은 조용히 넘어간다.
  }
}
