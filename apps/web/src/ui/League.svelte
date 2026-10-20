<script lang="ts">
  // T-11-418 오프사이드 리그 화면 — 홈의 리그 배너로 연다. 1차는 접수만: 단계 한 줄, 내 신청(사전 신청 · 신청 · 취소 · 배치 준비
  // 상태), 일정, 규칙. 배치 · 순위표 · 경기는 다음 배포에서 더한다. 처음 열 때 불러오는 지연 청크다.
  import { onMount } from 'svelte';
  import { enterLeague, fetchLeague, fetchLeagueMe, withdrawLeague, type LeagueMeResponse, type LeagueResponse } from '@offside/app-core/api/league';
  import { isMember } from '@offside/app-core/account';
  import { leagueText as L } from '@offside/app-core/i18n/ko/league';
  import { leagueLine, leaguePhaseLabel, leaguePresign, leagueReadiness, leagueRules, leagueSchedule, leagueWhen } from '@offside/app-core/leagueView';
  import Topbar from './Topbar.svelte';
  import LoadState, { type LoadStatus } from './LoadState.svelte';
  import LoginButtons from './LoginButtons.svelte';
  import Skeleton from './Skeleton.svelte';
  import { accountCache, refreshAccount } from './account-state.svelte.js';
  import { toast } from './helpers.js';

  let status = $state<LoadStatus>('loading');
  let data = $state<LeagueResponse | null>(null);
  let me = $state<LeagueMeResponse | null>(null);
  let busy = $state(false);

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
  }
  const reload = () => void Promise.all([load(), linked ? loadMe() : undefined]);

  onMount(() => {
    void load();
    // 홈에서 바로 들어와도 로그인 상태를 알아야 내 신청을 묻는다.
    if (accountCache.value === undefined) void refreshAccount();
  });
  $effect(() => {
    if (linked) void loadMe();
    else me = null;
  });

  const presign = $derived(data ? leaguePresign(data) : false);
  const ready = $derived(data ? leagueReadiness(data, me) : null);

  async function enter() {
    if (busy) return;
    busy = true;
    const r = await enterLeague();
    busy = false;
    toast(r.ok ? L.toastEntered : r.error.message);
    reload();
  }
  async function withdraw() {
    if (busy || !confirm(L.withdrawConfirm)) return;
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
  <header class="settings-head">
    <div class="eyebrow">Offside League</div>
    <h1>{data ? L.seasonTitle({ season: data.league.season }) : L.title}</h1>
  </header>
  <LoadState {status} failText={L.loadFail} retry={load} skeleton={leagueSkeleton}>
    {#if data}
      <section class="card league-sec" data-league-hero data-league-phase={data.phase}>
        <div class="league-row">
          <span class="muted fs-sm" data-league-line>{leagueLine(data)}</span>
          <span class="pill" class:good={data.phase === 'open' || data.phase === 'running'}>{leaguePhaseLabel(data.phase)}</span>
        </div>
        <p class="fs-sm">{L.pitch}</p>
        {#if accountCache.value && accountCache.value !== 'error' && !linked}
          {#if data.phase === 'open'}<p class="muted fs-sm" data-league-login>{L.loginToEnter}</p>{/if}
          <LoginButtons act="league-login-google" back={{ league: true }} />
        {:else if linked && me}
          {#if me.entry}
            <div class="league-row" data-league-entered>
              <span class="pill good">{L.entered}</span>
              {#if data.phase === 'open'}<button class="btn btn-sm" data-act="league-withdraw" disabled={busy} onclick={withdraw}>{busy ? L.withdrawing : L.withdraw}</button>{/if}
            </div>
            <p class="muted fs-sm">{data.phase === 'open' ? L.enteredNote({ at: leagueWhen(data.league.drawAt) }) : L.drawPending}</p>
          {:else if me.canEnter}
            <button class="btn btn-primary btn-block" data-act="league-enter" disabled={busy} onclick={enter}>{busy ? L.entering : L.enter}</button>
            <p class="muted fs-sm">{L.enteredNote({ at: leagueWhen(data.league.drawAt) })}</p>
          {:else if data.phase !== 'soon'}
            <p class="muted fs-sm">{L.notEntered}</p>
          {/if}
          {#if presign}<p class="muted fs-sm" data-league-presign>{L.presignNote({ season: data.league.season, at: leagueWhen(data.league.startsAt) })}</p>{/if}
          {#if ready}<p class="fs-sm" class:muted={ready.ok} class:league-warn={!ready.ok} data-league-ready={ready.ok ? 'ok' : 'short'}>{ready.text}</p>{/if}
          {#if me.team && data.phase === 'open'}<p class="muted fs-sm" data-league-ovr>{L.myOvr({ ovr: me.team.ovr })}</p>{/if}
        {/if}
        <!-- 접수 중에는 위 한 줄에 신청 수가 있다. -->
        {#if data.phase !== 'soon' && data.phase !== 'open'}<p class="muted fs-sm" data-league-entries>{L.entries({ n: data.entries })}</p>{/if}
      </section>

      <section class="card league-sec" data-league-schedule>
        <h2>{L.scheduleTitle}</h2>
        <dl class="league-sched">
          {#each leagueSchedule(data.league) as row (row.label)}
            <div><dt>{row.label}</dt><dd>{row.text}</dd></div>
          {/each}
        </dl>
      </section>

      <section class="card league-sec" data-league-rules>
        <h2>{L.rulesTitle}</h2>
        <ul class="league-rules">
          {#each leagueRules() as rule (rule)}<li>{rule}</li>{/each}
        </ul>
      </section>
    {/if}
  </LoadState>
</div>

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
