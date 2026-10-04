<script lang="ts">
  // T-10-092 라이브 랭킹(팀 랭킹) — 기록실 탭. 선수가 한 명 이상 있는 구단주 팀을 시즌별로 레이팅(경기 결과) 또는 팀 OVR
  // 순으로 보여 주고, 줄을 누르면 팀 프로필(appState.hof.team)을 연다. 서버가 5분마다 새로 센다.
  import { TEAM_RANK_PER_PAGE } from '@offside/contracts/owner-team';
  import { displaySeasonAt, openTeamSeasons, teamSeasonName } from '@offside/contracts/service-seasons';
  import { fetchTeamRanking, type TeamRankResponse, type TeamRankSort } from '@offside/app-core/api/team';
  import { appState } from '../state.svelte.js';
  import TeamProfile from './TeamProfile.svelte';
  import TeamLogo from './TeamLogo.svelte';
  import { num as n } from '@offside/app-core/teamText';

  const SORTS: [TeamRankSort, string][] = [
    ['rating', '레이팅'],
    ['ovr', '팀 OVR'],
  ];
  const FORM_LABEL = { W: '승리', D: '무승부', L: '패배' } as const;
  function formText(form: TeamRankResponse['items'][number]['recentForm']) {
    return form?.length ? form.map((result) => FORM_LABEL[result]).join(', ') : '경기 기록 없음';
  }
  /** undefined = 지금 시즌(서버가 정한다). */
  let season = $state<number | undefined>(undefined);
  let sort = $state<TeamRankSort>('rating');
  let page = $state(1);
  let data = $state<TeamRankResponse | null>(null);
  let failed = $state(false);
  let loading = $state(true);
  const now = new Date().toISOString();
  const seasons = $derived(data?.seasons ?? openTeamSeasons(now).map((id) => ({ id, name: teamSeasonName(id) })));
  const selectedSeason = $derived(season ?? data?.season ?? displaySeasonAt(now));
  const metricLabel = $derived(sort === 'rating' ? '레이팅' : '팀 OVR');
  const rows = $derived(data?.items ?? []);

  $effect(() => {
    const [se, so, p] = [season, sort, page];
    let live = true;
    failed = false;
    loading = true;
    void fetchTeamRanking(se, so, p).then((r) => {
      if (!live || se !== season || so !== sort || p !== page) return;
      loading = false;
      if (r.ok) data = r.data;
      else failed = true;
    });
    return () => { live = false; };
  });

  const pages = $derived(data ? Math.max(1, Math.ceil(data.total / TEAM_RANK_PER_PAGE)) : 1);
  function goPage(p: number) {
    page = p;
    window.scrollTo(0, 0);
  }
  function open(id: string) {
    appState.hof = { ...appState.hof, team: id };
    window.scrollTo(0, 0);
  }
</script>

