<script lang="ts">
  import { tn } from '@offside/game/i18n/names';
  import { chooseEvent } from '../actions.js';
  import type { SheetView } from '@offside/app-core/sheets';
  import { sheetPlayText as L } from '@offside/app-core/i18n/ko/sheetPlay';
  let { v }: { v: Extract<SheetView, { kind: 'event' }> } = $props();
</script>

{#if v.story}
  <div class="story-tag">{L.storyTag({ name: tn(v.story.name) })} <b>{v.story.stage}/{v.story.total}</b></div>
{/if}
<div class="eyebrow">{v.eyebrow}</div>
<h2>{v.title}</h2>
<p>{v.text}</p>
<div class="stack">
  {#each v.choices as c, i (i)}
    <button class="choice" data-choice={i} onclick={() => void chooseEvent(i)}
      ><span>{c.label}</span><span class="odds" title={c.hint}>{c.odds}</span></button
    >
  {/each}
</div>
