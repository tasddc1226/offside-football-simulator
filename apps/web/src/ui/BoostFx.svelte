<script lang="ts">
  // T-11-083 잠재력 강화 연출. 결과는 이미 정해져 저장된 뒤에 연다 — 연출은 보여 주기만 한다(닫거나 새로고침해도 결과는 같다).
  // 1) 강화 중: 게이지가 차오르며 확률 표시가 깜박인다. 2) 결과: 성공이면 단계 칸이 하나 켜지고, 실패면 흔들린다.
  // 결과 화면은 눌러서 닫는다. 감속 모션이면 게이지 없이 짧게 결과로 넘어간다.
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import type { BoostOutcome } from '@offside/app-core/boost-view';
  import { buzz, dur, motionOK } from './motion.js';
  import { gameBoostText as L } from '@offside/app-core/i18n/ko/gameBoost';

  let { out, onDone }: { out: BoostOutcome; onDone: () => void } = $props();

  const ROLL = motionOK ? 1600 : 300;
  let done = $state(false);
  let p = $state(0);
  let closeBtn = $state<HTMLButtonElement>();
  // 강화 중에는 결과 전 단계, 결과에서는 결과 단계를 켠다.
  const lit = $derived(done || !out.ok ? out.lv : out.lv - 1);

  onMount(() => {
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      // 끝으로 갈수록 느려진다 — 마지막 순간에 숨을 죽이게.
      const x = Math.min(1, (now - t0) / ROLL);
      p = 1 - (1 - x) ** 3;
      if (x < 1) raf = requestAnimationFrame(tick);
      else {
        done = true;
        buzz(out.ok ? 40 : 15);
        queueMicrotask(() => closeBtn?.focus());
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  });

  function onkeydown(e: KeyboardEvent) {
    if (done && e.key === 'Escape') onDone();
  }
</script>

<svelte:window {onkeydown} />

<div class="boost-fx" class:ok={done && out.ok} class:fail={done && !out.ok} data-boost-fx={done ? (out.ok ? 'ok' : 'fail') : 'rolling'} role="dialog" aria-modal="true" aria-label={L.title} transition:fade={{ duration: dur(180) }}>
  <div class="bf-card" aria-live="polite">
    <div class="eyebrow">Potential</div>
    <div class="bf-steps" aria-hidden="true">
      {#each { length: out.max } as _, i (i)}
        <i class:on={i < lit} class:new={done && out.ok && i === out.lv - 1}></i>
      {/each}
    </div>
    {#if !done}
      <h2>{L.rolling}</h2>
      <div class="bf-gauge" aria-hidden="true"><span style={`width:${p * 100}%`}></span></div>
      <p class="muted fs-sm">{L.chance({ n: out.chance })}</p>
    {:else}
      <h2 class="bf-title">{out.title}</h2>
      <p class="fs-sm">{out.text}</p>
      <button class="btn btn-primary btn-block" data-act="boost-fx-close" bind:this={closeBtn} onclick={onDone}>{L.close}</button>
    {/if}
  </div>
</div>

<style>
  .boost-fx {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: grid;
    place-items: center;
    padding: 16px;
    background: rgb(0 0 0 / 0.62);
  }
  .bf-card {
    width: min(360px, 100%);
    padding: 22px 20px 18px;
    border-radius: 18px;
    background: var(--surface);
    border: 1px solid var(--line);
    text-align: center;
    display: grid;
    gap: 10px;
  }
  .bf-steps {
    display: flex;
    justify-content: center;
    gap: 10px;
  }
  .bf-steps i {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 2px solid var(--line);
  }
  .bf-steps i.on {
    background: var(--accent);
    border-color: var(--accent);
  }
  .bf-steps i.new {
    animation: bf-pop 0.5s ease-out;
  }
  .bf-gauge {
    height: 10px;
    border-radius: 99px;
    background: var(--line);
    overflow: hidden;
  }
  .bf-gauge span {
    display: block;
    height: 100%;
    background: var(--accent);
    animation: bf-flicker 0.24s infinite alternate;
  }
  .ok .bf-title {
    color: var(--accent-text);
  }
  .fail .bf-title {
    color: var(--bad);
  }
  .fail .bf-card {
    animation: bf-shake 0.36s ease-in-out;
  }
  @keyframes bf-pop {
    0% {
      transform: scale(0.4);
    }
    60% {
      transform: scale(1.5);
    }
    100% {
      transform: scale(1);
    }
  }
  @keyframes bf-flicker {
    to {
      opacity: 0.6;
    }
  }
  @keyframes bf-shake {
    25% {
      transform: translateX(-8px);
    }
    50% {
      transform: translateX(6px);
    }
    75% {
      transform: translateX(-3px);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .bf-steps i.new,
    .bf-gauge span,
    .fail .bf-card {
      animation: none;
    }
  }
</style>
