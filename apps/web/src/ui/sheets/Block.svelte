<script lang="ts">
  // T-10-028 경기 중계 시트 — 구간 경기가 한 경기씩 올라오며 승무패·출전 기록이 쌓인다.
  import TickerLine from './TickerLine.svelte';
  import type { SheetView } from './types.js';
  let { v }: { v: Extract<SheetView, { kind: 'block' }> } = $props();
  const tally = $derived([
    { k: v.tally.apps, l: '출전' },
    { k: v.tally.g, l: '골' },
    { k: v.back ? v.tally.cs : v.tally.a, l: v.back ? '무실점' : '도움' },
    { k: v.tally.rating, l: '평점' },
  ]);
</script>

<div class="eyebrow">{v.eyebrow}</div>
<h2>{v.title}</h2>
<div class="prog"><i style="width:{v.progress * 100}%"></i></div>
<div class="prog-meta"><span>{v.round}</span><span data-block-wdl>{v.wdl.w}승 {v.wdl.d}무 {v.wdl.l}패</span></div>
<div class="tally">
  {#each tally as t (t.l)}
    <!-- 값이 바뀔 때마다 {#key}로 <b>를 새로 그려 bump 애니메이션을 다시 건다. -->
    <div>{#key t.k}<b class:bump={t.k !== 0 && t.k !== '-'}>{t.k}</b>{/key}<span>{t.l}</span></div>
  {/each}
</div>
<div class="ticker live">
  {#each v.ticker as m (m.key)}
    <TickerLine {m} />
  {/each}
</div>
<div class="steps">
  {#each v.extras as x, i (i)}
    <div class:on={!x.done} class:done={x.done}>{x.text}</div>
  {/each}
</div>
{#if v.skip}
  <button class="skip" id="an-skip" onclick={v.skip}>건너뛰기</button>
{/if}
