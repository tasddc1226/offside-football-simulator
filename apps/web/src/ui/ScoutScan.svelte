<script lang="ts">
  // T-10-111 "후보 3명 보기"를 누르면 약 3초 동안 화면을 가리고 스카우트가 후보를 추리는 연출을 보여 준다.
  // 스캔 빔이 피치를 훑으며 선수 점을 찍고, 마지막 훑기에서 내 포지션 구역의 세 명이 금색으로 확정된다.
  // 연출용 난수는 Math.random이다(게임 RNG를 건드리지 않는다). 탭·Esc로 건너뛸 수 있고, 감속 모션이면
  // 빔 없이 짧게 단계만 넘긴다.
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import type { Pos } from '../game/data.js';
  import { buzz, dur, motionOK } from './motion.js';

  let { pos, steps, onDone }: { pos: Pos; steps: string[]; onDone: () => void } = $props();

  const TOTAL = motionOK ? 3000 : 1200;
  /** 빔이 피치를 한 번 훑는 시간 — 세 번째(마지막) 훑기에서 후보를 확정한다. */
  const PASS = TOTAL / 3;
  const HOLD = 350;

  // 공격 방향은 오른쪽. 포지션별로 후보가 잡히는 가로 구역(%).
  const ZONE: Record<Pos, [number, number]> = { GK: [5, 9], DF: [14, 36], MF: [40, 64], FW: [68, 90] };
  const rand = (a: number, b: number) => a + Math.random() * (b - a);
  // 연출은 한 번만 그린다 — 열려 있는 동안 포지션이 바뀌지 않는다.
  // svelte-ignore state_referenced_locally
  const [z0, z1] = ZONE[pos];
  // 스캔된 선수: 앞의 두 번 훑기 중 빔이 지나갈 때 나타난다. 후보: 마지막 훑기에서 빔이 지나갈 때 확정된다.
  const dots = Array.from({ length: 16 }, () => {
    const x = rand(4, 96);
    return { x, y: rand(10, 90), at: (Math.floor(rand(0, 2)) + x / 100) * PASS };
  });
  const picks = [0, 1, 2]
    .map((i) => {
      const x = pos === 'GK' ? rand(z0, z1) : z0 + ((z1 - z0) * (i + rand(0.15, 0.85))) / 3;
      return { x, y: pos === 'GK' ? 50 + (i - 1) * 16 : rand(18, 82), at: (2 + x / 100) * PASS };
    })
    .sort((a, b) => a.at - b.at);
  const scanned = Math.round(rand(1100, 1600));

  let t = $state(0);
  const p = $derived(Math.min(1, t / TOTAL));
  const count = $derived(Math.round(scanned * (1 - (1 - p) ** 2)));
  const active = $derived(Math.min(steps.length - 1, Math.floor(p * steps.length)));
  const beam = $derived(((t % PASS) / PASS) * 100);
  const locked = $derived(picks.filter((k) => t >= k.at).length);

  let finished = false;
  function finish() {
    if (finished) return;
    finished = true;
    onDone();
  }

  onMount(() => {
    const start = performance.now();
    let raf = 0;
    let lastLocked = 0;
    const tick = (now: number) => {
      t = now - start;
      if (locked > lastLocked) {
        lastLocked = locked;
        buzz(8);
      }
      if (t >= TOTAL + HOLD) return finish();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') finish();
    };
    addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('keydown', onKey);
    };
  });
</script>

