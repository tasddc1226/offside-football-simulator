<script lang="ts" module>
  import type { CareerPos } from '@offside/contracts';
  import type { RnClubOrder } from '@offside/app-core/retiredWall';
  // 시즌·화면·정렬·조건은 선수 상세에 다녀와도 그대로 둔다.
  // season이 null이면 지금 시즌(개막 전이면 프리시즌).
  const view = $state<{ season: number | null; screen: 'home' | 'club' | 'recent'; clubId: string | null; clubOrder: RnClubOrder; pos: CareerPos | null }>({ season: null, screen: 'home', clubId: null, clubOrder: 'count', pos: null });
</script>

<script lang="ts">
  import { tn } from '@offside/game/i18n/names';
  // T-10-076 기록실 '영구결번' 탭. 유니폼은 구단 엠블럼 색(rnStyle), 누르면 그 선수의 은퇴 상세.
  // 결번은 시즌마다 따로 — 프리시즌 선수가 찬 번호도 시즌 1에서는 새로 받을 수 있다.
  // T-11-101 첫 화면은 요약(구단별 결번 수·최근 결번 8개)만 받는다. 결번 타일은 구단을 고르거나 최신순 전체를 열 때 받는다.
  import type { RetiredNumbersResponse, RetiredNumbersSummary } from '@offside/contracts';
  import { PRESEASON, SERVICE_SEASONS, displaySeasonAt, seasonById } from '@offside/contracts/service-seasons';
  import { kstMonthDayHour } from '@offside/app-core/boardText';
  import { POS_GROUPS } from '@offside/contracts/positions';
  import { getRetiredNumbersOfClub, getRetiredNumbersPage, getRetiredNumbersSummary } from '@offside/app-core/api/client';
  import { POS } from '@offside/game/data';
  import { loadHOF } from '@offside/game/season';
  import ClubMark from './ClubMark.svelte';
  import { seasonNow } from './seasonNow.svelte.js';
  import { anonName } from '@offside/app-core/format';
  import { openPublicLegendById } from './legend.js';
  import { RN_SHIRT, RN_TRIM, rnStyle } from '@offside/app-core/rnStyle';
  import { rnByLeague, rnClubName, rnDay as day, rnLeagueName } from '@offside/app-core/retiredWall';

  import { hofRnText as L } from '@offside/app-core/i18n/ko/hofRn';
  import { seasonLabel, teamSeasonLabel } from '@offside/app-core/seasonName';
  const clubName = (x: Parameters<typeof rnClubName>[0]) => rnClubName(x);
  const leagueOf = (clubId: string) => rnLeagueName(clubId);
  type Item = RetiredNumbersResponse['items'][number];

  const clock = seasonNow();
  const now = $derived(clock.now);
  const seasons = [PRESEASON, ...SERVICE_SEASONS];
  const season = $derived(view.season ?? displaySeasonAt(now));
  const selectedSeason = $derived(seasonById(season));
  const upcoming = $derived(selectedSeason && selectedSeason.startsAt > now ? selectedSeason : undefined);

  // 요약은 60초 메모라 첫 화면으로 돌아와도 요청이 다시 나가지 않는다.
  let summary = $state<RetiredNumbersSummary | null>(null);
  let items = $state<Item[] | null>(null);
  let next = $state<number | null>(null);
  let more = $state(false);
  let failed = $state(false);
  let listFailed = $state(false);

  $effect(() => {
    const se = season;
    summary = null;
    failed = false;
    if (upcoming) return;
    void getRetiredNumbersSummary(se).then((r) => {
      if (se !== season) return; // 더 늦게 고른 시즌의 응답만 쓴다.
      if (r.ok) summary = r.data;
      else failed = true;
    });
  });
  // 구단 화면·최신순 화면의 결번 타일.
  $effect(() => {
    const key = `${season}|${view.screen}|${view.clubId}`;
    const se = season;
    const club = view.clubId;
    items = null;
    next = null;
    listFailed = false;
    if (upcoming || view.screen === 'home') return;
    const req = view.screen === 'club' && club ? getRetiredNumbersOfClub(se, club) : getRetiredNumbersPage(se, 0);
    void req.then((r) => {
      if (key !== `${season}|${view.screen}|${view.clubId}`) return;
      if (!r.ok) return void (listFailed = true);
      items = r.data.items;
      next = r.data.next ?? null;
    });
  });
  async function loadMore() {
    if (next === null || more) return;
    const se = season;
    more = true;
    const r = await getRetiredNumbersPage(se, next);
    more = false;
    if (se !== season || view.screen !== 'recent' || !r.ok) return;
    items = [...(items ?? []), ...r.data.items];
    next = r.data.next ?? null;
  }

  const myIds = new Set(loadHOF().map((h) => h.id).filter(Boolean));
  // 구단 화면 머리(이름·결번 수)는 받은 목록에서 — 서버가 그 구단 결번을 모두 준다.
  const pickedClub = $derived(items?.[0] && view.screen === 'club' ? { clubId: items[0].clubId, club: items[0].club, count: items.length } : undefined);
  const shown = $derived((items ?? []).filter((it) => !view.pos || it.pos === view.pos));
  const leagues = $derived(rnByLeague(summary?.clubs ?? []));

  function pickSeason(id: number) {
    view.season = id;
    goHome();
  }
  function goHome() {
    view.screen = 'home';
    view.clubId = null;
    view.pos = null;
  }
  function openClub(clubId: string) {
    view.screen = 'club';
    view.clubId = clubId;
    view.pos = null;
  }
