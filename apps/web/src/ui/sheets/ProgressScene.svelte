<script lang="ts">
  import type { SheetView } from '@offside/app-core/sheets';
  import { sheetCoreText } from '@offside/app-core/i18n/ko/sheetCore';
  import { sheetState } from '../sheetState.svelte.js';
  import AvatarStage from './AvatarStage.svelte';
  import Steps from './Steps.svelte';
  import Block from './Block.svelte';
  let { v }: { v: Extract<SheetView, { kind: 'steps' | 'block' }> } = $props();
  const running = $derived(sheetState.buttons.length === 0);
</script>

<div class="progress-scene" data-progress-scene>
  <header>
    {#if v.kind === 'block'}<div class="eyebrow">{v.eyebrow}</div>{/if}
    <h2>{v.title}</h2>
  </header>
  <div class="progress-avatar">
    {#if v.avatar}<AvatarStage spec={v.avatar} active={running} />{/if}
  </div>
  <div class="progress-details" role="region" aria-label={v.title} tabindex="0">
    <div class="progress-summary" role="progressbar" aria-label={v.title} aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(v.progress * 100)}>
      <span role="status">{v.kind === 'block' ? v.round : v.steps[Math.min(Math.max(v.active, 0), v.steps.length - 1)]}</span>
      <b>{Math.round(v.progress * 100)}%</b>
    </div>
    {#if v.kind === 'steps'}<Steps {v} compact />{:else}<Block {v} compact />{/if}
  </div>
</div>
{#if v.kind === 'block' && v.skip}
  <button class="link-btn progress-skip" id="an-skip" onclick={v.skip}>{sheetCoreText.skip}</button>
{/if}

<style>
  .progress-scene { min-height: 0; flex: 1; display: flex; flex-direction: column; gap: 18px; width: 100%; max-width: 680px; margin: 0 auto; }
  header { padding: 0 20px; }
  h2 { font-size: clamp(20px, 3vw, 30px); margin: 4px 0 0; }
  .progress-avatar { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); width: clamp(96px, 26vw, 160px); aspect-ratio: 8 / 9; pointer-events: none; }
  .progress-details { margin-top: auto; padding: 0 20px; max-height: min(24dvh, 200px); overflow-y: auto; overscroll-behavior: contain; display: flex; flex-direction: column; gap: 12px; }
  .progress-summary { display: flex; justify-content: space-between; gap: 12px; font-size: .875rem; }
  .progress-summary b { font-variant-numeric: tabular-nums; color: var(--accent-text); }
  .progress-skip { align-self: center; min-height: 44px; padding-inline: 24px; flex-shrink: 0; }
  @media (max-height: 540px) {
    .progress-avatar { width: 80px; }
    .progress-details { max-height: 70px; }
    h2 { font-size: 18px; }
  }
</style>
