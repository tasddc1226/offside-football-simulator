<script lang="ts">
  // T-10-005 명예의 전당: 모든 유저의 은퇴 선수(서버). 행을 누르면 상세로. 이 기기에서 은퇴한 선수에는
  // '내 선수' 표시를 단다. 내 선수 목록은 구단주 화면으로 옮겼다(T-10-058, MyPlayers).
  // 홈에서는 레전드 점수 TOP 3만 보여 주고, '전체 보기'(full)에서는 순위 유형(득점·도움·발롱도르…)을 골라
  // 10명씩 페이지로 나눠 보여 준다. score가 아닌 유형은 그 기록이 0인 선수를 뺀다(서버와 같은 규칙).
  // T-10-090 전체 보기는 '전체 / 시즌 1'을 고른다. 시즌 순위엔 개막 뒤 새로 만든 선수만 오른다(프리시즌 선수 제외).
  // T-11-029 '프리시즌' 탭은 개막 전에 만든 선수만 모은다(개막 뒤에 은퇴해도 포함). 홈 미리보기는 지금 시즌 TOP이다.
  // T-11-018 포지션별 순위 — 레전드 점수 상위권을 공격수가 채우므로 포지션 안에서도 겨루게 한다.
  import type { CareerPos, HofSort, PublicHofEntry } from '@offside/contracts';
  import { POS_GROUPS, POS_LABEL } from '@offside/contracts/positions';
  import { PRESEASON, SERVICE_SEASONS, previewSeasonAt, seasonById } from '@offside/contracts/service-seasons';
  import { kstMonthDayHour } from '@offside/app-core/boardText';
  import { loadHOF } from '@offside/game/season';
  import { getHof } from '@offside/app-core/api/client';
  import { openPublicLegend } from './legend.js';
  import { anonName, fmtValue, iGa } from '@offside/app-core/format';
  import { openHof } from './nav.js';
  import HofRow, { type RowStats } from './HofRow.svelte';
  import HofPodium from './HofPodium.svelte';
  import { appState } from './state.svelte.js';

  let { full = false }: { full?: boolean } = $props();
  const TOP = 3;
  const PER_PAGE = 10;
  // T-10-101 새로 생긴 순위 유형에 'NEW'를 이때까지 단다.
  const NEW_UNTIL: Partial<Record<HofSort, string>> = { value: '2026-10-14T00:00:00+09:00' };
  const isNew = (k: HofSort) => !!NEW_UNTIL[k] && Date.now() < Date.parse(NEW_UNTIL[k]);
  /** 아직 개막 전인 시즌인지(ISO 문자열 비교). */
  const notOpen = (s: { startsAt: string }) => new Date().toISOString() < s.startsAt;

  const SORTS: Record<HofSort, { label: string; unit: string; get: (s: RowStats) => number | string }> = {
    score: { label: '레전드 점수', unit: '', get: (s) => s.score },
    // T-10-100 은퇴 가치(만 원) — 조·억·천만으로 적는다.
    value: { label: '은퇴 가치', unit: '', get: (s) => fmtValue(s.value ?? 0) },
    goals: { label: '득점', unit: '골', get: (s) => s.goals },
    assists: { label: '도움', unit: '도움', get: (s) => s.assists },
    ga: { label: '공격포인트', unit: 'P', get: (s) => s.goals + s.assists },
    apps: { label: '출전', unit: '경기', get: (s) => s.apps },
    trophies: { label: '트로피', unit: '개', get: (s) => s.trophies },
    awards: { label: '개인상', unit: '회', get: (s) => s.awards },
    ballon: { label: '발롱도르', unit: '회', get: (s) => s.ballon },
    caps: { label: 'A매치', unit: '경기', get: (s) => s.caps },
    peak: { label: '최고 OVR', unit: '', get: (s) => s.peak },
  };
  const SORT_KEYS = Object.keys(SORTS) as HofSort[];
  // 전체 보기의 페이지·유형은 appState에 둬 선수 상세에서 돌아와도 그대로다.
  const page = $derived(full ? appState.hof.page : 1);
  const sort = $derived<HofSort>(full ? appState.hof.sort : 'score');
  const by = $derived(SORTS[sort]);
  // 홈 미리보기는 지금 시즌 고정(개막 전엔 프리시즌 = 전체와 같아 시즌 없이 같은 요청·캐시를 쓴다).
  const homeSeason = previewSeasonAt(new Date().toISOString());
  const season = $derived(full ? appState.hof.season : homeSeason);
  const q = $derived(full ? appState.hof.q : '');
  const pos = $derived(full ? appState.hof.pos : null);
  const ss = $derived(season === null ? undefined : seasonById(season));
  /** 고른 시즌이 아직 개막 전이면 그 시즌(목록 대신 개막 안내). */
  const upcoming = $derived(ss && notOpen(ss) ? ss : undefined);
  /** 문구 앞에 붙는 시즌·포지션 이름('시즌 1 수비수 '). 둘 다 전체면 빈 문자열. */
  const scope = $derived(`${ss ? `${ss.name} ` : ''}${pos ? `${POS_LABEL[pos]} ` : ''}`);
  let all = $state<PublicHofEntry[] | null>(null);
  let total = $state(0);
  let failed = $state(false);
  let filtering = $state(false);

  function pickSeason(id: number | null) {
    appState.hof = { ...appState.hof, season: id, page: 1 };
  }
  function pickPos(p: CareerPos | null) {
    appState.hof = { ...appState.hof, pos: p, page: 1 };
  }
  function pickSort(s: HofSort) {
    appState.hof = { ...appState.hof, sort: s, page: 1 };
    filtering = false;
  }
  // 타자를 멈추고 0.3초 뒤에 찾는다(글자마다 서버를 부르지 않게).
  let draft = $state(appState.hof.q);
  let typing: ReturnType<typeof setTimeout> | undefined;
  function onSearch() {
    clearTimeout(typing);
    typing = setTimeout(() => {
      const next = draft.trim();
      if (next !== appState.hof.q) appState.hof = { ...appState.hof, q: next, page: 1 };
    }, 300);
  }
  // T-10-105 검색 칸은 돋보기를 눌러 연다(검색어가 남아 있으면 열린 채로). 닫으면 검색도 푼다.
  let searching = $state(!!appState.hof.q);
  function toggleSearch() {
    searching = !searching;
    if (!searching && draft) {
      draft = '';
      onSearch();
    }
  }
  const focusIn = (el: HTMLElement) => el.focus();
  function goPage(p: number) {
    appState.hof.page = p;
    window.scrollTo(0, 0);
  }

  $effect(() => {
    const [p, s, se, qq, po] = [page, sort, season, q, pos];
    all = null;
    failed = false;
    if (upcoming) return;
    void getHof(full ? PER_PAGE : TOP, p, s, se, qq, po).then((r) => {
      if (p !== page || s !== sort || se !== season || qq !== q || po !== pos) return; // 더 늦게 고른 페이지·유형·시즌·검색어·포지션의 응답만 쓴다.
      if (r.ok) {
        all = r.data.entries;
        total = r.data.total ?? r.data.entries.length;
      } else failed = true;
    });
  });

  const myIds = new Set(loadHOF().map((h) => h.id).filter(Boolean));
  const offset = $derived((page - 1) * PER_PAGE);
  const pages = $derived(Math.max(1, Math.ceil(total / PER_PAGE)));
  const podium = $derived(
    full && page === 1 && !q
      ? (all ?? []).slice(0, TOP).map((h, i) => ({
          entry: h,
          rank: h.rank ?? i + 1,
          value: by.get({ ...h, score: h.legendScore }),
          own: myIds.has(h.id),
        })).filter((h) => h.rank <= TOP)
      : [],
  );
  const podiumIds = $derived(new Set(podium.map((h) => h.entry.id)));
  const emptyText = $derived(
    q
      ? `'${q}'${iGa(q)} 들어간 이름의 ${scope}선수가 없어요.`
      : sort === 'score'
      ? `아직 ${scope}은퇴 선수가 없어요.`
      : `아직 ${by.label} 기록이 있는 ${scope}은퇴 선수가 없어요.`,
  );
