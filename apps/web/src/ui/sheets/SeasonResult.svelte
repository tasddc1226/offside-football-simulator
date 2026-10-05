<script lang="ts">
  import { tn } from '@offside/game/i18n/names';
  import { visibleSeasonNotes } from '@offside/app-core/potential-view';
  import type { SheetView } from '@offside/app-core/sheets';
  import NewTitles from '../titles/NewTitles.svelte';
  import { sheetPlayText as L } from '@offside/app-core/i18n/ko/sheetPlay';
  import { sheetCoreText } from '@offside/app-core/i18n/ko/sheetCore';
  let { v }: { v: Extract<SheetView, { kind: 'season' }> } = $props();
  const notes = $derived(visibleSeasonNotes(v.notes));
</script>

<div class="eyebrow">{v.eyebrow}</div>
<h2>{v.title}</h2>
{#if v.ch.length}
  <div class="row" style="gap:4px">
    {#each v.ch as c, i (i)}<span class="badge-ch pop" style="--d:{120 + i * 90}ms">CH · {c}</span>{/each}
  </div>
{/if}
<div class="stats" style="grid-template-columns:repeat(4,1fr)">
  <div><b>{v.stats.apps}</b><span>{sheetCoreText.tallyApps}</span></div>
  <div><b>{v.stats.goals}</b><span>{sheetCoreText.tallyGoals}</span></div>
  <div><b>{v.stats.col}</b><span>{v.stats.colLabel}</span></div>
  <div><b>{v.stats.rating}</b><span>{sheetCoreText.tallyRating}</span></div>
</div>
{#if v.honors.length}
  <div class="stack">{#each v.honors as t, i (i)}<p class="hl"><b>{tn(t)}</b></p>{/each}</div>
{:else}
  <p class="muted">{L.noHonors}</p>
{/if}
{#if v.promo}
  <div class="story-end promo-card pop" style="--d:160ms" data-promo>
    <div class="eyebrow">Promotion</div>
    <b>{L.promoTitle}</b>
    <p class="muted fs-sm">{L.promoBodyWeb({ club: tn(v.promo.club) })}</p>
    <p class="muted fs-xs">{L.promoDownWeb({ club: tn(v.promo.down) })}</p>
  </div>
{/if}
{#if v.comps.length}
  <div>
    <div class="eyebrow" style="margin-bottom:6px">{L.comps}</div>
    {#each v.comps as c, i (i)}<p class="muted">{c}</p>{/each}
  </div>
{/if}
{#if v.tours.length}
  <div>
    <div class="eyebrow" style="margin-bottom:6px">{L.tours}</div>
    {#each v.tours as x, i (i)}
      <div class="stack" style="gap:2px">
        <p><b>{tn(x.name)}</b> · {tn(x.stage)}{#if x.note}<span class="muted" style="margin-left:.25em">({x.note})</span>{/if}</p>
        {#each x.lines as l, j (j)}<div class="muted fs-xs">{l}</div>{/each}
      </div>
    {/each}
  </div>
{/if}
{#if v.gala.length}
  <div>
    <div class="eyebrow" style="margin-bottom:6px">{L.gala}</div>
    {#each v.gala as g, i (i)}<p class="hl"><b>{tn(g)}</b></p>{/each}
  </div>
{/if}
{#if v.miles.length}
  <div>
    <div class="eyebrow" style="margin-bottom:6px">{L.miles}</div>
    {#each v.miles as m, i (i)}<p>· {tn(m)}</p>{/each}
  </div>
{/if}
<NewTitles titles={v.titles} pop />
{#if notes.length}<p class="muted">{notes.join(' · ')}</p>{/if}
{#if v.scoutHint}
  <div>
    <div class="eyebrow" style="margin-bottom:6px">{L.scoutHint}</div>
    <p>“{v.scoutHint}”</p>
  </div>
{/if}
<div>
  <div class="eyebrow" style="margin-bottom:6px">{L.fans}</div>
  <div class="fan-feed">
    {#each v.fans as f, i (i)}<div class="fan-line in" style="--d:{200 + i * 110}ms"><span class="fan-heart" aria-hidden="true">💗</span>{f}</div>{/each}
  </div>
</div>
<p class="muted">{L.ageWeb({ age: v.age })}</p>