<!-- 키보드 건너뛰기(Esc·Enter·Space)는 window keydown이 맡는다. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<div class="scout-scan" data-scout-scan role="status" aria-live="polite" onclick={finish} transition:fade={{ duration: dur(200) }}>
  <div class="ss-card">
    <div class="eyebrow">Scouting</div>
    <h2>스카우트가 후보를 추리는 중</h2>

    <div class="ss-pitch" aria-hidden="true">
      <svg viewBox="0 0 160 100" preserveAspectRatio="none">
        <rect x="3" y="3" width="154" height="94" />
        <line x1="80" y1="3" x2="80" y2="97" />
        <circle cx="80" cy="50" r="12" />
        <rect x="3" y="28" width="20" height="44" />
        <rect x="137" y="28" width="20" height="44" />
      </svg>
      <span class="ss-zone" style:left="{z0}%" style:width="{z1 - z0}%"></span>
      {#each dots as d, i (i)}
        <i class="ss-dot" class:on={t >= d.at} style:left="{d.x}%" style:top="{d.y}%"></i>
      {/each}
      {#each picks as k, i (i)}
        <i class="ss-pick" class:on={t >= k.at} style:left="{k.x}%" style:top="{k.y}%"><b>{i + 1}</b></i>
      {/each}
      {#if motionOK && t < TOTAL}<span class="ss-beam" style:left="{beam}%"></span>{/if}
    </div>

    <div class="ss-count">
      <span>분석한 선수 <b class="num">{count.toLocaleString('ko-KR')}</b>명</span>
      <span>후보 <b class="num">{locked}</b>/3</span>
    </div>
    <div class="ss-bar"><i style:width="{p * 100}%"></i></div>

    <ol class="ss-steps">
      {#each steps as s, i (i)}
        {@const done = p >= 1 || i < active}
        <li class:done class:now={!done && i === active} class:wait={i > active}>
          <span class="ss-mark" aria-hidden="true">{done ? '✓' : i === active ? '' : '·'}</span>{s}
        </li>
      {/each}
    </ol>
    <p class="ss-skip">{p >= 1 ? '후보 3명 선정 완료!' : '탭하면 건너뛰기'}</p>
  </div>
</div>

<style>
  .scout-scan {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: grid;
    place-items: center;
    padding: 16px;
    background: color-mix(in srgb, var(--bg) 88%, transparent);
    backdrop-filter: blur(6px);
    cursor: pointer;
  }
  .ss-card {
    width: min(100%, 420px);
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 18px 16px 14px;
    border-radius: 16px;
    background: var(--surface);
    border: 1px solid var(--line);
    box-shadow: var(--shadow);
  }
  h2 {
    margin: 0;
    font-size: 1.15rem;
  }
  .ss-pitch {
    position: relative;
    aspect-ratio: 16 / 10;
    border-radius: 10px;
    overflow: hidden;
    background: repeating-linear-gradient(90deg, var(--pitch) 0 10%, var(--pitch-2) 10% 20%);
  }
  .ss-pitch svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    fill: none;
    stroke: var(--chalk);
    stroke-width: 0.8;
    vector-effect: non-scaling-stroke;
  }
  .ss-zone {
    position: absolute;
    top: 3%;
    bottom: 3%;
    background: color-mix(in srgb, var(--pitch-accent) 12%, transparent);
    border-inline: 1px dashed color-mix(in srgb, var(--pitch-accent) 45%, transparent);
  }
  .ss-dot,
  .ss-pick {
    position: absolute;
    translate: -50% -50%;
    border-radius: 50%;
    opacity: 0;
    scale: 0.3;
    transition:
      opacity 0.18s,
      scale 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .ss-dot {
    width: 7px;
    height: 7px;
    background: var(--on-pitch);
  }
  .ss-dot.on {
    opacity: 0.55;
    scale: 1;
  }
  .ss-pick {
    width: 22px;
    height: 22px;
    display: grid;
    place-items: center;
    background: var(--pitch-accent);
    color: var(--accent-ink);
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--pitch-accent) 30%, transparent);
    font: 700 0.8rem var(--display);
  }
  .ss-pick.on {
    opacity: 1;
    scale: 1;
  }
  .ss-beam {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 28%;
    translate: -100% 0;
    background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--pitch-accent) 28%, transparent));
    border-right: 2px solid var(--pitch-accent);
    pointer-events: none;
  }
  .ss-count {
    display: flex;
    justify-content: space-between;
    font-size: 0.85rem;
    color: var(--muted);
  }
  .ss-count b {
    font-size: 1.05rem;
    color: var(--ink);
  }
  .ss-bar {
    height: 4px;
    border-radius: 2px;
    background: var(--surface-2);
    overflow: hidden;
  }
  .ss-bar i {
    display: block;
    height: 100%;
    background: var(--accent);
  }
  .ss-steps {
    list-style: none;
    margin: 2px 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 0.88rem;
  }
  .ss-steps li {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .ss-steps li.wait {
    color: var(--muted);
  }
  .ss-steps li.done {
    color: var(--good);
  }
  .ss-steps li.now {
    font-weight: 600;
  }
  .ss-mark {
    width: 16px;
    height: 16px;
    flex: none;
    display: grid;
    place-items: center;
    font-size: 0.75rem;
  }
  .now .ss-mark {
    border: 2px solid var(--accent);
    border-right-color: transparent;
    border-radius: 50%;
    animation: ss-spin 0.7s linear infinite;
  }
  .ss-skip {
    margin: 2px 0 0;
    text-align: center;
    font-size: 0.8rem;
    color: var(--muted);
  }
  @keyframes ss-spin {
    to {
      rotate: 360deg;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .ss-dot,
    .ss-pick {
      transition: none;
    }
    .now .ss-mark {
      animation: none;
    }
  }
</style>
