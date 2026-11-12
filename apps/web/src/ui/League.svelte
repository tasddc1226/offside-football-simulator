<script lang="ts">
  // T-11-418 오프사이드 리그 화면 — 홈의 리그 배너로 연다. 단계 한 줄, 내 신청(사전 신청 · 신청 · 취소 · 배치 준비 상태), 일정,
  // 규칙. T-11-418b 배치 뒤에는 내 배치 · 리그 고르기 · 순위표 · 라운드 경기 · 경기 상세. 처음 열 때 불러오는 지연 청크다.
  import { requestTeamSeason } from '@offside/app-core/teamOwner';
  import { onMount } from 'svelte';
  import { enterLeague, fetchLeague, fetchLeagueMe, withdrawLeague, type LeagueMeResponse, type LeagueResponse } from '@offside/app-core/api/league';
  import { isMember } from '@offside/app-core/account';
  import { cupAppText as A } from '@offside/app-core/i18n/ko/cupApp';
  import { leagueText as L } from '@offside/app-core/i18n/ko/league';
  import { leagueCancelled, leagueChoices, leagueDefaultPick,
    rememberLeagueReturn,
    takeLeagueReturn, leagueDefaultRound, leagueEnterAsk, leagueEntryCard, leagueEntryRules, leagueFinalView, leagueLastFinalView, leagueLine, leagueOutcomeTone, leaguePhaseActive, leaguePhaseLabel, leaguePlacementLine, leaguePresign, leagueReadiness, leagueRules, leagueSchedule, leagueTeamAction, leagueWhen, type LeagueAccount, type LeaguePick } from '@offside/app-core/leagueView';
  import type { LeagueMatch, LeagueTableResponse } from '@offside/app-core/api/league';
  import LeaguePicker from './league/LeaguePicker.svelte';
  import LeagueBoard from './league/LeagueBoard.svelte';
  import LeagueMatchDetail from './league/LeagueMatchDetail.svelte';
  import LeagueDaily from './league/LeagueDaily.svelte';
  import type { LeagueNewsMatch } from '@offside/app-core/api/league';
  import PopSheet from './PopSheet.svelte';
  import Topbar from './Topbar.svelte';
  import LoadState, { type LoadStatus } from './LoadState.svelte';
  import LoginButtons from './LoginButtons.svelte';
  import Skeleton from './Skeleton.svelte';
  import { shellMoreText } from '@offside/app-core/i18n/ko/shellMore';
  import { accountCache, refreshAccount } from './account-state.svelte.js';
  import { toast } from './helpers.js';
  import { go } from './nav.js';
  import { appState, hofStart } from './state.svelte.js';

  let status = $state<LoadStatus>('loading');
  let data = $state<LeagueResponse | null>(null);
  let me = $state<LeagueMeResponse | null>(null);
  let meFailed = $state(false);
  let busy = $state(false);
  // T-11-444 신청 · 취소 확인 창(PopSheet).
  let ask = $state<'enter' | 'withdraw' | null>(null);
  // 배치 뒤: 고른 리그(처음엔 내 리그) · 라운드 · 연 경기.
  let pick = $state<LeaguePick | null>(null);
  let picked = $state(false);
  let round = $state(1);
  let detail = $state<{ m: LeagueMatch; table: LeagueTableResponse } | null>(null);
  // T-11-640 팀 프로필에서 돌아오면 보던 리그 · 라운드를 그대로 연다.
  const back = takeLeagueReturn();

  const linked = $derived.by(() => {
    const acct = accountCache.value;
    return !!acct && acct !== 'error' && isMember(acct);
  });

  async function load() {
    if (!data) status = 'loading';
    const r = await fetchLeague();
    if (!r.ok) {
      status = 'error';
      return;
    }
    data = r.data;
    status = 'ready';
  }
  async function loadMe() {
    const r = await fetchLeagueMe();
    me = r.ok ? r.data : null;
    meFailed = !r.ok;
  }
  const reload = () => void Promise.all([load(), linked ? loadMe() : undefined]);

  onMount(() => {
    void load();
    // 홈에서 바로 들어와도 로그인 상태를 알아야 내 신청을 묻는다.
    if (accountCache.value === undefined) void refreshAccount();
  });
  $effect(() => {
    if (linked) void loadMe();
    else {
      me = null;
      meFailed = false;
    }
  });

  $effect(() => {
    if (picked || !data?.tiers) return;
    const kept = back?.season === data.league.season ? back : null;
    pick = kept?.pick ?? leagueDefaultPick(data, me);
    round = kept?.round ?? leagueDefaultRound(data);
    if (kept) picked = true;
  });
  const choices = $derived(data ? leagueChoices(data) : []);
  const placement = $derived(leaguePlacementLine(me, data ? leagueCancelled(data) : false));
  const final = $derived(data ? leagueFinalView(me, data.league.season) : null);
  const mineId = $derived(me?.placement?.teamId ?? null);
  const mine = $derived.by<LeaguePick | null>(() => {
    const p = me?.placement;
    return p?.tier && p.league ? { tier: p.tier, league: p.league } : null;
  });
  const pickKey = $derived(pick ? `${pick.tier}-${pick.league}` : '');
  function choose(next: LeaguePick) {
    picked = true;
    pick = { ...next };
  }
  function openProfile(teamId: string) {
    if (!data || !pick) return;
    rememberLeagueReturn({ season: data.league.season, pick: { ...pick }, round });
    appState.hof = { ...hofStart(), tab: 'teams', team: teamId, season: data.league.teamSeason ?? data.league.season };
    go('hof');
  }
  function openMatch(m: LeagueMatch, table: LeagueTableResponse) {
    detail = { m, table };
    window.scrollTo(0, 0);
  }
  /** T-11-652 신문 기사 경기를 경기 상세로 연다(상세는 두 팀 이름 · 감독만 순위표에서 읽는다). */
  function openNews(n: LeagueNewsMatch) {
    if (!data) return;
    openMatch(
      { id: n.id, round: n.round, homeTeamId: n.home.teamId, awayTeamId: n.away.teamId, at: '', played: true, homeGoals: n.homeGoals, awayGoals: n.awayGoals, forfeit: false },
      { season: data.league.season, tier: n.tier, league: n.league, teams: [n.home, n.away], standings: [], matches: [] },
    );
  }
  const account = $derived<LeagueAccount>(
    !accountCache.value || accountCache.value === 'error' ? 'unknown' : linked ? 'member' : 'guest',
  );
  // T-11-444 신청 카드의 단계별 노출은 앱과 같은 규칙(leagueEntryCard)을 쓴다.
  const card = $derived(data ? leagueEntryCard(data, account, me, meFailed) : null);
  const lastFinal = $derived(leagueLastFinalView(me));
  const enterAsk = $derived(data ? leagueEnterAsk(data, me) : null);
  const presign = $derived(data ? leaguePresign(data) : false);
  const ready = $derived(data ? leagueReadiness(data, me) : null);
  // T-11-430 배치 전 신청 카드: 참가 자격 · 기권 규칙, 팀 선발 고치기(팀 편성 화면으로).
  const entryRules = $derived(data ? leagueEntryRules(data, me) : []);
  const teamAction = $derived(data ? leagueTeamAction(data, me) : null);
  function openTeam() {
    requestTeamSeason(data!.league.teamSeason ?? data!.league.season);
    appState.teamView = 'team';
    go('team');
  }

  async function enter() {
    if (busy) return;
    ask = null;
    busy = true;
    const r = await enterLeague();
    busy = false;
    toast(r.ok ? L.toastEntered : r.error.message);
    reload();
  }
  async function withdraw() {
    if (busy) return;
    ask = null;
    busy = true;
    const r = await withdrawLeague();
    busy = false;
    if (!r.ok) return toast(r.error.message);
    toast(L.toastWithdrawn);
    reload();
  }
