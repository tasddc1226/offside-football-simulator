<script lang="ts">
  import type { SheetView } from './types.js';
  let { v }: { v: Extract<SheetView, { kind: 'season' }> } = $props();
</script>

<div class="eyebrow">{v.eyebrow}</div>
<h2>{v.title}</h2>
{#if v.ch.length}
  <div class="row" style="gap:4px">
    {#each v.ch as c, i (i)}<span class="badge-ch pop" style="--d:{120 + i * 90}ms">CH · {c}</span>{/each}
  </div>
{/if}
<div class="stats" style="grid-template-columns:repeat(4,1fr)">
  <div><b>{v.stats.apps}</b><span>출전</span></div>
  <div><b>{v.stats.goals}</b><span>골</span></div>
  <div><b>{v.stats.col}</b><span>{v.stats.colLabel}</span></div>
  <div><b>{v.stats.rating}</b><span>평점</span></div>
</div>
{#if v.honors.length}
  <div class="stack">{#each v.honors as t, i (i)}<p class="hl"><b>{t}</b></p>{/each}</div>
{:else}
  <p class="muted">이번 시즌 수상은 없었습니다.</p>
{/if}
{#if v.comps.length}
  <div>
    <div class="eyebrow" style="margin-bottom:6px">대회별 성적</div>
    {#each v.comps as c, i (i)}<p class="muted">{c}</p>{/each}
  </div>
{/if}
{#if v.tours.length}
  <div>
    <div class="eyebrow" style="margin-bottom:6px">국가대표 · 국제대회</div>
    {#each v.tours as x, i (i)}
      <div class="stack" style="gap:2px">
        <p><b>{x.name}</b> — {x.stage}{#if x.note}&#32;<span class="muted">({x.note})</span>{/if}</p>
        {#each x.lines as l, j (j)}<div class="muted" style="font-size:12px">{l}</div>{/each}
      </div>
    {/each}
  </div>
{/if}
{#if v.gala.length}
  <div>
    <div class="eyebrow" style="margin-bottom:6px">Ballon d'Or 시상식</div>
    {#each v.gala as g, i (i)}<p class="hl"><b>{g}</b></p>{/each}
  </div>
{/if}
{#if v.miles.length}
  <div>
    <div class="eyebrow" style="margin-bottom:6px">커리어 여정</div>
    {#each v.miles as m, i (i)}<p>· {m}</p>{/each}
  </div>
{/if}
{#if v.notes.length}<p class="muted">{v.notes.join(' · ')}</p>{/if}
<div>
  <div class="eyebrow" style="margin-bottom:6px">팬 반응</div>
  <div class="fan-feed">
    {#each v.fans as f, i (i)}<div class="fan-line in" style="--d:{200 + i * 110}ms"><b>팬</b>{f}</div>{/each}
  </div>
</div>
<p class="muted">나이 {v.age}세가 되었습니다. 이제 다음 시즌을 준비합니다.</p>
