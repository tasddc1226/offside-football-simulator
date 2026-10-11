<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { OwnerArchive } from '@offside/app-core/ownerArchive';
  import { ownerProfileText as L } from '@offside/app-core/i18n/ko/ownerProfile';
  import { honorViews } from '@offside/app-core/seasonRecap';
  import { ownerTierOf } from '@offside/contracts/owner-tier';
  import { tierName } from '@offside/app-core/ownerTier';
  import { teamSeasonLabel } from '@offside/app-core/seasonName';
  import { num } from '@offside/app-core/teamText';
  import { EMBLEM_PALETTE } from '@offside/app-core/gradeEmblem';
  import { appState } from '../state.svelte.js';
  import { go } from '../nav.js';
  import { dur } from '../motion.js';
  import GradeEmblem from '../team/GradeEmblem.svelte';
  import HonorEmblem from '../HonorEmblem.svelte';
  import CupHonors from '../cup/CupHonors.svelte';

  const archive = new OwnerArchive();
  let view = $state(archive.state);
  let Detail = $state<typeof import('../SeasonRecap.svelte').default>();
  onMount(() => {
    const unsubscribe = archive.subscribe((next) => { view = next; });
    void archive.load(appState.honorsSeason);
    return () => { unsubscribe(); archive.dispose(); };
  });
  const owner = $derived(view.data?.owner);
  const line = $derived(owner?.seasons.find((s) => s.season === view.season));
  const pending = $derived(view.data?.pendingSeasons.includes(view.season ?? -1));
  const badges = $derived(honorViews(view.data?.honors.filter((h) => h.season === view.season) ?? []));
  const cups = $derived(owner?.cupHonors.filter((h) => h.season === view.season) ?? []);
  const tier = $derived(line?.achScore == null ? null : ownerTierOf(line.achScore));

  function select(season: number) { appState.honorsSeason = season; archive.select(season); }
  async function expand(retry = false) {
    Detail ??= (await import('../SeasonRecap.svelte')).default;
    await archive.expand(retry);
    if (view.detail?.status === 'ready') appState.recapNew = false;
  }
  function players() {
    appState.playersSeason = view.season;
    appState.playersView = 'records';
    go('players');
  }
</script>

