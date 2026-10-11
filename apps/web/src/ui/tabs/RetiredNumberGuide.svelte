<script lang="ts">
  import type { GameState } from '@offside/game/types';
  import type { RetiredNumberProgress } from '@offside/contracts';
  import { fetchRetiredNumberProgress } from '@offside/app-core/api/retiredNumberProgress';
  import { retiredNumberNext } from '@offside/app-core/retiredNumberGuide';
  import { gameCareerText } from '@offside/app-core/i18n/ko/gameCareer';
  import { tn } from '@offside/game/i18n/names';
  import ClubMark from '../ClubMark.svelte';
  const { s }: { s: GameState } = $props();
  const L = gameCareerText;
  let open = $state(false);
  let data = $state<RetiredNumberProgress | null>(null);
  let loading = $state(false);
  let failed = $state(false);
  let request = 0;
  async function load() {
    const version = ++request;
    loading = true; failed = false;
    try {
      const r = await fetchRetiredNumberProgress(s.cid, s.number);
      if (version !== request) return;
      if (r.ok) data = r.data;
      else failed = true;
    } catch { if (version === request) failed = true; }
    finally { if (version === request) loading = false; }
  }
  $effect(() => {
    // Only load on explicit expansion; completed-season changes use the shared invalidated cache.
    const key = `${s.cid}:${s.number}:${s.career.length}`;
    if (open && key && s.career.length) void load();
    return () => { request++; };
  });
</script>

<section class="card rn-guide" data-rn-guide>
  <button class="rn-trigger" onclick={() => (open = !open)} aria-expanded={open} aria-label={open ? L.rnClose : L.rnOpen}>
    <span class="rn-shirt" aria-hidden="true">{s.number}</span>
    <span class="rn-heading"><strong>{L.rnTitle}</strong><span class="muted fs-sm">{L.rnIntro}</span></span>
    <span class="rn-chevron" aria-hidden="true">{open ? '−' : '+'}</span>
  </button>
  {#if open}
    <div class="rn-body" aria-busy={loading}>
      {#if !s.career.length}
        <p class="muted fs-sm">{L.rnEmpty}</p>
      {:else if loading}
        <p class="muted fs-sm" role="status">{L.rnLoading}</p>
      {:else if failed}
        <p class="muted fs-sm" role="status">{L.rnError}</p>
        <button class="btn" onclick={load}>{L.rnRetry}</button>
      {:else if data}
        <p class="fs-sm"><b>{L.rnScope(data)}</b></p>
        <p class="muted fs-sm">{L.rnBasis}</p>
        {#if data.recordedSeasons < s.career.length}<p class="muted fs-sm" role="status">{L.rnSyncing}</p>{/if}
        {#if !data.clubs.length}<p class="muted fs-sm">{L.rnEmpty}</p>{/if}
        <div class="rn-clubs">
          {#each data.clubs as club (club.clubId)}
            <article class="rn-club" data-rn-club={club.clubId}>
              <div class="rn-club-head"><strong><ClubMark id={club.clubId} name={club.club} /> {tn(club.club)}</strong><span class="fs-xs rn-status" class:good={club.availability === 'open'}>{club.availability === 'open' ? L.rnAvailable : club.availability === 'taken' ? L.rnTaken : L.rnUnknown}</span></div>
              <div class="rn-metrics fs-sm"><span>{L.rnSeasons({ have: club.seasons, need: data.minSeasons })}</span><b>{L.rnProgress({ pct: club.progress })}</b></div>
              <div class="rn-bar" role="progressbar" aria-label={L.rnProgress({ pct: club.progress })} aria-valuemin={0} aria-valuemax={100} aria-valuenow={club.progress}><span style:width={`${club.progress}%`}></span></div>
              <p class="fs-sm">{retiredNumberNext(club, data.minSeasons)}</p>
            </article>
          {/each}
        </div>
      {/if}
      <p class="muted fs-sm">{L.rnRules}</p>
      <p class="muted fs-xs">{L.rnNote}</p>
    </div>
  {/if}
</section>
<style>
  .rn-guide { scroll-margin-top: 80px; padding: 0; overflow: hidden; }
  .rn-trigger { display: flex; align-items: center; gap: 12px; padding: 16px; width: 100%; min-height: 80px; color: var(--ink); background: transparent; border: 0; text-align: left; cursor: pointer; }
  .rn-trigger:hover { background: var(--surface2); }
  .rn-trigger:focus-visible { outline: 2px solid var(--accent); outline-offset: -4px; }
  .rn-shirt { display: grid; place-items: center; width: 44px; min-height: 48px; flex-shrink: 0; background: var(--surface2); border: 1px solid var(--line); border-radius: 6px; font-size: 26px; font-weight: 800; font-variant-numeric: tabular-nums; }
  .rn-heading { flex: 1; min-width: 0; display: grid; gap: 4px; overflow-wrap: anywhere; }
  .rn-chevron { font-size: 24px; }
  .rn-body { display: grid; gap: 12px; padding: 0 16px 16px; }
  .rn-clubs { display: grid; gap: 16px; }
  .rn-club { display: grid; gap: 8px; border-top: 1px solid var(--line); padding-top: 12px; }
  .rn-club-head, .rn-metrics { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; }
  .rn-club-head strong { min-width: 0; overflow-wrap: anywhere; }
  .rn-status { color: var(--muted); }
  .rn-status.good { color: var(--good); }
  .rn-bar { height: 6px; border-radius: 3px; overflow: hidden; background: var(--surface2); }
  .rn-bar span { display: block; height: 100%; background: var(--accent); }
</style>
