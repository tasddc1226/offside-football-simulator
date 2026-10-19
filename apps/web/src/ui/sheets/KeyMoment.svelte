<script lang="ts">
  // T-11-390 구간 중계가 멈추고 뜨는 결정적 장면 카드 — 선택지를 고르거나 15초가 지나면 감독에게 맡긴다. 고른 뒤엔 결과 줄을 보여 준다.
  import type { MomentView } from '@offside/app-core/sheets';
  import { keyMomentText as K } from '@offside/app-core/i18n/ko/keyMoment';
  let { m }: { m: MomentView } = $props();
</script>

<div class="km" class:crisis={m.kind === 'crisis'} class:final={m.final} data-key-moment={m.key} role="group" aria-label={m.title}>
  <p class="km-head"><b>{m.title}</b><span>{m.head}</span></p>
  <p class="km-scene">{m.scene}</p>
  {#if m.result}
    <p class="km-result" class:ok={m.result.ok} aria-live="polite" data-key-moment-result={m.result.ok ? 'ok' : 'fail'}>
      <small>{m.result.picked}</small>
      <b>{m.result.text}</b>
    </p>
  {:else}
    <div class="km-choices">
      {#each m.choices as c (c.id)}
        <button class="km-choice" onclick={() => m.choose(c.id)} data-key-moment-choice={c.id}>
          <span class="km-label">{c.label}</span>
          <b class="km-pct">{K.pct({ p: c.pct })}</b>
          <small class="km-attr">{K.attr({ attr: c.attr })}</small>
        </button>
      {/each}
    </div>
    <div class="km-timer" aria-hidden="true"><i style:width="{(m.left / m.secs) * 100}%"></i></div>
    <p class="km-hint">{K.timer({ n: m.left })}</p>
    <button class="btn km-auto" onclick={() => m.choose('auto')} data-key-moment-choice="auto">
      {K.auto} · {K.pct({ p: m.auto })}
    </button>
  {/if}
</div>

<style>
  .km {
    display: grid;
    gap: 10px;
    margin: 12px 0 4px;
    padding: 14px;
    border-radius: 14px;
    border: 1px solid var(--good);
    background: var(--surface-2);
  }
  .km.crisis {
    border-color: var(--bad);
  }
  .km-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
    margin: 0;
    font-family: var(--display);
    letter-spacing: 0.04em;
  }
  .km-head b {
    font-size: 1.125rem;
    color: var(--good);
  }
  .km.crisis .km-head b {
    color: var(--bad);
  }
  .km-head span {
    color: var(--muted);
    font-size: 0.8125rem;
    text-align: right;
  }
  .km-scene,
  .km-hint {
    margin: 0;
    line-height: 1.5;
  }
  .km-hint {
    color: var(--muted);
    font-size: 0.8125rem;
  }
  .km-choices {
    display: grid;
    gap: 6px;
  }
  .km-choice {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 2px 10px;
    min-height: 48px;
    padding: 8px 12px;
    border-radius: 10px;
    border: 1px solid var(--line);
    background: var(--surface);
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .km-choice:hover,
  .km-choice:focus-visible {
    border-color: var(--good);
  }
  .km-label {
    font-weight: 700;
  }
  .km-pct {
    font-family: var(--display);
    font-size: 1.125rem;
    font-variant-numeric: tabular-nums;
  }
  .km-attr {
    grid-column: 1 / -1;
    color: var(--muted);
    font-size: 0.75rem;
  }
  .km-timer {
    height: 4px;
    border-radius: 2px;
    background: var(--line);
    overflow: hidden;
  }
  .km-timer i {
    display: block;
    height: 100%;
    background: var(--good);
    transition: width 1s linear;
  }
  .km-auto {
    justify-self: center;
    min-height: 44px;
  }
  .km-result {
    display: grid;
    gap: 4px;
    margin: 0;
  }
  .km-result small {
    color: var(--muted);
  }
  .km-result b {
    font-size: 1.0625rem;
    color: var(--bad);
  }
  .km-result.ok b {
    color: var(--good);
  }
  @media (prefers-reduced-motion: reduce) {
    .km-timer i {
      transition: none;
    }
  }
</style>
