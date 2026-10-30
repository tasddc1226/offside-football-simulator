<script lang="ts">
  // T-11-475 트로피 탭의 시대의 라이벌 카드: 통산 비교 · 라이벌 시즌 기록 · 지나간 라이벌.
  import type { EraTabView } from '@offside/app-core/era-view';
  import { eraText as L } from '@offside/app-core/i18n/ko/era';
  import EraRows from './EraRows.svelte';
  let { v }: { v: EraTabView } = $props();
  let open = $state(false);
</script>

<section class="card" data-era-tab>
  <div class="eyebrow">Era Rival</div>
  <h2 style="margin-bottom:4px">{L.tabTitle}</h2>
  <p><span aria-hidden="true">{v.who.flag}</span> <b>{v.who.name}</b> <span class="muted fs-xs">{v.who.line}</span></p>
  <p class="muted fs-xs">{v.status}</p>
  <EraRows rows={v.rows} />
  <p class="fs-sm">{v.verdict}</p>
  <button class="btn btn-sm" aria-expanded={open} onclick={() => (open = !open)}>{L.seasonsHead}</button>
  {#if open}
    {#each v.seasons as x (x.year)}
      <div class="trophy"><span class="y">{x.year}</span><div><b>{x.line}</b>{#if x.honors.length}<span class="muted fs-xs">{x.honors.join(' · ')}</span>{/if}</div></div>
    {/each}
  {/if}
  {#if v.past.length}<p class="muted fs-xs">{L.past} · {v.past.join(' · ')}</p>{/if}
</section>