</script>

{#snippet pager()}
  {#if full && pages > 1}
    <nav class="hof-pager" aria-label="명예의 전당 페이지">
      <button class="icon-btn" data-hof-page="prev" disabled={page <= 1} onclick={() => goPage(page - 1)}>← 이전</button>
      <span class="num" aria-live="polite">{page} / {pages}</span>
      <button class="icon-btn" data-hof-page="next" disabled={page >= pages} onclick={() => goPage(page + 1)}>다음 →</button>
    </nav>
  {/if}
{/snippet}

{#snippet playerRow(h: PublicHofEntry, i: number)}
  {@const t = { ...h, score: h.legendScore }}
  <button class="hof-row" data-hof-id={h.id} onclick={() => void openPublicLegend(h)}>
    <HofRow
      rank={h.rank ? h.rank - 1 : offset + i}
      name={h.name ?? anonName(h.pos, h.number)}
      pos={h.pos}
      dpos={h.dpos}
      nation={h.nation}
      club={h.lastClub}
      clubId={h.lastClubId}
      rn={h.retiredNumber?.number}
      tag={myIds.has(h.id) ? '내 선수' : null}
      {t}
      titleId={h.title}
      value={by.get(t)}
      unit={by.unit}
      showScore={sort !== 'score'}
      flow={!full}
      compact={full}
      showPosition={pos === null}
    />
  </button>
{/snippet}

<section class="card" data-hof={full ? 'full' : 'home'}>
  {#if !full}
    <div class="hof-head">
      <div>
        <div class="eyebrow">Legends</div>
        <h2 style="margin-bottom:8px">명예의 전당</h2>
      </div>
      {#if all?.length}
        <button class="icon-btn" data-act="hof-all" onclick={openHof}>전체 보기</button>
      {/if}
    </div>
  {/if}
  {#if full}
    <div class="hof-toolbar">
      <label class="hof-season-picker">
        <span class="hof-filter-label">시즌</span>
        <select aria-label="기록 시즌" data-hof-season-select value={season === null ? 'all' : String(season)} onchange={(e) => pickSeason(e.currentTarget.value === 'all' ? null : Number(e.currentTarget.value))}>
          <option value="all">전체 시즌</option>
          {#each [PRESEASON, ...SERVICE_SEASONS] as s (s.id)}
            <option value={String(s.id)}>{s.name}{notOpen(s) ? ' (개막 예정)' : ''}</option>
          {/each}
        </select>
      </label>
      {#if !upcoming}
        <div class="hof-filter-picker">
          <span class="hof-filter-label" aria-hidden="true">필터</span>
          <button class="hof-filter-trigger" aria-label="필터, {pos ? POS_LABEL[pos] : '전체 포지션'}, {by.label}" aria-expanded={filtering} aria-controls="hof-filter-panel" data-hof-filters onclick={() => (filtering = !filtering)}>
            <span class="hof-filter-current">{pos ? `${POS_LABEL[pos]} · ` : ''}{by.label}</span>
            <svg class="hof-filter-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
          </button>
        </div>
        <button class="hof-search-btn" aria-label="선수 이름 검색" aria-expanded={searching} data-act="hof-search" onclick={toggleSearch}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
        </button>
      {/if}
    </div>
  {#if full && searching && !upcoming}
    <input class="hof-search" type="search" placeholder="선수 이름 검색" aria-label="선수 이름 검색" maxlength="20" enterkeyhint="search" data-hof-search bind:value={draft} oninput={onSearch} use:focusIn />
  {/if}
    {#if !upcoming}
      <div class="hof-filter-panel" id="hof-filter-panel" hidden={!filtering}>
        <p class="hof-filter-label">포지션</p>
        <div class="seg hof-pos" role="group" aria-label="포지션">
          <button class="hof-sort" aria-pressed={pos === null} data-hof-pos="all" onclick={() => pickPos(null)}>전체</button>
          {#each POS_GROUPS as k (k)}
            <button class="hof-sort" aria-pressed={pos === k} data-hof-pos={k} onclick={() => pickPos(k)}>{POS_LABEL[k]}</button>
          {/each}
        </div>
        <p class="hof-filter-label">순위 기준</p>
        <div class="hof-sorts" role="group" aria-label="순위 유형">
          {#each SORT_KEYS as k (k)}
            <button class="hof-sort" aria-pressed={sort === k} data-hof-sort={k} onclick={() => pickSort(k)}>{SORTS[k].label}{#if isNew(k)}<small class="hof-new" aria-hidden="true">NEW</small>{/if}</button>
          {/each}
        </div>
      </div>
    {/if}
  {/if}

  {#if upcoming}
    <div class="empty hof-season-note" data-hof-upcoming>
      <b>{upcoming.name}은 {kstMonthDayHour(upcoming.startsAt)}(한국 시각)에 개막해요.</b>
      <p>개막 뒤 새로 만든 선수가 은퇴하면 여기에 올라요. 지금(프리시즌) 만든 선수는 '프리시즌'과 '전체' 명예의 전당에 남아요.</p>
    </div>
  {:else if all === null && !failed}
    <p class="empty">불러오는 중…</p>
  {:else if failed}
    <p class="empty">명예의 전당을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>
  {:else if all && all.length}
    {#if full}<p class="muted hof-source">{scope && `${scope}· `}{q ? `'${q}' 검색 ` : ''}{sort === 'score' ? '은퇴 선수' : `${by.label} 기록이 있는 선수`} {total}명 · {by.label} 순</p>{/if}
    {#if !full && ss}<p class="muted hof-source">{ss.name} · 레전드 점수 순</p>{/if}
    {#if podium.length}
      <HofPodium players={podium} label={by.label} unit={by.unit} showPosition={pos === null} />
    {/if}
    {#if full}
      {#if all.length > podium.length}
        <div class="hof-list-head"><span>선수</span><span>{by.label}</span></div>
      {/if}
      <ol class="hof-ranking-list" start={offset + podium.length + 1}>
        {#each all as h, i (h.id)}
          {#if !podiumIds.has(h.id)}
            <li>{@render playerRow(h, i)}</li>
          {/if}
        {/each}
      </ol>
    {:else}
      {#each all as h, i (h.id)}
        {@render playerRow(h, i)}
      {/each}
    {/if}
    {@render pager()}
  {:else}
    <p class="empty">{emptyText}</p>
  {/if}
</section>
