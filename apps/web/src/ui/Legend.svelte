<script lang="ts">
  // T-10-005 은퇴 선수 상세 — 명예의 전당 · 구단주의 내 선수에서 언제든 다시 들어온다.
  import { appState } from './state.svelte.js';
  import Topbar from './Topbar.svelte';
  import LegendReport from './LegendReport.svelte';
  import OwnHofCards from './OwnHofCards.svelte';
  import ShareBar from './ShareBar.svelte';
  import NameReport from './NameReport.svelte';
  import BackBar from './BackBar.svelte';
  import AdSlot from '../ads/AdSlot.svelte';
  import { motionOK } from './motion.js';
  import { rollCredits } from './creditRoll.js';
  import { retiredText as L } from '@offside/app-core/i18n/ko/retired';

  const v = $derived(appState.legend);
  /** 이전 화면 기록이 없으면 연 곳(명예의 전당·구단주·홈)으로. */
  const backTo = () => (appState.screen = appState.legendBack);
  let root: HTMLDivElement;

  // T-10-129 커리어 재생: 누르면 크레딧처럼 흘러가고, 다시 누르거나 화면을 만지면 멈춘다. 감속 모션이면 버튼이 없다.
  let rolling = $state(false);
  let stopRoll: (() => void) | null = null;
  function toggleRoll() {
    if (stopRoll) return stopRoll();
    rolling = true;
    stopRoll = rollCredits(root, () => {
      rolling = false;
      stopRoll = null;
    });
  }
  $effect(() => () => stopRoll?.());
</script>

<div class="wrap" bind:this={root}>
  <Topbar />
  {#if v}
    <LegendReport {v} />
    {#if v.own?.id}<OwnHofCards {v} />{/if}
    {#if v.reportId}<NameReport kind="career" id={v.reportId} name={v.name} />{/if}
    <AdSlot place="legend-bottom" />
  {/if}
  <!-- T-10-128 위쪽 '이전으로' 대신 아래 바: 공유할 수 있는 내 선수는 이전으로 + 공유하기, 그 밖은 '← 이전으로' 하나. -->
  {#if v?.shareId}
    <ShareBar id={v.shareId} back={backTo} />
  {:else}
    <BackBar act="hof-back" fallback={backTo} />
  {/if}
  {#if motionOK && v}
    <button class="career-play" class:on={rolling} data-act="career-play" aria-pressed={rolling} onclick={toggleRoll}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {#if rolling}<path d="M8 6h3v12H8zM13 6h3v12h-3z" />{:else}<path d="M8 5.5v13l10.5-6.5z" />{/if}
      </svg>
      {rolling ? L.stop : L.play}
    </button>
  {/if}
</div>

<style>
  .career-play {
    position: fixed;
    bottom: calc(var(--bottom-bar-h, 0px) + 12px);
    right: max(var(--pad-r, 16px), calc(50% - 240px + 16px));
    z-index: 6;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 40px;
    padding: 8px 16px 8px 12px;
    border-radius: 999px;
    border: 1px solid var(--accent);
    background: var(--accent);
    color: var(--accent-ink);
    font-weight: 700;
    font-size: 0.875rem;
    box-shadow: 0 6px 18px rgb(0 0 0 / 0.35);
  }
  .career-play.on {
    background: color-mix(in srgb, var(--bg) 88%, transparent);
    color: var(--ink);
    border-color: var(--line);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
  }
  .career-play svg {
    width: 18px;
    height: 18px;
    fill: currentColor;
  }
</style>