</script>

{#snippet leagueSkeleton()}<div class="stack"><Skeleton height={140} /><Skeleton height={120} /><Skeleton height={220} /></div>{/snippet}

<div class="wrap">
  <Topbar />
  {#if detail && data}
    {#key detail.m.id}
      <LeagueMatchDetail season={data.league.season} m={detail.m} table={detail.table} {mineId} onback={() => (detail = null)} />
    {/key}
  {/if}
  <div class="stack" hidden={!!detail}>
  <header class="settings-head">
    <div class="eyebrow">Offside League</div>
    <h1>{data ? L.seasonTitle({ season: data.league.season }) : L.title}</h1>
  </header>
  <LoadState {status} failText={L.loadFail} retry={load} skeleton={leagueSkeleton}>
    {#if data}
      <section class="card league-sec" data-league-hero data-league-phase={data.phase}>
        <div class="league-row">
          <span class="muted fs-sm" data-league-line>{leagueLine(data)}</span>
          <span class="pill" class:good={leaguePhaseActive(data.phase)}>{leaguePhaseLabel(data.phase)}</span>
        </div>
        <p class="fs-sm">{(data?.league.teamSeason === undefined ? L.pitch : L.cyclePitch)}{#if data?.league.teamSeason} {L.cycleTeam({ season: data.league.teamSeason })}{/if}</p>
        {#if card?.kind === 'login'}
          <p class="muted fs-sm" data-league-login>{card.text}</p>
          <LoginButtons act="league-login-google" back={{ league: true }} />
        {:else if card?.kind === 'error'}
          <div class="league-row" data-league-me-error>
            <span class="muted fs-sm">{card.text}</span>
            <button class="btn btn-sm" data-act="league-me-retry" onclick={() => void loadMe()}>{shellMoreText.retry}</button>
          </div>
        {:else if card?.kind === 'mine' && me}
          {#if lastFinal}
            <div class="league-final" data-league-last-final={lastFinal.outcome}>
              <div class="league-row"><b>{lastFinal.title}</b><span class="pill {leagueOutcomeTone(lastFinal.outcome) ?? ''}">{lastFinal.label}</span></div>
              <p class="fs-sm"><b>{lastFinal.line}</b></p>
              <p class="muted fs-sm">{lastFinal.next}</p>
            </div>
          {/if}
          {#if card.entered}
            <div class="league-row" data-league-entered>
              <span class="pill good">{L.entered}</span>
              {#if card.action === 'withdraw'}<button class="btn btn-sm" data-act="league-withdraw" disabled={busy} onclick={() => (ask = 'withdraw')}>{busy ? L.withdrawing : L.withdraw}</button>{/if}
            </div>
          {:else if card.action === 'enter'}
            <button class="btn btn-primary btn-block" data-act="league-enter" disabled={busy} onclick={() => (ask = 'enter')}>{busy ? L.entering : L.enter}</button>
          {/if}
          {#if card.note}<p class="muted fs-sm" data-league-note>{card.note}</p>{/if}
          {#if presign}<p class="muted fs-sm" data-league-presign>{L.presignNote({ season: data.league.teamSeason ?? data.league.season, at: leagueWhen(data.league.startsAt) })}</p>{/if}
          {#if ready}<p class="fs-sm" class:muted={ready.ok} class:league-warn={!ready.ok} data-league-ready={ready.ok ? 'ok' : 'short'}>{ready.text}</p>{/if}
          {#if teamAction}<button class="btn btn-sm league-team-btn" data-act="league-team" onclick={openTeam}>{teamAction}</button>{/if}
          {#if entryRules.length}
            <ul class="league-entry-rules muted fs-sm" data-league-entry-rules>
              {#each entryRules as rule (rule)}<li>{rule}</li>{/each}
            </ul>
          {/if}
          {#if card.ovr}<p class="muted fs-sm" data-league-ovr>{card.ovr}</p>{/if}
          {#if final}
            <div class="league-final" data-league-final={final.outcome}>
              <div class="league-row"><b>{L.finalTitle}</b><span class="pill {leagueOutcomeTone(final.outcome) ?? ''}">{final.label}</span></div>
              <p class="fs-sm"><b>{final.line}</b></p>
              <p class="fs-sm" data-league-reward>{final.reward}</p>
              {#if final.title}<p class="fs-sm">{final.title}</p>{/if}
              <p class="muted fs-sm">{final.next}</p>
            </div>
          {:else if placement}<p class="fs-sm" class:league-warn={!placement.ok} data-league-placement={me.placement?.status}><b>{placement.text}</b></p>{/if}
        {/if}
        <!-- 접수 중에는 위 한 줄에 신청 수가 있다. -->
        {#if data.phase !== 'soon' && data.phase !== 'open'}<p class="muted fs-sm" data-league-entries>{L.entries({ n: data.entries })}</p>{/if}
      </section>

      {#if data.tiers && data.playedRounds !== undefined}
        {#key data.playedRounds}<LeagueDaily season={data.league.season} round={data.playedRounds} {linked} onopen={openNews} />{/key}
      {/if}

      {#if pick && data.tiers}
        {#if choices.length > 1}<LeaguePicker tiers={data.tiers} {pick} {mine} onpick={choose} />{/if}
        {#key pickKey}
          <LeagueBoard season={data.league.season} tier={pick.tier} league={pick.league} bottomTier={data.tiers.at(-1)?.tier ?? 1} {mineId} bind:round thisRound={leagueDefaultRound(data)} onopen={openMatch} onteam={openProfile} />
        {/key}
      {/if}

      <section class="card league-sec" data-league-schedule>
        <h2>{L.scheduleTitle}</h2>
        <p class="muted fs-sm" data-league-kst>{L.kstNote}</p>
        <dl class="league-sched">
          {#each leagueSchedule(data.league) as row (row.label)}
            <div><dt>{row.label}</dt><dd>{row.text}</dd></div>
          {/each}
        </dl>
      </section>

      <section class="card league-sec" data-league-rules>
        <h2>{L.rulesTitle}</h2>
        <ul class="league-rules">
          {#each leagueRules(data?.league) as rule (rule)}<li>{rule}</li>{/each}
        </ul>
      </section>
    {/if}
  </LoadState>
  </div>
</div>

{#if ask && data}
  <PopSheet label={ask === 'enter' ? L.enterAskTitle : A.withdrawAskTitle} onclose={() => (ask = null)}>
    <div class="league-ask" data-league-ask={ask}>
      {#if ask === 'enter' && enterAsk}
        <h2>{enterAsk.title}</h2>
        <ul class="league-entry-rules fs-sm">
          {#each enterAsk.lines as line (line)}<li>{line}</li>{/each}
        </ul>
        <button class="btn btn-primary btn-block" data-act="league-enter-confirm" disabled={busy} onclick={enter}>{L.enter}</button>
        <button class="btn btn-block" data-act="league-ask-close" onclick={() => (ask = null)}>{L.askClose}</button>
      {:else}
        <h2>{A.withdrawAskTitle}</h2>
        <p class="fs-sm">{L.withdrawConfirm}</p>
        <button class="btn btn-block" data-act="league-withdraw-confirm" disabled={busy} onclick={withdraw}>{L.withdraw}</button>
        <button class="btn btn-primary btn-block" data-act="league-ask-close" onclick={() => (ask = null)}>{A.withdrawKeep}</button>
      {/if}
    </div>
  </PopSheet>
{/if}

<style>
  .league-sec {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .league-sec h2,
  .league-sec p {
    margin: 0;
  }
  .league-warn {
    color: var(--warn);
  }
  .league-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
  }
  .league-team-btn {
    align-self: flex-start;
  }
  .league-entry-rules {
    margin: 0;
    padding-left: 18px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    line-height: 1.5;
  }
  .league-ask {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .league-ask h2,
  .league-ask p {
    margin: 0;
  }
  .league-final {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px 12px;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm, 8px);
  }
  .league-final p {
    margin: 0;
  }
  .league-sched {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0;
  }
  .league-sched div {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    font-size: var(--fs-body2);
  }
  .league-sched dt {
    color: var(--muted);
    flex: none;
  }
  .league-sched dd {
    margin: 0;
    text-align: right;
    overflow-wrap: anywhere;
  }
  .league-rules {
    margin: 0;
    padding-left: 18px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: var(--fs-body2);
    line-height: 1.6;
  }
</style>
