<script lang="ts">
  // T-10-092 라이브 랭킹(팀 랭킹) — 기록실 탭. 선수가 한 명 이상 있는 구단주 팀을 시즌별로 레이팅(경기 결과) 또는 팀 OVR
  // 순으로 보여 주고, 줄을 누르면 팀 프로필(appState.hof.team)을 연다. 서버가 5분마다 새로 센다.
  import { TEAM_RANK_PER_PAGE } from '@offside/contracts/owner-team';
  import { fetchTeamRanking, type TeamRankResponse, type TeamRankSort } from '../../api/team.js';
  import Laurel from '../Laurel.svelte';
  import { appState } from '../state.svelte.js';
  import TeamProfile from './TeamProfile.svelte';
  import { num as n, recordText } from './teamText.js';

  const MEDAL = ['gold', 'silver', 'bronze'];
  const SORTS: [TeamRankSort, string][] = [
    ['rating', '레이팅'],
    ['ovr', '팀 OVR'],
  ];
  /** undefined = 지금 시즌(서버가 정한다). */
  let season = $state<number | undefined>(undefined);
  let sort = $state<TeamRankSort>('rating');
  let page = $state(1);
  let data = $state<TeamRankResponse | null>(null);
  let failed = $state(false);

  $effect(() => {
    const [se, so, p] = [season, sort, page];
    failed = false;
    void fetchTeamRanking(se, so, p).then((r) => {
      if (se !== season || so !== sort || p !== page) return; // 더 늦게 고른 조건의 응답만 쓴다.
      if (r.ok) data = r.data;
      else failed = true;
    });
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
    <div class="eyebrow">Live ranking</div>
    <h1 style="margin-bottom:8px">라이브 랭킹</h1>
    {#if data && data.seasons.length > 1}
      <div class="seg board-tabs hof-seasons" role="group" aria-label="시즌">
        {#each data.seasons as s (s.id)}
          <button class="opt" aria-pressed={data.season === s.id} data-rank-season={s.id} onclick={() => ((season = s.id), (page = 1))}>{s.name}</button>
        {/each}
      </div>
    {/if}
    <div class="hof-sorts" role="group" aria-label="순위 유형">
      {#each SORTS as [k, label] (k)}
        <button class="hof-sort" aria-pressed={sort === k} data-rank-sort={k} onclick={() => ((sort = k), (page = 1))}>{label}</button>
      {/each}
    </div>
    {#if failed}
      <p class="empty">랭킹을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
    {:else if !data}
      <p class="empty">불러오는 중…</p>
    {:else if data.items.length}
      <p class="muted hof-source">{data.seasons.find((s) => s.id === data?.season)?.name} · 팀 {n(data.total)}개 · {sort === 'rating' ? '레이팅' : '팀 OVR'} 순</p>
      {#each data.items as t (t.teamId)}
        <button class="hof-row" data-rank-team={t.teamId} onclick={() => open(t.teamId)}>
          {#if t.rank <= MEDAL.length}
            <div class="hof-rank medal {MEDAL[t.rank - 1]}"><Laurel /><span>{t.rank}</span></div>
          {:else}
            <div class="hof-rank">{t.rank}</div>
          {/if}
          <div>
            <b>{t.name}</b> <span class="muted fs-sm">· {t.manager}</span>
            <div class="muted fs-xs">{t.formation} · {recordText(t.record)} · OVR {t.ovr}{t.likes ? ` · ♥ ${n(t.likes)}` : ''}</div>
          </div>
          <div class="num hof-value">{sort === 'rating' ? n(t.rating) : t.ovr}</div>
        </button>
      {/each}
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
    <p class="muted fs-xs" style="margin-top:10px">레이팅은 팀 경기 결과로 오르내려요. 랭킹은 5분마다 새로 세요.</p>
  </section>
{/if}
