// 배경음악 — 70초짜리 루프 음원을 Web Audio로 끊김 없이 되풀이한다. <audio loop>는 이음매에서 잠깐 끊기므로 디코딩한
// 버퍼를 AudioBufferSourceNode(loop)로 돌린다. 멈출 땐 소리를 줄인 뒤 컨텍스트를 suspend해 재생 위치를 그대로 두고,
// 다시 틀면 멈춘 자리에서 이어 간다(화면을 오가도 처음부터 다시 틀지 않는다). 처음 틀 때 bgm.svelte.ts가 불러온다.
import src from '../assets/bgm-loop.m4a?url';

const VOLUME = 0.35;
/** 켜고 끌 때 소리를 줄이고 키우는 시간(초). */
const FADE = 0.6;

export interface Bgm {
  play(): void;
  pause(): void;
}

export function createBgm(): Bgm {
  const ctx = new AudioContext();
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.connect(ctx.destination);
  let wanted = false;
  let stopAt: ReturnType<typeof setTimeout> | null = null;

  const fadeTo = (v: number) => {
    const t = ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(v, t + FADE);
  };

  // 받는 동안 켜 두었으면 받자마자 소리를 키운다. 못 받으면(네트워크·디코딩 실패) 조용히 넘어간다.
  void fetch(src)
    .then((r) => r.arrayBuffer())
    .then((b) => ctx.decodeAudioData(b))
    .then((buffer) => {
      const s = ctx.createBufferSource();
      s.buffer = buffer;
      s.loop = true;
      s.connect(gain);
      s.start();
      if (wanted) fadeTo(VOLUME);
    })
    .catch(() => {});

  return {
    play() {
      wanted = true;
      if (stopAt) clearTimeout(stopAt);
      stopAt = null;
      void ctx.resume();
      fadeTo(VOLUME);
    },
    pause() {
      if (!wanted) return;
      wanted = false;
      fadeTo(0);
      stopAt = setTimeout(() => {
        stopAt = null;
        void ctx.suspend();
      }, FADE * 1000);
    },
  };
}
