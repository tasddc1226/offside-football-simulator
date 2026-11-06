<script lang="ts">
  // T-11-640 리그 우승 기록: 명예관 · 구단주 프로필 · 팀 프로필이 함께 쓴다. 서버가 최근 시즌부터 보낸다. 없으면 그리지 않는다.
  import type { LeagueHonor } from '@offside/app-core/api/league';
  import { leagueText as L } from '@offside/app-core/i18n/ko/league';
  import { leagueHonorPlate, leagueTitle } from '@offside/app-core/leagueView';
  import { teamSeasonLabel } from '@offside/app-core/seasonName';
  import LeagueTrophy from './LeagueTrophy.svelte';

  let { honors }: { honors: readonly LeagueHonor[] } = $props();
</script>

{#if honors.length}
  <section class="card stack" style="gap:10px" data-league-honors>
    <div>
      <div class="eyebrow">Offside League</div>
      <h2>{L.honorsTitle}</h2>
    </div>
    <ul class="lh-list">
      {#each honors as h (h.season)}
        <li class="lh" data-league-honor={`${h.season}-${h.tier}-${h.league}`}>
          <LeagueTrophy tier={h.tier} league={h.league} name={leagueHonorPlate(h)} size={60} />
          <span class="lh-text">
            <b>{L.honorChampion({ title: leagueTitle(h) })}</b>
            <small class="muted">{teamSeasonLabel(h.season)} · {h.teamName}</small>
          </span>
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .lh-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .lh {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: var(--radius-md);
    background: var(--surface-2);
  }
  .lh-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    overflow-wrap: anywhere;
  }
</style>