<div class="archive" data-owner-archive>
  {#if view.loading}
    <p class="muted" role="status">{L.archiveLoading}</p>
  {:else if view.error}
    <section class="card stack" data-archive-error><p role="status">{L.archiveError}</p><button class="btn" onclick={() => archive.load(appState.honorsSeason)}>{L.retry}</button></section>
  {:else if owner}
    <dl class="archive-totals" aria-label={L.hallTitle}>
      <div><dt>{L.statRetired}</dt><dd>{num(owner.stats.retired)}</dd></div>
      <div><dt>{L.statRn}</dt><dd>{num(owner.stats.retiredNumbers)}</dd></div>
      <div><dt>{L.archiveBadges}</dt><dd>{num(view.data?.honors.length ?? 0)}</dd></div>
    </dl>
    <div class="season-path" role="group" aria-label={L.archiveChoose}>
      {#each [...owner.seasons].reverse() as s (s.season)}
        <button class="season-stop" aria-pressed={view.season === s.season} data-archive-season={s.season} onclick={() => select(s.season)}>
          <span class="season-dot" aria-hidden="true"></span>
          <span class="season-label"><b>{teamSeasonLabel(s.season)}</b><small>{view.data?.pendingSeasons.includes(s.season) ? L.archivePending : s.closed ? L.archiveClosed : L.ongoing}</small></span>
          {#if s.achScore !== null}<span class="season-score num">{num(s.achScore)}<small>{L.archiveScore}</small></span>{/if}
        </button>
      {/each}
    </div>
    {#if line}
      {#key line.season}
        <div class="archive-selected" in:fade={{ duration: dur(160) }}>
          <section class="season-cover" style={`--season-color:${tier ? EMBLEM_PALETTE[tier].base : 'var(--accent)'}`} data-archive-cover>
            <div class="season-heading">
              <div><span class="muted fs-sm">{pending ? L.archivePending : line.closed ? L.archiveClosed : L.ongoing}</span><h2>{teamSeasonLabel(line.season)}</h2>{#if line.teamName}<p class="team-name">{line.teamName}</p>{/if}</div>
              {#if tier}<span class="season-emblem"><GradeEmblem id={tier} size={72} /><b>{tierName(tier)}</b></span>{/if}
            </div>
            <dl class="season-scores">
              <div><dt>{L.archiveScore}</dt><dd>{line.achScore === null ? L.none : num(line.achScore)}</dd></div>
              <div><dt>{L.archiveTeamRank}</dt><dd>{line.teamRank === null ? L.none : L.rank({ n: line.teamRank })}</dd></div>
            </dl>
            <p class="muted fs-sm">{pending ? L.archivePendingNote : line.closed ? L.archiveFinal : L.archiveLive}</p>
          </section>
          {#if line.closed && !pending}
            <section class="card stack archive-badges" aria-label={L.archiveBadges}>
              <h3>{L.archiveBadges}</h3>
              {#if badges.length}
                <ul>{#each badges as h (h.kind)}<li class="medal {h.medal}"><span class="badge-art"><HonorEmblem {h} /></span><b>{h.title}</b><small class="muted">{h.detail}</small></li>{/each}</ul>
              {:else}<p class="muted fs-sm">{L.archiveNoBadges}</p>{/if}
            </section>
          {/if}
          {#if cups.length}<CupHonors honors={cups} />{:else}<p class="muted fs-sm cup-empty">{L.archiveCupEmpty}</p>{/if}
          <div class="archive-actions">
            <button class="btn" data-act="archive-players" onclick={players}>{L.archivePlayers}</button>
            {#if !line.closed}<button class="btn" data-act="archive-achievements" onclick={() => { appState.teamView = 'achievements'; go('team'); }}>{L.viewAchievements}</button>{/if}
          </div>
          {#if line.closed}
            <button class="archive-disclosure" aria-expanded={view.expanded} aria-controls="archive-detail" data-act="archive-details" onclick={() => expand()}>
              <span>{view.expanded ? L.archiveHide : L.archiveDetails}</span><span aria-hidden="true">{view.expanded ? '−' : '+'}</span>
            </button>
            {#if view.expanded}
              <div id="archive-detail" class="archive-detail" in:fade={{ duration: dur(160) }}>
                {#if view.detailLoading}<p class="muted" role="status">{L.archiveLoading}</p>
                {:else if view.detailError}<p role="status">{L.archiveError}</p><button class="btn" data-act="archive-retry" onclick={() => expand(true)}>{L.retry}</button>
                {:else if view.detail && Detail}<Detail embedded record={view.detail} />{/if}
              </div>
            {/if}
          {/if}
        </div>
      {/key}
    {:else}<p class="muted">{L.seasonsEmpty}</p>{/if}
  {/if}
</div>

<style>
  .archive,.archive-selected {display:flex;flex-direction:column;gap:16px;min-width:0;}
  .archive-totals {display:grid;grid-template-columns:repeat(3,minmax(0,1fr));margin:0;padding:12px 0;border-block:1px solid var(--line);text-align:center;}
  .archive-totals dt {font-size:12px;color:var(--muted);}.archive-totals dd {margin:4px 0 0;font-size:22px;font-weight:750;font-variant-numeric:tabular-nums;}
  .archive-totals > div + div {border-left:1px solid var(--line);}
  .season-path {display:flex;flex-direction:column;gap:4px;}
  .season-stop {display:flex;align-items:center;text-align:left;gap:12px;width:100%;min-height:64px;padding:10px 12px;color:var(--ink);background:transparent;border:1px solid transparent;border-radius:12px;}
  .season-stop[aria-pressed=true] {background:var(--surface-2);border-color:var(--line);}
  .season-dot {width:10px;height:10px;flex:none;border:2px solid var(--muted);border-radius:50%;}
  [aria-pressed=true] .season-dot {background:var(--accent);border-color:var(--accent);}
  .season-label {display:flex;flex:1;flex-direction:column;gap:3px;min-width:0;}.season-stop small {font-size:12px;color:var(--muted);}
  .season-score {display:flex;flex-direction:column;text-align:right;gap:3px;}
  .season-cover {padding:20px;border:1px solid var(--line);border-top:3px solid var(--season-color);border-radius:16px;background:var(--surface);overflow:hidden;}
  .season-heading {display:flex;align-items:center;justify-content:space-between;gap:12px;}.season-heading > div {min-width:0;}
  .season-heading h2 {font-size:26px;margin:6px 0;}.team-name {overflow-wrap:anywhere;margin:0;font-weight:600;}
  .season-emblem {display:flex;align-items:center;flex-direction:column;gap:3px;flex:none;font-size:12px;}
  .season-scores {display:grid;grid-template-columns:1fr 1fr;margin:20px 0 14px;padding-block:14px;border-block:1px solid var(--line);gap:12px;}
  .season-scores dt {font-size:12px;color:var(--muted);}.season-scores dd {font-size:26px;font-weight:750;margin:4px 0 0;font-variant-numeric:tabular-nums;}
  .archive-badges ul {display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px 6px;padding:0;margin:0;list-style:none;}
  .archive-badges li {display:flex;align-items:center;flex-direction:column;text-align:center;gap:5px;min-width:0;overflow-wrap:anywhere;font-size:12px;}
  .badge-art {width:64px;height:70px;}.archive-badges small {font-size:12px;}.archive-actions {display:flex;gap:8px;flex-wrap:wrap;}.archive-actions .btn {flex:1;min-height:44px;}
  .archive-disclosure {display:flex;justify-content:space-between;align-items:center;gap:12px;background:var(--surface);color:var(--ink);border:1px solid var(--line);border-radius:12px;padding:16px;text-align:left;font-weight:600;min-height:52px;}
  .archive-detail {min-width:0;}.cup-empty {margin:0 4px;}
</style>
