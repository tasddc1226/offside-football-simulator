<script lang="ts">
  // 기록 탭 — 맨 위 시즌 통계 카드(누르면 통계 화면, T-11-269)와 이 시즌에 치른 경기 목록. 경기를 누르면 그 경기의 결과를 연다.
  // 목록은 최근 10경기부터 보이고 '더 보기'로 지난 경기를 이어 받는다(하루 10경기를 넘겨도 볼 수 있게).
  import type { TeamMatch, TeamRecord } from '@offside/app-core/api/team';
  import LoadState, { type LoadStatus } from '../LoadState.svelte';
  import TeamMatchRow from './TeamMatchRow.svelte';
  import { teamMatchText as L } from '@offside/app-core/i18n/ko/teamMatch';
  import { recordText } from '@offside/app-core/teamText';
  let {
    history,
    status,
    record,
    seasonName,
    more,
    moreStatus,
    onreload,
    onopen,
    onmore,
    onstats,
  }: {
    history: TeamMatch[];
    status: LoadStatus;
    record: TeamRecord | null;
    seasonName: string;
    /** 다음 쪽이 있으면 true. */
    more: boolean;
    moreStatus: 'idle' | 'loading' | 'error';
    onreload: () => void;
    onopen: (m: TeamMatch) => void;
    onmore: () => void;
    onstats: () => void;
  } = $props();
</script>

<button class="card tm-stats-card" onclick={onstats} data-act="team-stats" aria-label={L.statsOpen}>
  <span class="tm-stats-text">
    <span class="eyebrow">Stats</span>
    <b>{L.statsCardTitle}</b>
    {#if record}<span class="fs-sm" data-stats-record>{L.statsCardRecord({ season: seasonName, record: recordText(record) })}</span>{/if}
    <span class="muted fs-sm">{L.statsCardLead}</span>
  </span>
  <span class="tm-stats-go" aria-hidden="true">›</span>
</button>

<section class="card stack" style="gap:12px">
  <div>
    <div class="eyebrow">Matches</div>
    <h1>{L.historyTitle}</h1>
  </div>
  <LoadState {status} failText={L.historyFail} retry={onreload}>
    {#each history as m (m.id)}
      <TeamMatchRow {m} {onopen} />
    {:else}
      <p class="muted">{L.historyEmpty}</p>
    {/each}
    {#if more}
      {#if moreStatus === 'error'}<p class="muted fs-sm" role="alert">{L.historyMoreFail}</p>{/if}
      <button class="btn" onclick={onmore} disabled={moreStatus === 'loading'} data-act="team-history-more">
        {moreStatus === 'loading' ? L.historyMoreLoading : L.historyMore}
      </button>
    {/if}
  </LoadState>
</section>

<style>
  .tm-stats-card {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    border: 0;
    text-align: left;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  .tm-stats-card:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .tm-stats-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
  }
  .tm-stats-go {
    font-size: var(--fs-title1);
    color: var(--muted);
  }
</style>
