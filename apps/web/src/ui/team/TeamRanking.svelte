<script lang="ts">
  import Skeleton from '../Skeleton.svelte';
  import { seasonLabel } from '@offside/app-core/seasonName';
  // T-10-092 라이브 랭킹(팀 랭킹) — 기록실 탭. 선수가 한 명 이상 있는 구단주 팀을 시즌별로 레이팅(경기 결과) 또는 팀 OVR
  // 순으로 보여 주고, 줄을 누르면 팀 프로필(appState.hof.team)을 연다. 서버가 5분마다 새로 센다.
  import { TEAM_RANK_PER_PAGE } from '@offside/contracts/owner-team';
  import { displaySeasonAt, openTeamSeasons, teamSeasonName } from '@offside/contracts/service-seasons';
  import { fetchMyTeamRank, fetchTeamDivisions, fetchTeamRanking, type TeamDivisionsResponse, type TeamRankResponse, type TeamRankSort } from '@offside/app-core/api/team';
  import { divisionName, TEAM_DIVISION_KEYS } from '@offside/app-core/teamDivision';
  import { teamDivisionText as LD } from '@offside/app-core/i18n/ko/teamDivision';
  import DivisionEmblem from './DivisionEmblem.svelte';
  import { canJumpToMyRank, myRankJump } from '@offside/app-core/myRank';
  import { isMember } from '@offside/app-core/account';
  import { accountCache } from '../account-state.svelte.js';
  import { toast } from '../helpers.js';
  import { tick } from 'svelte';
  import { seasonNow } from '../seasonNow.svelte.js';
  import { appState } from '../state.svelte.js';
  import TeamProfile from './TeamProfile.svelte';
  import TeamLogo from './TeamLogo.svelte';
  import { num as n } from '@offside/app-core/teamText';
  import { fmtValue } from '@offside/app-core/format';
  import { teamAchText as L } from '@offside/app-core/i18n/ko/teamAch';
  import TitleBadge from '../cup/TitleBadge.svelte';
  import OwnerProfile from '../owner/OwnerProfile.svelte';

  const sorts = (): [TeamRankSort, string][] => [
    ['rating', L.sortRating],
    ['ovr', L.sortOvr],
    ['value', L.sortValue],
  ];
  /** 정렬마다 값 칸의 이름과 값(구단 가치는 몸값 표기). */
  const METRIC: Record<TeamRankSort, { label: () => string; of: (t: TeamRankResponse['items'][number]) => string }> = {
    rating: { label: () => L.sortRating, of: (t) => n(t.rating) },
    ovr: { label: () => L.sortOvr, of: (t) => String(t.ovr) },
    value: { label: () => L.sortValue, of: (t) => fmtValue(t.value) },
  };
  const formLabel = (result: 'W' | 'D' | 'L') => ({ W: L.formWin, D: L.formDraw, L: L.formLoss })[result];
  function formText(form: TeamRankResponse['items'][number]['recentForm']) {
    return form?.length ? form.map((result) => formLabel(result)).join(', ') : L.formNone;
  }
  /** undefined = 지금 시즌(서버가 정한다). */
  let season = $state<number | undefined>(undefined);
  let sort = $state<TeamRankSort>(appState.hof.teamSort ?? 'rating');
  let page = $state(1);
  /** T-11-375 디비전 탭(레이팅순에만, undefined = 전체). */
  let division = $state<number | undefined>(undefined);
  let divisions = $state<TeamDivisionsResponse | null>(null);
  let data = $state<TeamRankResponse | null>(null);
  let failed = $state(false);
  let loading = $state(true);
  const clock = seasonNow();
  const now = $derived(clock.now);
  const seasons = $derived(data?.seasons ?? openTeamSeasons(now).map((id) => ({ id, name: teamSeasonName(id) })));
  const selectedSeason = $derived(season ?? data?.season ?? displaySeasonAt(now));
  /** 다시 받을 기준 — 고른 시즌, 아니면 지금 시즌(띄운 채 개막을 넘기면 바뀐다). */
  const shownSeason = $derived(season ?? displaySeasonAt(now));
  const metricLabel = $derived(METRIC[sort].label());
  const metricOf = $derived(METRIC[sort].of);
  const rows = $derived(data?.items ?? []);

  // T-11-441 '내 순위로' — 로그인한 구단주만, 가치순은 빼고. 누르면 내 팀이 있는 페이지로 가고 그 줄을 강조한다.
  // 로그인 상태를 아직 묻지 않았으면(구단주 화면을 열지 않음) 버튼을 두고, 누를 때 서버가 판정한다(따로 묻지 않는다).
  const member = $derived.by(() => {
    const a = accountCache.value;
    return a === undefined || (!!a && a !== 'error' && isMember(a));
  });
  let myTeam = $state<string | null>(null);
  let jumping = $state(false);
  /** 내 순위 응답이 곧 그 페이지다 — 페이지를 옮겨도 다시 받지 않게 한 번 넘겨 둔다. */
  let preset: TeamRankResponse | null = null;
  async function jumpToMe() {
    jumping = true;
    const j = myRankJump(await fetchMyTeamRank(season, sort), 'team');
    jumping = false;
    if (!j.ok) return toast(j.message);
    myTeam = j.data.me?.teamId ?? null;
    if (j.data.page !== page) preset = j.data;
    data = j.data;
    page = j.data.page;
    await tick();
    document.querySelector(`[data-rank-team="${myTeam}"]`)?.scrollIntoView({ block: 'center' });
  }

  $effect(() => {
    const [se, so, p] = [season, sort, page];
    const dv = so === 'rating' ? division : undefined;
    void shownSeason;
    if (preset && preset.page === p && preset.sort === so) {
      preset = null;
      loading = false;
      failed = false;
      return;
    }
    preset = null;
    let live = true;
    failed = false;
    loading = true;
    void fetchTeamRanking(se, so, p, dv).then((r) => {
      if (!live || se !== season || so !== sort || p !== page || dv !== (sort === 'rating' ? division : undefined)) return;
      loading = false;
      if (r.ok) data = r.data;
      else failed = true;
    });
    return () => { live = false; };
  });

  // 디비전별 팀 수는 레이팅순을 볼 때만 한 번 받는다(5분 엣지 캐시 · 1분 메모).
  $effect(() => {
    if (sort !== 'rating') return;
    const se = season;
    let live = true;
    void fetchTeamDivisions(se).then((r) => {
      if (live && se === season && r.ok) divisions = r.data;
    });
    return () => { live = false; };
  });
  function pickDivision(d: number | undefined) {
    division = d;
    page = 1;
  }

  const pages = $derived(data ? Math.max(1, Math.ceil(data.total / TEAM_RANK_PER_PAGE)) : 1);
  function goPage(p: number) {
    page = p;
    window.scrollTo(0, 0);
  }
  function open(id: string) {
    appState.hof = { ...appState.hof, team: id, owner: false };
    window.scrollTo(0, 0);
  }
