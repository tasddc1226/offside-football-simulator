<script lang="ts">
  // T-11-475 시즌 결산의 시대의 라이벌 카드.
  import type { EraCardView } from '@offside/app-core/era-view';
  import { eraText as L } from '@offside/app-core/i18n/ko/era';
  import EraRows from './EraRows.svelte';
  let { v }: { v: EraCardView } = $props();
</script>

<section class="story-end era-card" data-era={v.kind}>
  <div class="eyebrow">Era Rival</div>
  <b>{v.title}</b>
  {#if v.intro}<p class="muted fs-sm">{v.intro}</p>{/if}
  <p class="era-who"><span aria-hidden="true">{v.who.flag}</span> <b>{v.who.name}</b> <span class="muted fs-xs">{v.who.line}</span></p>
  <EraRows rows={v.rows} />
  {#if v.ballon}<p class="hl"><b>{v.ballon}</b></p>{/if}
  {#if v.honors.length}<p class="muted fs-xs">{L.rivalHonors} · {v.honors.join(' · ')}</p>{/if}
  <p class="fs-sm" data-era-verdict>{v.verdict}</p>
</section>

<style>
  .era-card { animation: pop-in 0.4s cubic-bezier(0.3, 1.6, 0.5, 1) 160ms both; }
  .era-card > b { color: var(--accent-text); }
  .era-who { margin: 6px 0 0; }
  .era-who b { font-size: var(--fs-body); }
  @media (prefers-reduced-motion: reduce) { .era-card { animation: none; } }
  :global(.no-motion) .era-card { animation: none; }
</style>
