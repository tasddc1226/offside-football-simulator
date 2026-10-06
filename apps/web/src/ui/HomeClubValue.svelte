<script lang="ts">
  // T-11-129 홈의 구단 가치 TOP 3(선발 11명 카드 기준가 합). 라이브 랭킹 첫 페이지(sort=value)를 그대로 쓴다 — 기록실 팀 랭킹과
  // 같은 메모·엣지 캐시를 나눠 쓴다. 홈이 그려질 때 한 번 부르고, 줄을 누르면 기록실 팀 랭킹에서 그 팀 프로필을 연다.
  import { fetchTeamRanking, type TeamRankResponse } from '@offside/app-core/api/team';
  import { fmtValue } from '@offside/app-core/format';
  import { hofStart } from '@offside/app-core/state';
  import { teamAchText as L } from '@offside/app-core/i18n/ko/teamAch';
  import Laurel from './Laurel.svelte';
  import TeamLogo from './team/TeamLogo.svelte';
  import { appState } from './state.svelte.js';
  import { go } from './nav.js';

  const TOP = 3;
  const MEDAL = ['gold', 'silver', 'bronze'];
  let rows = $state<TeamRankResponse['items'] | null>(null);
  let failed = $state(false);

  $effect(() => {
    void fetchTeamRanking(undefined, 'value', 1).then((r) => {
      if (r.ok) rows = r.data.items.filter((t) => t.value > 0).slice(0, TOP);
      else failed = true;
    });
  });

  function openRanking(team: string | null = null) {
    appState.hof = { ...hofStart(), tab: 'teams', teamSort: 'value', team };
    go('hof');
  }
</script>

<section class="card" data-home-club-value>
  <div class="club-value-head">
    <div class="club-value-title">
      <div class="eyebrow">Clubs</div>
      <h2 style="margin-bottom:2px">{L.homeValueTitle}</h2>
      <p class="muted fs-sm" style="margin:0 0 8px">{L.homeValueSub}</p>
    </div>
    <button class="icon-btn" data-act="club-value-all" onclick={() => openRanking()}>{L.homeValueAll}</button>
  </div>
  {#if failed}
    <p class="empty">{L.rankFail}</p>
  {:else if rows === null}
    <p class="empty" role="status">{L.loading}</p>
  {:else if rows.length === 0}
    <p class="empty">{L.homeValueEmpty}</p>
  {:else}
    {#each rows as t, i (t.teamId)}
      {@const value = fmtValue(t.value)}
      {@const [head, sub] = value.split(' ')}
      <button class="hof-row club-value-row" data-club-value-team={t.teamId} aria-label={L.homeValueRowAria({ rank: i + 1, name: t.name, manager: t.manager, value })} onclick={() => openRanking(t.teamId)}>
        <div class="hof-rank medal {MEDAL[i]}" aria-hidden="true"><Laurel /><span>{i + 1}</span></div>
        <div class="hof-main">
          <span class="hof-identity"><TeamLogo logo={t.logo} name={t.name} size={20} decorative /><b>{t.name}</b></span>
          <span class="muted fs-xs club-value-meta">{L.profManager}{t.manager} · OVR {t.ovr}</span>
        </div>
        <div class="num hof-value hof-value-text">{head}{#if sub} <small class="hof-value-sub">{sub}</small>{/if}</div>
      </button>
    {/each}
  {/if}
</section>

<style>
  .club-value-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px;
  }
  .club-value-title {
    flex: 1;
    min-width: 0;
  }
  .club-value-head .icon-btn {
    flex: none;
  }
  .club-value-row {
    grid-template-areas: 'rank main value';
    text-align: left;
  }
  .club-value-row .hof-main {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    min-width: 0;
  }
  .club-value-row .hof-identity {
    display: flex;
    align-items: center;
    gap: 6px;
    max-width: 100%;
  }
  .club-value-row .hof-identity b,
  .club-value-meta {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
