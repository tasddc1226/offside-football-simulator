<script lang="ts">
  import Chips from './Chips.svelte';
  import type { SheetView } from './types.js';
  let { v }: { v: Extract<SheetView, { kind: 'phase' }> } = $props();
</script>

<div class="eyebrow">{v.eyebrow}</div>
{#if v.block}
  {@const b = v.block}
  <div class="row" style="align-items:baseline;gap:14px">
    <span class="result-big"
      >{b.w}<span class="muted" style="font-size:20px">승</span> {b.d}<span class="muted" style="font-size:20px">무</span> {b.l}<span
        class="muted"
        style="font-size:20px">패</span
      ></span
    >
  </div>
  <p>
    {b.apps}경기 출전 · <b>{b.goals}골 {b.assists}도움</b>{#if b.rating}
      · 평균 평점 <b>{b.rating}</b>{/if}{#if b.cs}
      · 무실점 {b.cs}{/if}
  </p>
  {#each b.hl as h, i (i)}<p class="hl">{h}</p>{/each}
{:else}
  <h2>시즌 준비를 마쳤습니다</h2>
  <p class="muted">예상 역할: {v.role}</p>
{/if}
{#if v.comps.length}
  <div>
    <div class="eyebrow" style="margin-bottom:6px">컵 · 대륙 대회</div>
    {#each v.comps as c, i (i)}<p class={c.good ? 'hl' : 'muted'}>{c.t}</p>{/each}
  </div>
{/if}
{#each v.nat as x, i (i)}
  <div>
    {#if x.called}
      <div class="eyebrow" style="margin-bottom:6px">{x.name} · {x.comp}</div>
      {#each x.games as m, j (j)}
        <p class:hl={m.hl}>{m.line} <span class="muted">· {m.detail}</span></p>
      {/each}
    {:else}
      <div class="eyebrow" style="margin-bottom:6px">{x.name}</div>
      <p class="muted">이번 A매치 명단에서 제외됐습니다.</p>
    {/if}
  </div>
{/each}
<div>
  <div class="eyebrow" style="margin-bottom:6px">변화</div>
  {#if v.chips.length}<Chips chips={v.chips} pop />{:else}<p class="muted">큰 변화 없음</p>{/if}
</div>
