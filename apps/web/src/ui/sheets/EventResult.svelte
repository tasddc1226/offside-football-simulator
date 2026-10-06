<script lang="ts">
  import Chips from './Chips.svelte';
  import type { SheetView } from '@offside/app-core/sheets';
  import { sheetPlayText as L } from '@offside/app-core/i18n/ko/sheetPlay';
  let { v }: { v: Extract<SheetView, { kind: 'eventResult' }> } = $props();
</script>

<div class="eyebrow">{L.eventResult({ label: v.label })}</div>
<div class="result-big pop {v.ok ? 'ok' : 'ng'}">{v.outcome}</div>
{#if v.timing}<div class="mg-timing" data-mg-timing>{v.timing}</div>{/if}
<p>{v.text}</p>
<Chips chips={v.chips} pop />
{#if v.twist}<p class="twist">{v.twist}</p>{/if}
{#if v.dexNew}<p class="dex-new" data-dex-new>{L.dexNew} · <b>{v.dexNew}</b> <span class="muted">· {L.dexNote}</span></p>{/if}
{#if v.story}
  {#if v.story.ending}
    <div class="story-end"><span class="eyebrow">{L.storyEnd({ name: v.story.name })}</span><b>{v.story.ending}</b></div>
  {:else}
    <div class="story-next">
      {#if v.story.started}{L.storyStarted} <b>{v.story.name}</b>. {/if}{L.storyNext}
    </div>
  {/if}
{/if}
