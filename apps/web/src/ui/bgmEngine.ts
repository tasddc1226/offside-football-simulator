// 배경음악 — 70초짜리 루프 음원을 Web Audio로 끊김 없이 되풀이한다. <audio loop>는 이음매에서 잠깐 끊기므로 디코딩한
// 버퍼를 AudioBufferSourceNode(loop)로 돌린다. 멈출 땐 소리를 줄인 뒤 컨텍스트를 suspend해 재생 위치를 그대로 두고,
// 다시 틀면 멈춘 자리에서 이어 간다(화면을 오가도 처음부터 다시 틀지 않는다). 처음 틀 때 bgm.svelte.ts가 불러온다.
// 음원: LudoLoon Studio "Happy Wheels (Loop)" — https://ludoloonstudio.itch.io/happy-wheels-free-music
// 라이선스(https://ludoloon.studio/music): 상업 이용 가능, 출처 표기는 선택(설정 화면에 적는다), 곡 단독 재배포 금지.
import src from '../assets/bgm-loop.m4a?url';

/** 설정 음량 100%일 때의 게인. 효과음보다 한참 작게 — 기본 70%가 0.35다. */
const MAX_GAIN = 0.5;
/** 켜고 끌 때 소리를 줄이고 키우는 시간(초). */
const FADE = 0.6;

export interface Bgm {
  /** volume은 0–1(설정 슬라이더). 이미 틀고 있으면 음량만 바꾼다. */
  play(volume: number): void;
  pause(): void;
}

export function createBgm(): Bgm {
  const ctx = new AudioContext();
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.connect(ctx.destination);
  let wanted = false;
  let level = 0;
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
      if (wanted) fadeTo(level);
    })
    .catch(() => {});

  return {
    play(volume) {
      level = MAX_GAIN * volume;
      wanted = true;
      if (stopAt) clearTimeout(stopAt);
      stopAt = null;
      void ctx.resume();
      fadeTo(level);
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