</script>

{#if appState.hof.team && appState.hof.owner}
  <OwnerProfile teamId={appState.hof.team} />
{:else if appState.hof.team}
  <TeamProfile id={appState.hof.team} />
{:else}
  <section class="card" data-team-ranking>
    <div class="hof-toolbar team-ranking-toolbar">
      <label class="hof-season-picker">
        <span class="hof-filter-label">{L.seasonLabel}</span>
        <select aria-label={L.teamSeasonAria} data-rank-season-select value={String(selectedSeason)} onchange={(e) => ((season = Number(e.currentTarget.value)), (page = 1))}>
          {#each seasons as s (s.id)}<option value={String(s.id)}>{seasonLabel(s.id, s.name)}</option>{/each}
        </select>
      </label>
      {#if data && !loading && !failed}<span class="team-ranking-total muted">{L.teamsBefore}<b class="num">{n(data.total)}</b>{L.teamsAfter}</span>{/if}
    </div>
    {#if canJumpToMyRank(member, sort)}
      <button class="btn btn-sm rank-jump" data-act="my-rank" disabled={jumping} onclick={() => void jumpToMe()}>{L.myRank}</button>
    {/if}
    <p class="hof-filter-label team-sort-label">{L.sortLabel}</p>
    <div class="hof-sorts team-ranking-sorts" role="group" aria-label={L.sortGroupAria}>
      {#each sorts() as [k, label] (k)}
        <button class="hof-sort" aria-pressed={sort === k} data-rank-sort={k} onclick={() => ((sort = k), (page = 1))}>{label}</button>
      {/each}
    </div>
    {#if sort === 'rating'}
      <div class="hof-sorts team-div-tabs" role="group" aria-label={LD.tabsAria} data-rank-divisions>
        <button class="hof-sort" aria-pressed={division === undefined} data-rank-division="all" onclick={() => pickDivision(undefined)}>{LD.tabAll}</button>
        {#each TEAM_DIVISION_KEYS.map((_, i) => TEAM_DIVISION_KEYS.length - 1 - i) as d (d)}
          <button class="hof-sort team-div-tab" aria-pressed={division === d} data-rank-division={d} onclick={() => pickDivision(d)}>
            <DivisionEmblem division={d} size={16} />{divisionName(d)}{#if divisions}<small class="num">{n(divisions.counts[d] ?? 0)}</small>{/if}
          </button>
        {/each}
      </div>
    {/if}
    <p class="team-form-guide muted">{L.formGuide}</p>
    {#if failed}
      <p class="empty">{L.rankFail}</p>
    {:else if loading || !data}
      <Skeleton rows={6} />
    {:else if data.items.length}
      {#if rows.length}
        <div class="team-standings" class:by-value={sort === 'value'}>
          <div class="team-standings-columns team-standings-header" aria-hidden="true">
            <span class="team-standings-heading">{L.colTeam}</span><span>{L.colPlayed}</span><span>{L.colWin}</span><span>{L.colDraw}</span><span>{L.colLoss}</span><b>{metricLabel}</b>
          </div>
          <ol class="team-standings-list" start={rows[0]!.rank} aria-label={L.teamListAria({ metric: metricLabel })}>
            {#each rows as t (t.teamId)}
              {@const played = t.record.w + t.record.d + t.record.l}
              <li value={t.rank} class:mine={t.teamId === myTeam} aria-current={t.teamId === myTeam ? 'true' : undefined}>
                <button class="team-standings-columns team-standings-row" data-rank-team={t.teamId} aria-label={L.teamRowAria({ rank: t.rank, name: t.name, played: n(played), w: n(t.record.w), d: n(t.record.d), l: n(t.record.l), metric: metricLabel, value: metricOf(t), form: formText(t.recentForm) })} onclick={() => open(t.teamId)}>
                  <span class="team-standings-team"><span class="team-standings-rank num">{t.rank}</span>{#if t.division !== undefined}<span class="team-standings-div" title={divisionName(t.division)}><DivisionEmblem division={t.division} size={14} /></span>{/if}<span class="team-standings-logo"><TeamLogo logo={t.logo} name={t.name} size={24} decorative />{#if t.title}<span class="team-standings-title"><TitleBadge title={t.title} size="icon" /></span>{/if}</span><b title={t.name}>{t.name}</b></span>
                  <span class="num" title={L.playedTitle({ n: n(played) })}>{n(played)}</span>
                  <span class="num" title={L.winTitle({ n: n(t.record.w) })}>{n(t.record.w)}</span>
                  <span class="num" title={L.drawTitle({ n: n(t.record.d) })}>{n(t.record.d)}</span>
                  <span class="num" title={L.lossTitle({ n: n(t.record.l) })}>{n(t.record.l)}</span>
                  <strong class="num team-standings-score">{metricOf(t)}</strong>
                  <span class="team-standings-form" aria-hidden="true">
                    {#each [0, 1, 2, 3, 4] as i (i)}
                      {@const result = t.recentForm?.[i]}
                      <span class="team-form-dot" class:won={result === 'W'} class:drawn={result === 'D'} class:lost={result === 'L'} data-team-form={result ?? 'empty'} title={result ? L.formDot({ i: i + 1, label: formLabel(result) }) : L.formNone}>
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
        <nav class="hof-pager" aria-label={L.pagerAria}>
          <button class="icon-btn" data-rank-page="prev" disabled={page <= 1} onclick={() => goPage(page - 1)}>{L.prev}</button>
          <span class="num" aria-live="polite">{page} / {pages}</span>
          <button class="icon-btn" data-rank-page="next" disabled={page >= pages} onclick={() => goPage(page + 1)}>{L.next}</button>
        </nav>
      {/if}
    {:else}
      <p class="empty">{division !== undefined ? LD.emptyDivision : L.teamsEmpty}</p>
    {/if}
    <p class="muted fs-xs" style="margin-top:10px">{sort === 'value' ? L.valueFoot : L.teamsFoot}</p>
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
  /* T-11-129 구단 가치는 몸값 표기(1조 2,300억)라 값 칸을 넓힌다(클래스 둘이라 아래 넓은 화면 규칙보다 앞선다). */
  .team-standings.by-value {
    --score-width: 84px;
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
  /* T-11-441 내 팀 줄 */
  .team-standings-list > li.mine {
    background: color-mix(in srgb, var(--accent) 12%, transparent);
    border-radius: 8px;
  }
  .rank-jump {
    margin: 0 0 12px;
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
  /* T-11-150 대표 칭호 트로피는 로고 모서리에 얹는다(좁은 줄에서 팀 이름 자리를 먹지 않게). */
  .team-standings-logo {
    position: relative;
    display: inline-flex;
    flex: none;
  }
  .team-standings-title {
    position: absolute;
    right: -7px;
    bottom: -6px;
    line-height: 0;
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
  .team-div-tabs {
    margin: -4px 0 12px;
  }
  .team-div-tab {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .team-div-tab small {
    font-size: 11px;
    font-weight: 400;
    color: inherit;
  }
  .team-standings-div {
    flex: none;
    display: inline-flex;
    margin-left: -2px;
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
