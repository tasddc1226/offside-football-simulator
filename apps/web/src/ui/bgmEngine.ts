// 배경음악 재생기. 곡은 둘 — main(게임·홈·소식·구단주·설정)과 records(기록실·선수 상세). 곡을 바꿀 땐 교차 페이드하고,
// 멈췄던 곡은 멈춘 자리에서 이어 간다(화면을 오가도 처음부터 다시 틀지 않는다).
//
// Web Audio가 아니라 <audio>로 튼다. 아이폰(WebKit)에서 Web Audio로 틀면 버퍼 크기와 상관없이 지지직거렸고, <audio>는
// 깨끗했다. 대신 아이폰은 <audio> 음량을 페이지에서 못 바꾼다(기기 음량 버튼만) — 그런 기기에선 페이드 없이 바로 바꾼다.
//
// 음원
// - main: LudoLoon Studio "Happy Wheels (Loop)" — https://ludoloonstudio.itch.io/happy-wheels-free-music
//   라이선스(https://ludoloon.studio/music): 상업 이용 가능, 출처 표기는 선택(설정 화면에 적는다), 곡 단독 재배포 금지.
// - records: Tunetank "Deep House Lounge Music"(Pixabay 349539) — Pixabay Content License: 상업 이용 가능, 표기 불필요,
//   곡 단독 재배포 금지. 원본이 0 dBFS를 넘게 마스터링돼 있어(피크 +1 dB) -5 dB 낮춰 인코딩했다 — 넘는 샘플을 잘라
//   내는 디코더에서 찌그러지지 않게 하고, main 곡과 크기(RMS -15 dB)도 맞춘다.
import mainSrc from '../assets/bgm-loop.m4a?url';
import recordsSrc from '../assets/bgm-records.m4a?url';

export type BgmTrack = 'main' | 'records';

const SRC: Record<BgmTrack, string> = { main: mainSrc, records: recordsSrc };
/** 설정 음량 100%일 때의 <audio> 음량. 효과음보다 한참 작게 — 기본 70%가 0.35다. */
const MAX_GAIN = 0.5;
/** 켜고 끌 때·곡을 바꿀 때 소리를 줄이고 키우는 시간(ms). */
const FADE_MS = 600;

let adjustable: boolean | undefined;
/** 페이지에서 <audio> 음량을 바꿀 수 있는지. 아이폰은 설정해도 1로 남는다. */
export function volumeAdjustable() {
  if (adjustable === undefined) {
    const probe = new Audio();
    probe.volume = 0.5;
    adjustable = probe.volume === 0.5;
  }
  return adjustable;
}

export interface Bgm {
  /** volume은 0–1(설정 슬라이더). 이미 그 곡을 틀고 있으면 음량만 바꾼다. */
  play(track: BgmTrack, volume: number): void;
  pause(): void;
}

export function createBgm(): Bgm {
  const els: Partial<Record<BgmTrack, HTMLAudioElement>> = {};
  const fading = new Map<HTMLAudioElement, ReturnType<typeof setInterval>>();
  let active: BgmTrack | null = null;

  /** 음량을 FADE_MS 동안 to로 옮기고 done을 부른다. 새 페이드가 오면 이전 것(과 done)은 취소된다. */
  function fade(el: HTMLAudioElement, to: number, done?: () => void) {
    clearInterval(fading.get(el));
    fading.delete(el);
    if (!volumeAdjustable()) return done?.();
    const from = el.volume;
    const t0 = performance.now();
    const id = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / FADE_MS);
      el.volume = from + (to - from) * k;
      if (k < 1) return;
      clearInterval(id);
      fading.delete(el);
      done?.();
    }, 30);
    fading.set(el, id);
  }
  const stop = (el: HTMLAudioElement) => fade(el, 0, () => el.pause());

  return {
    play(track, volume) {
      if (active && active !== track) stop(els[active]!);
      active = track;
      const el = (els[track] ??= Object.assign(new Audio(SRC[track]), { loop: true, volume: 0 }));
      // 못 틀면(자동 재생 제한·네트워크) 조용히 넘어간다. 다음 터치에 다시 시도한다(bgm.svelte.ts).
      void el.play().catch(() => {});
      fade(el, MAX_GAIN * volume);
    },
    pause() {
      if (!active) return;
      stop(els[active]!);
      active = null;
    },
  };
}
