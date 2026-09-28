// 배경음악 재생기. 곡은 둘 — main(게임·홈·소식·구단주·설정)과 records(기록실·선수 상세). 곡을 바꿀 땐 교차 페이드하고,
// 멈췄던 곡은 멈춘 자리에서 이어 간다(화면을 오가도 처음부터 다시 틀지 않는다). 처음 틀 때 bgm.svelte.ts가 불러온다.
//
// 음원
// - main: LudoLoon Studio "Happy Wheels (Loop)" — https://ludoloonstudio.itch.io/happy-wheels-free-music
//   라이선스(https://ludoloon.studio/music): 상업 이용 가능, 출처 표기는 선택(설정 화면에 적는다), 곡 단독 재배포 금지.
// - records: Tunetank "Deep House Lounge Music"(Pixabay 349539) — Pixabay Content License: 상업 이용 가능, 표기 불필요,
//   곡 단독 재배포 금지.
import mainSrc from '../assets/bgm-loop.m4a?url';
import recordsSrc from '../assets/bgm-records.m4a?url';

export type BgmTrack = 'main' | 'records';

/** 설정 음량 100%일 때의 게인. 효과음보다 한참 작게 — 기본 70%가 0.35다. */
const MAX_GAIN = 0.5;
/** 켜고 끌 때·곡을 바꿀 때 소리를 줄이고 키우는 시간(초). */
const FADE = 0.6;

export interface Bgm {
  /** volume은 0–1(설정 슬라이더). 이미 그 곡을 틀고 있으면 음량만 바꾼다. */
  play(track: BgmTrack, volume: number): void;
  pause(): void;
}

interface Track {
  gain: GainNode;
  start(): void;
  stop(): void;
}

export function createBgm(): Bgm {
  const ctx = new AudioContext();
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);

  const ramp = (p: AudioParam, v: number) => {
    const t = ctx.currentTime;
    p.cancelScheduledValues(t);
    p.setValueAtTime(p.value, t);
    p.linearRampToValueAtTime(v, t + FADE);
  };
  const trackGain = () => {
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(master);
    return g;
  };

  /** 70초 루프 — 이음매가 끊기지 않게 디코딩한 버퍼를 loop로 돌리고, 멈출 때 위치를 기억해 그 자리에서 다시 튼다. */
  function looped(src: string): Track {
    const gain = trackGain();
    let buffer: AudioBuffer | null = null;
    let node: AudioBufferSourceNode | null = null;
    let on = false;
    let offset = 0;
    let startedAt = 0;
    const begin = () => {
      if (!buffer || node) return;
      node = ctx.createBufferSource();
      node.buffer = buffer;
      node.loop = true;
      node.connect(gain);
      startedAt = ctx.currentTime;
      node.start(0, offset);
    };
    // 못 받으면(네트워크·디코딩 실패) 조용히 넘어간다.
    void fetch(src)
      .then((r) => r.arrayBuffer())
      .then((b) => ctx.decodeAudioData(b))
      .then((b) => {
        buffer = b;
        if (on) begin();
      })
      .catch(() => {});
    return {
      gain,
      start() {
        on = true;
        begin();
      },
      stop() {
        on = false;
        if (!node || !buffer) return;
        offset = (offset + ctx.currentTime - startedAt) % buffer.duration;
        node.stop();
        node.disconnect();
        node = null;
      },
    };
  }

  /** 172초짜리 긴 곡 — 통째로 디코딩하면 메모리가 커서 <audio>로 흘려 받으며 되풀이한다. */
  function streamed(src: string): Track {
    const gain = trackGain();
    const el = new Audio(src);
    el.loop = true;
    ctx.createMediaElementSource(el).connect(gain);
    return {
      gain,
      start: () => void el.play().catch(() => {}),
      stop: () => el.pause(),
    };
  }

  const make: Record<BgmTrack, () => Track> = {
    main: () => looped(mainSrc),
    records: () => streamed(recordsSrc),
  };
  const tracks: Partial<Record<BgmTrack, Track>> = {};
  const stopping = new Map<Track, ReturnType<typeof setTimeout>>();
  let active: BgmTrack | null = null;
  let suspendAt: ReturnType<typeof setTimeout> | null = null;

  /** 소리를 줄인 뒤 멈춘다. 그 사이 다시 틀면 취소된다. */
  function fadeOut(t: Track) {
    ramp(t.gain.gain, 0);
    clearTimeout(stopping.get(t));
    stopping.set(
      t,
      setTimeout(() => {
        stopping.delete(t);
        t.stop();
      }, FADE * 1000),
    );
  }

  return {
    play(track, volume) {
      if (suspendAt) clearTimeout(suspendAt);
      suspendAt = null;
      void ctx.resume();
      ramp(master.gain, MAX_GAIN * volume);
      if (active === track) return;
      if (active) fadeOut(tracks[active]!);
      const t = (tracks[track] ??= make[track]());
      clearTimeout(stopping.get(t));
      stopping.delete(t);
      t.start();
      ramp(t.gain.gain, 1);
      active = track;
    },
    pause() {
      if (!active || suspendAt) return;
      const t = tracks[active]!;
      ramp(master.gain, 0);
      suspendAt = setTimeout(() => {
        suspendAt = null;
        t.stop();
        t.gain.gain.value = 0;
        active = null;
        void ctx.suspend();
      }, FADE * 1000);
    },
  };
}