</script>

{#snippet tile(it: Item, withClub: boolean)}
  <button class="rn-tile" style={rnStyle(it.clubId)} data-rn-tile={it.seq} onclick={() => void openPublicLegendById(it.careerId)}>
    <svg class="rn-jersey rn-tile-shirt" viewBox="0 0 120 124" aria-hidden="true">
      <path class="rn-shirt" d={RN_SHIRT} />
      <path class="rn-trim" d={RN_TRIM} />
      <text class="rn-jersey-num" x="60" y="92">{it.number}</text>
    </svg>
    <b class="rn-tile-name">{it.name ?? anonName(it.pos, it.number)}</b>
    {#if withClub || !view.pos}
      <span class="muted fs-xs">
        {#if withClub}<ClubMark name={it.club} id={it.clubId} size={14} /> {clubName(it)}{:else}{POS[it.pos].label}{/if}
      </span>
    {/if}
    <span class="muted fs-xs num">{L.tileSeq({ seq: it.seq, day: day(it.grantedAt) })}</span>
    {#if myIds.has(it.careerId)}<span class="pill rn-tile-mine">{L.mine}</span>{/if}
  </button>
{/snippet}

{#snippet clubRow(c: RetiredNumbersSummary['clubs'][number], withLeague: boolean)}
  <button class="rn-club-row" data-rn-club={c.clubId} onclick={() => openClub(c.clubId)}>
    <ClubMark name={c.club} id={c.clubId} size={22} />
    <b>{clubName(c)}</b>
    {#if withLeague}<span class="muted fs-xs">{leagueOf(c.clubId)}</span>{/if}
    <span class="num rn-club-count">{c.count}</span>
    <span class="rn-club-go" aria-hidden="true">›</span>
  </button>
{/snippet}

<section class="card" data-rn-wall data-rn-screen={view.screen}>
  <div class="hof-toolbar">
    <label class="hof-season-picker">
      <span class="hof-filter-label">{L.season}</span>
      <select aria-label={L.seasonAria} data-rn-season-select value={String(season)} onchange={(e) => pickSeason(Number(e.currentTarget.value))}>
        {#each seasons as s (s.id)}<option value={String(s.id)}>{seasonLabel(s.id, s.name)}{s.startsAt > now ? L.notOpen : ''}</option>{/each}
      </select>
    </label>
  </div>

  {#if upcoming || view.screen === 'home'}
    <p class="muted fs-sm rn-wall-lead">{L.lead}</p>
  {/if}
  {#if upcoming}
    <div class="empty hof-season-note" data-rn-upcoming><b>{L.opens({ name: seasonLabel(upcoming.id, upcoming.name), when: kstMonthDayHour(upcoming.startsAt) })}</b></div>
  {:else if failed || (view.screen !== 'home' && listFailed)}
    <p class="empty">{L.loadFailed}</p>
  {:else if view.screen === 'home'}
    {#if summary === null}
      <p class="empty">{L.loading}</p>
    {:else if summary.total}
      <div class="rn-wall-sum">
        <div><b class="num">{summary.total}</b><small>{L.sumRetired}</small></div>
        <div><b class="num">{summary.clubs.length}</b><small>{L.sumClubs}</small></div>
        <div><b class="num">{day(summary.recent[0]!.grantedAt)}</b><small>{L.sumRecent}</small></div>
      </div>
      <div class="rn-sec-head">
        <h2>{L.recentTitle}</h2>
        <button class="link-btn" data-rn-recent-all onclick={() => (view.screen = 'recent')}>{L.seeAll}</button>
      </div>
      <div class="rn-tiles">
        {#each summary.recent as it (it.seq)}{@render tile(it, true)}{/each}
      </div>
      <div class="rn-sec-head">
        <h2>{L.clubsTitle}</h2>
        <div class="hof-sorts" role="group" aria-label={L.clubOrderLabel}>
          <button class="hof-sort" aria-pressed={view.clubOrder === 'count'} data-rn-club-order="count" onclick={() => (view.clubOrder = 'count')}>{L.orderCount}</button>
          <button class="hof-sort" aria-pressed={view.clubOrder === 'league'} data-rn-club-order="league" onclick={() => (view.clubOrder = 'league')}>{L.orderLeague}</button>
        </div>
      </div>
      {#if view.clubOrder === 'count'}
        <div class="rn-club-list">
          {#each summary.clubs as c (c.clubId)}{@render clubRow(c, true)}{/each}
        </div>
      {:else}
        {#each leagues as g (g.league)}
          <p class="rn-league-head" data-rn-league={g.league}><span>{tn(g.league)}</span> <span class="num">{g.count}</span></p>
          <div class="rn-club-list">
            {#each g.clubs as c (c.clubId)}{@render clubRow(c, false)}{/each}
          </div>
        {/each}
      {/if}
    {:else}
      <p class="empty">{L.empty({ season: teamSeasonLabel(season) })}</p>
    {/if}
  {:else}
    <button class="link-btn rn-back" data-rn-back onclick={goHome}>{L.backWeb}</button>
    {#if view.screen === 'club'}
      <div class="rn-club-head rn-club-title">
        {#if pickedClub}
          <ClubMark name={pickedClub.club} id={pickedClub.clubId} size={28} />
          <b>{clubName(pickedClub)}</b>
          <span class="muted fs-xs">{leagueOf(pickedClub.clubId)}</span>
          <span class="num rn-club-count">{pickedClub.count}</span>
        {/if}
      </div>
      <div class="hof-sorts" role="group" aria-label={L.positionLabel}>
        <button class="hof-sort" aria-pressed={view.pos === null} data-rn-pos="all" onclick={() => (view.pos = null)}>{L.all}</button>
        {#each POS_GROUPS as pos (pos)}<button class="hof-sort" aria-pressed={view.pos === pos} data-rn-pos={pos} onclick={() => (view.pos = pos)}>{POS[pos].label}</button>{/each}
      </div>
    {:else}
      <h2 class="rn-recent-title">{L.recentAll}</h2>
    {/if}
    {#if items === null}
      <p class="empty">{L.loading}</p>
    {:else if shown.length}
      <div class="rn-tiles">
        {#each shown as it (it.seq)}{@render tile(it, view.screen === 'recent')}{/each}
      </div>
      {#if view.screen === 'recent' && next !== null}
        <button class="btn btn-block rn-more" data-rn-more disabled={more} onclick={() => void loadMore()}>{more ? L.loading : L.more}</button>
      {/if}
    {:else}
      <p class="empty">{L.noMatchWeb}</p>
    {/if}
  {/if}
</section>
