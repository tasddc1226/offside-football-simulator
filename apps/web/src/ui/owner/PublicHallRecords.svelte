<script lang="ts">
  import type { PublicOwnerHall } from '@offside/app-core/api/ownerProfile';
  import { ownerProfileText as L } from '@offside/app-core/i18n/ko/ownerProfile';
  import { seasonLabel } from '@offside/app-core/seasonName';
  import { num } from '@offside/app-core/teamText';
  import TitleBadge from '../cup/TitleBadge.svelte';
  let { data, titles = false }: { data: PublicOwnerHall; titles?: boolean } = $props();
</script>
<div class="stack" data-public-hall-content>
  <p class="muted fs-sm">{L.publicHall}</p>
  {#if titles}
    <h2>{L.publicTitles}</h2>
    {#each data.titles as title (title)}<div class="card"><TitleBadge {title} /></div>{:else}<p class="muted">{L.publicTitlesEmpty}</p>{/each}
  {:else}
    <h2>{L.seasons}</h2>
    {#each [...data.owner.seasons].reverse() as s (s.season)}
      <section class="card stack" data-public-season={s.season}>
        <h3>{seasonLabel(s.season, s.name)}{#if !s.closed} <span class="pill">{L.ongoing}</span>{/if}</h3>
        <p>{s.teamName ?? L.none}</p>
        {#if data.pendingSeasons.includes(s.season)}<p class="muted">{L.publicPending}</p>{:else}
          <dl><div><dt>{L.colAch}</dt><dd>{s.achScore === null ? L.none : num(s.achScore)}</dd></div><div><dt>{L.colRank}</dt><dd>{s.teamRank === null ? L.none : L.rank({ n: s.teamRank })}</dd></div></dl>
        {/if}
      </section>
    {:else}<p class="muted">{L.seasonsEmpty}</p>{/each}
  {/if}
</div>
<style>
  h2,h3,p{margin:0;overflow-wrap:anywhere} h3{font-size:16px} dl{margin:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px} dt{font-size:12px;color:var(--muted)} dd{margin:4px 0 0;overflow-wrap:anywhere}
</style>