{#if appState.hof.team}
  <TeamProfile id={appState.hof.team} onback={() => (appState.hof = { ...appState.hof, team: null })} />
{:else}
  <section class="card" data-team-ranking>
    <div class="hof-toolbar team-ranking-toolbar">
      <label class="hof-season-picker">
        <span class="hof-filter-label">시즌</span>
        <select aria-label="팀 랭킹 시즌" data-rank-season-select value={String(selectedSeason)} onchange={(e) => ((season = Number(e.currentTarget.value)), (page = 1))}>
          {#each seasons as s (s.id)}<option value={String(s.id)}>{s.name}</option>{/each}
        </select>
      </label>
      {#if data && !loading && !failed}<span class="team-ranking-total muted">참가 팀 <b class="num">{n(data.total)}</b>개</span>{/if}
    </div>
    <p class="hof-filter-label team-sort-label">정렬</p>
    <div class="hof-sorts team-ranking-sorts" role="group" aria-label="순위 유형">
      {#each SORTS as [k, label] (k)}
        <button class="hof-sort" aria-pressed={sort === k} data-rank-sort={k} onclick={() => ((sort = k), (page = 1))}>{label}</button>
      {/each}
    </div>
    <p class="team-form-guide muted">최근 5경기 · 왼쪽이 최신 경기예요.</p>
    {#if failed}
      <p class="empty">랭킹을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>
    {:else if loading || !data}
      <p class="empty" role="status">불러오는 중…</p>
    {:else if data.items.length}
      {#if rows.length}
        <div class="team-standings">
          <div class="team-standings-columns team-standings-header" aria-hidden="true">
            <span class="team-standings-heading">팀</span><span>경기</span><span>승</span><span>무</span><span>패</span><b>{metricLabel}</b>
          </div>
          <ol class="team-standings-list" start={rows[0]!.rank} aria-label="{metricLabel} 순 팀 랭킹">
            {#each rows as t (t.teamId)}
              {@const played = t.record.w + t.record.d + t.record.l}
              <li value={t.rank}>
                <button class="team-standings-columns team-standings-row" data-rank-team={t.teamId} aria-label="{t.rank}위 {t.name}, {n(played)}경기 {n(t.record.w)}승 {n(t.record.d)}무 {n(t.record.l)}패, {metricLabel} {sort === 'rating' ? n(t.rating) : t.ovr}, 최근 경기부터 {formText(t.recentForm)}, 팀 상세 보기" onclick={() => open(t.teamId)}>
                  <span class="team-standings-team"><span class="team-standings-rank num">{t.rank}</span><TeamLogo logo={t.logo} name={t.name} size={24} decorative /><b title={t.name}>{t.name}</b></span>
                  <span class="num" title="{n(played)}경기">{n(played)}</span>
                  <span class="num" title="{n(t.record.w)}승">{n(t.record.w)}</span>
                  <span class="num" title="{n(t.record.d)}무">{n(t.record.d)}</span>
                  <span class="num" title="{n(t.record.l)}패">{n(t.record.l)}</span>
                  <strong class="num team-standings-score">{sort === 'rating' ? n(t.rating) : t.ovr}</strong>
                  <span class="team-standings-form" aria-hidden="true">
                    {#each [0, 1, 2, 3, 4] as i (i)}
                      {@const result = t.recentForm?.[i]}
                      <span class="team-form-dot" class:won={result === 'W'} class:drawn={result === 'D'} class:lost={result === 'L'} data-team-form={result ?? 'empty'} title={result ? `${i + 1}번째 최근 경기: ${FORM_LABEL[result]}` : '경기 기록 없음'}>
                        {#if result}<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{#if result === 'W'}<path d="m4 8 3 3 5-6" />{:else if result === 'D'}<path d="M4 8h8" />{:else}<path d="m5 5 6 6m0-6-6 6" />{/if}</svg>{/if}
                      </span>
                    {/each}
                  </span>
                </button>
              </li>
            {/each}
          </ol>
        </div>
      {/if}
      {#if pages > 1}
        <nav class="hof-pager" aria-label="랭킹 페이지">
          <button class="icon-btn" data-rank-page="prev" disabled={page <= 1} onclick={() => goPage(page - 1)}>← 이전</button>
          <span class="num" aria-live="polite">{page} / {pages}</span>
          <button class="icon-btn" data-rank-page="next" disabled={page >= pages} onclick={() => goPage(page + 1)}>다음 →</button>
        </nav>
      {/if}
    {:else}
      <p class="empty">아직 랭킹에 오른 팀이 없어요. 구단주 화면에서 은퇴한 선수로 팀을 꾸리면 여기에 올라요.</p>
    {/if}
    <p class="muted fs-xs" style="margin-top:10px">레이팅은 팀 경기 결과로 오르내려요. 랭킹은 5분마다 갱신돼요.</p>
</section>
{/if}

<style>
  .team-ranking-toolbar {
    margin-bottom: 12px;
  }
  .team-ranking-total {
    text-align: right;
    padding-bottom: 10px;
    font-size: 12px;
  }
  .team-ranking-total b {
    color: var(--ink);
    font-size: 16px;
  }
  .team-sort-label {
    margin: 0 0 6px;
  }
  .team-ranking-sorts {
    flex-wrap: wrap;
    margin: 0 0 12px;
    padding: 0;
    overflow: visible;
    mask-image: none;
  }
  .team-standings {
    --stat-width: 20px;
    --score-width: 48px;
  }
  .team-standings-columns {
    display: grid;
    grid-template-columns: minmax(0, 1fr) max(28px, var(--stat-width)) repeat(3, var(--stat-width)) var(--score-width);
    align-items: center;
    gap: 4px;
    text-align: center;
  }
  .team-standings-header {
    white-space: nowrap;
    min-height: 36px;
    border-bottom: 1px solid var(--line);
    color: var(--muted);
    font-size: 12px;
  }
  .team-standings-heading {
    padding-left: 26px;
    text-align: left;
  }
  .team-standings-header b {
    color: var(--ink);
    font-weight: 600;
  }
  .team-standings-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .team-standings-list > li + li {
    border-top: 1px solid var(--line);
  }
  .team-standings-row {
    width: 100%;
    min-height: 60px;
    padding: 8px 0;
    border: 0;
    border-radius: 0;
    background: none;
    font-size: 14px;
  }
  .team-standings-row:active {
    background: color-mix(in srgb, var(--ink) 7%, transparent);
  }
  .team-standings-row > span,
  .team-standings-score {
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .team-standings-team {
    grid-column: 1;
    grid-row: 1;
    display: flex;
    align-items: center;
    gap: 6px;
    text-align: left;
  }
  .team-standings-rank {
    flex: 0 0 20px;
    color: var(--muted);
    text-align: center;
    font-size: 13px;
  }
  .team-standings-team b {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    font-weight: 600;
  }
  .team-standings-score {
    font-size: 16px;
    font-weight: 700;
  }
  .team-standings-row > .num {
    grid-row: 1 / 3;
  }
  .team-standings-form {
    grid-column: 1;
    grid-row: 2;
    display: flex;
    align-items: center;
    gap: 2px;
    padding-left: 26px;
  }
  .team-form-guide {
    margin: 0 0 6px;
    font-size: 12px;
  }
  .team-form-dot {
    display: grid;
    place-items: center;
    flex: 0 0 14px;
    width: 14px;
    height: 14px;
    border: 1px solid var(--line);
    border-radius: 50%;
  }
  .team-form-dot svg {
    width: 100%;
    height: 100%;
  }
  .team-form-dot.won,
  .team-form-dot.drawn,
  .team-form-dot.lost {
    border-color: currentColor;
    background: color-mix(in srgb, currentColor 14%, var(--surface));
  }
  .team-form-dot.won { color: var(--good); }
  .team-form-dot.drawn { color: var(--muted); }
  .team-form-dot.lost { color: var(--bad); }
  @media (min-width: 400px) {
    .team-standings {
      --stat-width: 28px;
      --score-width: 52px;
    }
    .team-standings-columns {
      gap: 6px;
    }
    .team-form-dot {
      flex-basis: 16px;
      width: 16px;
      height: 16px;
    }
  }
</style>
