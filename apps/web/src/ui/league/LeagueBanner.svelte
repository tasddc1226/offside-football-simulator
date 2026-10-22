<script lang="ts">
  // T-11-418 홈 화면의 오프사이드 리그 배너 — 단계별 한 줄 안내와 '리그 보기'. 공개 응답(30초 메모)만으로 그린다.
  // 신청 · 내 상태는 리그 화면에서 한다. 리그가 끝났거나 불러오지 못하면 숨긴다.
  import { fetchLeague, type LeagueResponse } from '@offside/app-core/api/league';
  import { leagueText as L } from '@offside/app-core/i18n/ko/league';
  import { leagueLine, leagueOnHome, leaguePhaseActive, leaguePhaseLabel } from '@offside/app-core/leagueView';

  let { onopen }: { onopen: () => void } = $props();

  let data = $state<LeagueResponse | null>(null);

  $effect(() => {
    void fetchLeague().then((r) => {
      if (r.ok) data = r.data;
    });
  });
</script>

{#if data && leagueOnHome(data)}
  <button type="button" class="card league-banner" aria-label={`${L.seasonTitle({ season: data.league.season })} · ${L.open}`} data-league-banner data-league-phase={data.phase} data-act="league-open" onclick={onopen}>
    <div class="lb-who">
      <small class="eyebrow">Offside League</small>
      <strong class="lb-title">{L.seasonTitle({ season: data.league.season })}</strong>
      <span class="muted fs-sm" data-league-line>{leagueLine(data)}</span>
    </div>
    <span class="pill" class:good={leaguePhaseActive(data.phase)}>{leaguePhaseLabel(data.phase)}</span>
  </button>
{/if}

<style>
  .league-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
    border: 0;
    text-align: left;
    color: var(--ink);
    cursor: pointer;
  }
  .league-banner:hover {
    background: color-mix(in srgb, var(--accent) 6%, var(--surface));
  }
  .lb-who {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .lb-title {
    font-size: var(--fs-title2);
    line-height: 1.3;
    overflow-wrap: anywhere;
  }
  .league-banner .pill {
    flex: none;
  }
</style>
