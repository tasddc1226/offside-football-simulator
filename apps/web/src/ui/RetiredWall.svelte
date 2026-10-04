<script lang="ts" module>
  import type { CareerPos } from '@offside/contracts';
  // 시즌·정렬·조건은 선수 상세에 다녀와도 그대로 둔다.
  // season이 null이면 지금 시즌(개막 전이면 프리시즌).
  const view = $state<{ order: 'club' | 'recent'; season: number | null; pos: CareerPos | null; clubId: string | null }>({ order: 'club', season: null, pos: null, clubId: null });
</script>

<script lang="ts">
  // T-10-076 기록실 '영구결번' 탭 — 서버의 모든 결번을 구단별(결번 많은 구단 먼저) 또는 최신순으로 본다.
  // 유니폼은 구단 엠블럼 색(rnStyle), 누르면 그 선수의 은퇴 상세.
  // 결번은 시즌마다 따로 — 프리시즌 선수가 찬 번호도 시즌 1에서는 새로 받을 수 있다.
  import type { RetiredNumbersResponse } from '@offside/contracts';
  import { PRESEASON, SERVICE_SEASONS, displaySeasonAt, seasonById, teamSeasonName } from '@offside/contracts/service-seasons';
  import { kstMonthDayHour } from '@offside/app-core/boardText';
  import { POS_GROUPS } from '@offside/contracts/positions';
  import { getRetiredNumbers } from '@offside/app-core/api/client';
  import { POS } from '@offside/game/data';
  import { loadHOF } from '@offside/game/season';
  import ClubMark from './ClubMark.svelte';
  import { anonName } from '@offside/app-core/format';
  import { openPublicLegendById } from './legend.js';
  import { RN_SHIRT, RN_TRIM, rnStyle } from '@offside/app-core/rnStyle';
  import { rnByClub, rnClubName as clubName, rnDay as day, rnLeagueName as leagueOf, rnRecent } from '@offside/app-core/retiredWall';

  type Item = RetiredNumbersResponse['items'][number];

  const now = new Date().toISOString();
  const seasons = [PRESEASON, ...SERVICE_SEASONS];
  const season = $derived(view.season ?? displaySeasonAt(now));
  const selectedSeason = $derived(seasonById(season));
  const upcoming = $derived(selectedSeason && selectedSeason.startsAt > now ? selectedSeason : undefined);
  let filtering = $state(false);
  let items = $state<Item[] | null>(null);
  let failed = $state(false);
  $effect(() => {
    const se = season;
    items = null;
    failed = false;
    if (upcoming) return;
    void getRetiredNumbers(se).then((r) => {
      if (se !== season) return; // 더 늦게 고른 시즌의 응답만 쓴다.
      if (r.ok) items = r.data.items;
      else failed = true;
    });
  });

  const myIds = new Set(loadHOF().map((h) => h.id).filter(Boolean));
  const clubOptions = $derived(rnByClub(items ?? []).map((list) => list[0]!).sort((a, b) => clubName(a).localeCompare(clubName(b), 'ko')));
  const filtered = $derived((items ?? []).filter((it) => (!view.pos || it.pos === view.pos) && (!view.clubId || it.clubId === view.clubId)));
  const clubs = $derived(rnByClub(filtered));
  const recent = $derived(rnRecent(filtered));
  const filterCount = $derived(Number(!!view.pos) + Number(!!view.clubId));
  const pickedClub = $derived(clubOptions.find((it) => it.clubId === view.clubId));
  const filterLabel = $derived([pickedClub ? clubName(pickedClub) : '', view.pos ? POS[view.pos].label : '', view.order === 'club' ? '구단별' : '최신순'].filter(Boolean).join(' · '));

  function pickSeason(id: number) {
    view.season = id;
    view.clubId = null;
  }
  function pickOrder(order: 'club' | 'recent') {
    view.order = order;
    filtering = false;
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
    {#if (withClub && !view.clubId) || !view.pos}
      <span class="muted fs-xs">
        {#if withClub && !view.clubId}<ClubMark name={it.club} id={it.clubId} size={14} /> {clubName(it)}{:else}{POS[it.pos].label}{/if}
      </span>
    {/if}
    <span class="muted fs-xs num">{it.seq}번째 · {day(it.grantedAt)}</span>
    {#if myIds.has(it.careerId)}<span class="pill rn-tile-mine">내 선수</span>{/if}
  </button>
{/snippet}

<section class="card" data-rn-wall>
  <div class="hof-toolbar">
    <label class="hof-season-picker">
      <span class="hof-filter-label">시즌</span>
      <select aria-label="영구결번 시즌" data-rn-season-select value={String(season)} onchange={(e) => pickSeason(Number(e.currentTarget.value))}>
        {#each seasons as s (s.id)}<option value={String(s.id)}>{s.name}{s.startsAt > now ? ' (개막 예정)' : ''}</option>{/each}
      </select>
    </label>
    {#if !upcoming}
      <div class="hof-filter-picker">
        <span class="hof-filter-label" aria-hidden="true">필터</span>
        <button class="hof-filter-trigger" aria-label="영구결번 필터, {filterLabel}" aria-expanded={filtering} aria-controls="rn-filter-panel" data-rn-filters onclick={() => (filtering = !filtering)}>
          <span class="hof-filter-current">{filterLabel}</span>
          <svg class="hof-filter-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
        </button>
      </div>
    {/if}
  </div>
  {#if !upcoming}
    <div class="hof-filter-panel" id="rn-filter-panel" hidden={!filtering}>
      <p class="hof-filter-label">포지션</p>
      <div class="seg hof-pos" role="group" aria-label="포지션">
        <button class="hof-sort" aria-pressed={view.pos === null} data-rn-pos="all" onclick={() => (view.pos = null)}>전체</button>
        {#each POS_GROUPS as pos (pos)}<button class="hof-sort" aria-pressed={view.pos === pos} data-rn-pos={pos} onclick={() => (view.pos = pos)}>{POS[pos].label}</button>{/each}
      </div>
      <label class="hof-season-picker rn-club-picker">
        <span class="hof-filter-label">구단</span>
        <select aria-label="영구결번 구단" data-rn-club-select value={view.clubId ?? 'all'} onchange={(e) => (view.clubId = e.currentTarget.value === 'all' ? null : e.currentTarget.value)}>
          <option value="all">전체 구단</option>
          {#each clubOptions as club (club.clubId)}<option value={club.clubId}>{clubName(club)}</option>{/each}
        </select>
      </label>
      <p class="hof-filter-label">정렬</p>
      <div class="hof-sorts" role="group" aria-label="정렬">
        <button class="hof-sort" aria-pressed={view.order === 'club'} data-rn-order="club" onclick={() => pickOrder('club')}>구단별</button>
        <button class="hof-sort" aria-pressed={view.order === 'recent'} data-rn-order="recent" onclick={() => pickOrder('recent')}>최신순</button>
        {#if filterCount}<button class="hof-sort" data-rn-filter-reset onclick={() => { view.pos = null; view.clubId = null; }}>조건 초기화</button>{/if}
      </div>
    </div>
  {/if}
  <p class="muted fs-sm rn-wall-lead">한 구단에서 오래 활약한 선수의 등번호는 다시 쓰지 않아요. 구단마다 한 번호에 한 명뿐이에요.</p>

  {#if upcoming}
    <div class="empty hof-season-note" data-rn-upcoming><b>{upcoming.name}은 {kstMonthDayHour(upcoming.startsAt)}(한국 시각)에 개막해요.</b></div>
  {:else if items === null && !failed}
    <p class="empty">불러오는 중…</p>
  {:else if failed}
    <p class="empty">영구결번을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>
  {:else if filtered.length}
    <div class="rn-wall-sum">
      <div><b class="num">{filtered.length}</b><small>결번</small></div>
      <div><b class="num">{clubs.length}</b><small>구단</small></div>
      <div><b class="num">{day(recent[0]!.grantedAt)}</b><small>최근 결번</small></div>
    </div>
    {#if view.order === 'club'}
      {#each clubs as list (list[0]!.clubId)}
        {@const c = list[0]!}
        <div class="rn-club" data-rn-club={c.clubId}>
          <div class="rn-club-head">
            <ClubMark name={c.club} id={c.clubId} size={22} />
            <b>{clubName(c)}</b>
            <span class="muted fs-xs">{leagueOf(c.clubId)}</span>
            <span class="num rn-club-count">{list.length}</span>
          </div>
          <div class="rn-tiles">
            {#each list as it (it.seq)}{@render tile(it, false)}{/each}
          </div>
        </div>
      {/each}
    {:else}
      <div class="rn-tiles">
        {#each recent as it (it.seq)}{@render tile(it, true)}{/each}
      </div>
    {/if}
  {:else}
    <p class="empty">{filterCount ? '선택한 조건에 맞는 영구결번이 없어요.' : `아직 ${teamSeasonName(season)} 영구결번이 없어요.`}</p>
  {/if}
</section>
