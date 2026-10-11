<script lang="ts">
  // T-11-196 프리미엄 스카우트 확률 공개표(앱 owner/ScoutOdds.tsx). 펼칠 때만 계산한다.
  import { scoutOddsRows } from '@offside/app-core/scoutOdds';
  import { scoutText as L } from '@offside/app-core/i18n/ko/scout';
  import { detailOpenNow } from '../state.svelte.js';

  let open = $state(false);
  const rows = $derived(open ? scoutOddsRows(detailOpenNow()) : []);
</script>

<button class="link-btn self-start fs-sm" data-act="scout-odds" aria-expanded={open} onclick={() => (open = !open)}>
  {open ? L.oddsHide : L.oddsShow}
</button>
{#if open}
  <div class="odds" data-scout-odds>
    <b class="fs-sm">{L.oddsTitle}</b>
    {#each rows as r (r.label)}
      <div class="odds-row">
        <span class="muted fs-sm">{r.label}</span>
        <span class="cells num fs-sm">
          {#each r.cells as c (c.grade)}<span><b>{c.grade}</b> {c.pct}</span>{/each}
        </span>
      </div>
    {/each}
    <p class="muted fs-sm">{L.oddsNote}</p>
  </div>
{/if}

<style>
  .odds {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    border-radius: 10px;
    background: var(--surface-2);
  }
  .odds-row {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .cells {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 12px;
  }
  .odds p {
    margin: 0;
  }
</style>
