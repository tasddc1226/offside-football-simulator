// 배경음악 합성기 — 음원 파일 없이 Web Audio로 짧은 루프를 연주한다(효과음 sfx.ts와 같은 방식, 용량·라이선스 부담 없음).
// 92 BPM, D장조 I–V–vi–IV 네 마디를 두 번: 앞은 패드·베이스·아르페지오, 뒤는 멜로디를 얹는다. 북은 킥·하이햇만 옅게.
// 처음 켤 때 bgm.svelte.ts가 불러온다(첫 화면 번들 밖).

const BPM = 92;
/** 8분음표 길이(초). 한 마디 = 8스텝. */
const STEP = 60 / BPM / 2;
const BAR = 8;
/** 전체 음량 — 효과음보다 한참 작게. */
const VOLUME = 0.45;
/** D · A · Bm · G (MIDI). */
const CHORDS = [
  [50, 54, 57],
  [45, 49, 52],
  [47, 50, 54],
  [43, 47, 50],
];
/** 뒤 네 마디의 멜로디(8분음표, null은 쉼 — 앞 음을 늘인다). */
// prettier-ignore
const MELODY: (number | null)[] = [
  69, null, 74, null, 73, 71, 69, null,
  73, null, 71, null, 69, null, 64, null,
  66, null, 71, null, 74, 73, 71, null,
  71, null, 69, null, 67, null, 66, null,
];
/** 아르페지오 — 화음 구성음 순서(0~2, 3은 한 옥타브 위 근음). */
const ARP = [0, 1, 2, 3, 2, 1, 2, 1];
const LOOP = CHORDS.length * BAR * 2;
/** 스케줄러가 미리 잡아 두는 구간(초)과 깨어나는 간격(ms). */
const AHEAD = 0.25;
const TICK_MS = 60;

const hz = (m: number) => 440 * 2 ** ((m - 69) / 12);

export interface Bgm {
  play(): void;
  pause(): void;
}

export function createBgm(): Bgm {
  const ctx = new AudioContext();
  const master = ctx.createGain();
  master.gain.value = 0;
  const comp = ctx.createDynamicsCompressor();
  master.connect(comp).connect(ctx.destination);

  // 아르페지오·멜로디용 공간감(짧은 딜레이).
  const delay = ctx.createDelay(1);
  delay.delayTime.value = STEP * 3;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.28;
  const wet = ctx.createGain();
  wet.gain.value = 0.22;
  delay.connect(feedback).connect(delay);
  delay.connect(wet).connect(master);

  const padBus = ctx.createBiquadFilter();
  padBus.type = 'lowpass';
  padBus.frequency.value = 900;
  padBus.connect(master);

  const noise = ctx.createBuffer(1, ctx.sampleRate / 2, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  function voice(
    type: OscillatorType,
    freq: number,
    t: number,
    len: number,
    peak: number,
    out: AudioNode,
    { attack = 0.01, detune = 0 } = {},
  ) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = detune;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + len + 0.05);
    return g;
  }

  function pad(chord: number[], t: number) {
    const len = STEP * BAR + 0.4;
    for (const n of chord)
      for (const detune of [-7, 7])
        voice('sawtooth', hz(n + 12), t, len, 0.022, padBus, { attack: 0.35, detune });
  }

  function kick(t: number) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + 0.2);
  }

  function hat(t: number, peak: number) {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(f).connect(g).connect(master);
    src.start(t);
    src.stop(t + 0.06);
  }

  function note(step: number, t: number) {
    const i = step % LOOP;
    const bar = Math.floor(i / BAR) % CHORDS.length;
    const beat = i % BAR;
    const chord = CHORDS[bar]!;
    const second = i >= LOOP / 2;

    if (beat === 0) pad(chord, t);
    // 베이스: 1·3박과 4박 뒷박.
    if (beat === 0 || beat === 4 || beat === 7)
      voice('triangle', hz(chord[0]! - 12), t, STEP * 1.6, 0.2, master);
    if (beat % 4 === 0) kick(t);
    hat(t, beat % 2 ? 0.05 : 0.025);

    const arp = ARP[beat]!;
    const a = arp === 3 ? chord[0]! + 12 : chord[arp]!;
    const pluck = voice('triangle', hz(a + 12), t, STEP * 0.9, second ? 0.035 : 0.06, master);
    pluck.connect(delay);

    if (second) {
      const m = MELODY[i - LOOP / 2];
      if (m != null) {
        let len = 1;
        while (MELODY[i - LOOP / 2 + len] === null && len < 3) len++;
        const lead = voice('square', hz(m), t, STEP * len * 0.95, 0.045, master, { attack: 0.02 });
        lead.connect(delay);
      }
    }
  }

  let step = 0;
  let next = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  let stopAt: ReturnType<typeof setTimeout> | null = null;

  function schedule() {
    while (next < ctx.currentTime + AHEAD) {
      note(step++, next);
      next += STEP;
    }
  }

  return {
    play() {
      if (stopAt) clearTimeout(stopAt);
      stopAt = null;
      void ctx.resume();
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(master.gain.value, t);
      master.gain.linearRampToValueAtTime(VOLUME, t + 1.2);
      if (timer) return;
      next = t + 0.05;
      schedule();
      timer = setInterval(schedule, TICK_MS);
    },
    pause() {
      if (!timer || stopAt) return;
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(master.gain.value, t);
      master.gain.linearRampToValueAtTime(0, t + 0.5);
      stopAt = setTimeout(() => {
        clearInterval(timer!);
        timer = stopAt = null;
        void ctx.suspend();
      }, 550);
    },
  };
}
