<script lang="ts">
  import GoogleLoginButton from './GoogleLoginButton.svelte';
  // T-11-145 오프사이드 컵 화면 — 구단주 화면의 컵 배너로 연다. 내 상태(신청·다음 경기), 토너먼트 대진, 조별 순위표와 경기,
  // 일정·보상·규칙. 치른 경기를 누르면 같은 화면에서 상세(득점·승부차기)를 연다. 처음 열 때 불러오는 지연 청크다.
  import { onMount, tick } from 'svelte';
  import { CUP_REWARDS, CUP_STAGES } from '@offside/contracts/cup';
  import { fetchCup, fetchCupMe, type CupMatch, type CupMeResponse, type CupResponse } from '@offside/app-core/api/cup';
  import { isMember } from '@offside/app-core/account';
  import { cupBeforeDraw } from '@offside/app-core/cupHome';
  import { cupText as L } from '@offside/app-core/i18n/ko/cup';
  import { createCupPredictionController, emptyCupPredictions, type CupPredictionContext } from '@offside/app-core/cupPredictions';
  import { cupFolds, rememberCupFolds, type CupScheduleTab } from '@offside/app-core/cupFolds';
  import Topbar from './Topbar.svelte';
  import LoadState, { type LoadStatus } from './LoadState.svelte';
  import TeamLogo from './team/TeamLogo.svelte';
  import Laurel from './Laurel.svelte';
  import CupEntry from './cup/CupEntry.svelte';
  import CupGroupCard from './cup/CupGroupCard.svelte';
  import CupMatchDetail from './cup/CupMatchDetail.svelte';
  import CupMatchRow from './cup/CupMatchRow.svelte';
  import CupBracket from './cup/CupBracket.svelte';
  import { accountCache, refreshAccount } from './account-state.svelte.js';
  import { go } from './nav.js';
  import { startGoogleLogin } from './login.js';
  import { appState, hofStart } from './state.svelte.js';
  import { bracketRounds, kstParts, phaseLabel, phaseLine, roundLabel, stageLabel, teamMap, whenText, closeShownAt } from './cup/cupView.js';

  let predictions = $state(emptyCupPredictions());
  let now = $state(Date.now());
  const predictor = createCupPredictionController(s => { predictions = s; });
  let status = $state<LoadStatus>('loading');
  let data = $state<CupResponse | null>(null);
  let me = $state<CupMeResponse | null>(null);
  let content: HTMLDivElement;
  let detail = $state<CupMatch | null>(null);
  let bracketListChoice = $state<boolean | null>(null);
  let scheduleChoice = $state<CupScheduleTab | null>(null);
  let groupChoice = $state<number | null>(null);
  let bracketMatch = $state<CupMatch | null>(null);

  const linked = $derived.by(() => {
    const acct = accountCache.value;
    return !!acct && acct !== 'error' && isMember(acct);
  });

  const prediction = $derived<CupPredictionContext>({state: predictions, linked, now, pick: (id, choice) => void predictor.pick(id, choice), team: openTeam});
  const predictionAccount = $derived(linked && accountCache.value && accountCache.value !== 'error' ? accountCache.value.id : null);
  $effect(() => { const account=predictionAccount; if(data) void predictor.load(data.cup.id, account !== null); return () => predictor.cancel(); });
  $effect(() => {
    const matches = data?.matches ?? [];
    let timer: ReturnType<typeof setTimeout> | undefined;
    const advance = () => {
      const current = Date.now();
      now = current;
      const next = matches.filter(m => !m.played && Date.parse(m.at)>current).map(m => Date.parse(m.at)).sort((a,b)=>a-b)[0];
      if(next) timer=setTimeout(advance,Math.min(2_147_483_647,next-current+10));
    };
    advance();
    return () => clearTimeout(timer);
  });

  async function loadMe() {
    const r = await fetchCupMe();
    me = r.ok ? r.data : null;
  }
  async function load() {
    status = 'loading';
    const r = await fetchCup();
    if (!r.ok) {
      status = 'error';
      return;
    }
    data = r.data;
    status = 'ready';
  }
  const reload = () => void Promise.all([load(), linked ? loadMe() : undefined]);

  onMount(() => {
    void load();
    // 구단주 화면을 거치지 않고 들어와도(되돌아가기 등) 로그인 상태를 알아야 내 상태를 묻는다.
    if (accountCache.value === undefined) void refreshAccount();
  });
  $effect(() => {
    if (linked) void loadMe();
    else me = null;
  });

  const names = $derived(teamMap(data?.teams ?? []));
  const mineId = $derived(me?.entry && me.entry.status !== 'withdrawn' ? me.entry.teamId : null);
  const early = $derived(data ? cupBeforeDraw(data.phase) : true);
  const rounds = $derived(data ? bracketRounds(data.matches) : []);
  const mineGroup = $derived(mineId ? data?.groups.find((g) => g.standings.some((s) => s.teamId === mineId))?.no ?? null : null);
  const groups = $derived([...(data?.groups ?? [])].sort((a, b) => Number(b.no === mineGroup) - Number(a.no === mineGroup)));
  const folds = $derived(data ? cupFolds(data.cup.id, predictionAccount) : undefined);
  const bracketList = $derived(bracketListChoice ?? folds?.schedule?.bracketList ?? false);
  const scheduleTab = $derived(scheduleChoice ?? folds?.schedule?.tab ?? (rounds.length ? 'knockout' : 'groups'));
  const selectedGroup = $derived(groupChoice ?? folds?.schedule?.group ?? mineGroup ?? groups[0]?.no ?? 1);
  const nextRound = $derived(data?.matches.find((m) => !m.played)?.round);
  const shownRound = $derived(rounds.some((r) => r.round === nextRound) ? nextRound : 'f');
  const champion = $derived(data?.championTeamId ? data.teams.find((t) => t.teamId === data!.championTeamId) : undefined);
  const matchTime = $derived(data ? kstParts(data.cup.rounds[0]?.at ?? data.cup.opensAt).time : '');
  const lockTime = $derived(data ? kstParts(data.cup.rounds[0]?.lockAt ?? data.cup.opensAt).time : '');
  const stages = CUP_STAGES;

  function openTeam(id: string) {
    if (data && content) {
      const states = (selector: string, attr: string) => Object.fromEntries(
        [...content.querySelectorAll<HTMLDetailsElement>(selector)].map(el => [el.getAttribute(attr)!, el.open]),
      );
      rememberCupFolds(data.cup.id, predictionAccount, {
        groups: states('[data-cup-group]', 'data-cup-group'),
        rounds: states('[data-cup-round]', 'data-cup-round'),
        schedule: { tab: scheduleTab, group: selectedGroup, bracketList },
      });
    }
    appState.hof = { ...hofStart(), tab: 'teams', team: id, season: data?.cup.season ?? null };
    go('hof');
  }
  function openMatch(m: CupMatch) {
    detail = m;
    window.scrollTo(0, 0);
  }
  async function openFixtures() {
    scheduleChoice = rounds.length ? 'knockout' : 'groups';
    await tick();
    const fixtures = content.querySelector<HTMLElement>('[data-cup-fixtures]');
    fixtures?.focus({ preventScroll: true });
    fixtures?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }
  function closeDetail() {
    detail = null;
  }
</script>

<div class="wrap">
  <Topbar />
  {#if detail && data}
    {#key detail.id}
      <CupMatchDetail cupId={data.cup.id} m={detail} teams={names} {mineId} onback={closeDetail} />
    {/key}
  {/if}
  <div bind:this={content} hidden={!!detail} class="cup-content">
    <header class="settings-head">
      <div class="eyebrow">Offside Cup</div>
      <h1>{data ? L.fullTitle({ n: data.cup.edition }) : L.title}</h1>
    </header>
    <LoadState {status} failText={L.loadFail} retry={load}>
      {#if data}
        {#if accountCache.value && accountCache.value !== 'error' && !linked}
          <section class="card stack cup-login" data-cup-login>
            <h2>{L.predictionLoginTitle}</h2>
            <GoogleLoginButton act="cup-login-google" onclick={() => startGoogleLogin({cup:true})} />
          </section>
        {/if}
        <section class="card stack" style="gap:12px" aria-label={L.secMine} data-cup-hero data-cup-phase={data.phase}>
          <button class="cup-row" onclick={openFixtures} aria-label={`${phaseLine(data)} · ${L.scheduleMatches}`}>
            <span class="muted fs-sm" data-cup-line>{phaseLine(data)}</span>
            <span class="pill" class:good={data.phase === 'open' || data.phase === 'group' || data.phase === 'knockout'}>{phaseLabel(data.phase)} <span aria-hidden="true">↓</span></span>
          </button>
          {#if champion}
            <div class="cup-champ" data-cup-champion-team>
              <span class="cup-laurel medal gold"><Laurel /></span>
              <TeamLogo logo={champion.logo} name={champion.name} size={44} decorative />
              <div class="cup-champ-who"><small>{L.champTitle({ n: data.cup.edition })}</small><b>{champion.name}</b><small>{champion.owner}</small></div>
            </div>
          {/if}
          {#if linked}<CupEntry {data} {me} {linked} onchanged={reload} />{/if}
        </section>

        <section class="card cup-sec cup-info" data-cup-prediction-intro>
          <h2>{L.predictionTitle}</h2>
          <ul class="cup-rules">
            <li>{L.predictionIntro}</li>
            <li>{L.predictionSaved}</li>
            <li>{L.predictionKnockout}</li>
          </ul>
          {#if predictions.status === 'loading'}<p class="muted fs-sm">{L.predictionLoading}</p>{/if}
          {#if predictions.status === 'error' || predictions.personalFailed}<p role="alert">{L.predictionFail}</p><button class="btn" onclick={() => data && predictor.load(data.cup.id,linked)}>{L.predictionRetry}</button>{/if}
        </section>
        {#if early && data.teams.length}
          <section class="card cup-sec" data-cup-entrants>
            <h2>{L.secEntrants} <span class="muted fs-sm">{L.teamsCount({ n: data.teams.length })}</span></h2>
            <p class="muted fs-sm">{L.entrantsNote}</p>
            <ol class="cup-entrants">
              {#each data.teams as t, i (t.teamId)}
                <li class:mine={t.teamId === mineId}>
                  <span class="cup-entrant-no">{i + 1}</span>
                  <TeamLogo logo={t.logo} name={t.name} size={28} decorative />
                  <button class="cup-entrant-who" onclick={() => openTeam(t.teamId)} aria-label={`${t.name} · ${L.lineupOpen}`}><b>{t.name} ↗</b><small class="muted">{t.owner}</small></button>
                  {#if t.teamId === mineId}<span class="pill good">{L.mineTeam}</span>{/if}
                  <span class="cup-entrant-ovr">OVR {t.ovr}</span>
                </li>
              {/each}
            </ol>
          </section>
        {/if}

        <section class="card cup-sec cup-info" data-cup-rules>
          <h2>{L.secRules}</h2>
          <ul class="cup-rules">
            <li>{L.rulePlay({ min: data.cup.minFilled, cap: data.cup.capacity })}</li>
            <li>{L.ruleGroup}</li>
            <li>{L.rulePoints}</li>
            <li>{L.ruleKnockout}</li>
            <li>{L.ruleDaily({ time: matchTime })}</li>
            <li>{L.ruleLock({ time: lockTime })}</li>
            <li>{L.ruleForfeit}</li>
          </ul>
        </section>
        <section class="card cup-sec cup-info" data-cup-schedule>
          <h2>{L.scheduleEntryDraw}</h2>
          <dl class="cup-sched">
            <div><dt>{L.schedEntry}</dt><dd>{whenText(data.cup.opensAt)} ~ {whenText(closeShownAt(data.cup.closesAt))}</dd></div>
            <div><dt>{L.schedDraw}</dt><dd>{whenText(data.cup.drawAt)}</dd></div>

          </dl>
        </section>

        <section class="card cup-sec cup-info" data-cup-rewards>
          <h2>{L.secRewards}</h2>
          <table class="cup-rewards">
            <thead><tr><th>{L.rewardStage}</th><th>{L.rewardItem}</th></tr></thead>
            <tbody>
              {#each stages as s (s)}
                <tr>
                  <th scope="row">{stageLabel(s)}</th>
                  <td>{L.rewardReroll({ n: CUP_REWARDS[s].rerolls })}{#if CUP_REWARDS[s].trophy} · {L.rewardTrophy}{/if}</td>
                </tr>
              {/each}
            </tbody>
          </table>
          <p class="muted fs-sm">{L.rewardNote}</p>
        </section>

        <section class="card cup-sec" class:cup-bracket={scheduleTab === 'knockout' && !bracketList} data-cup-fixtures tabindex="-1" aria-label={L.scheduleMatches}>
          <h2>{L.scheduleMatches}</h2>
          <nav class="schedule-tabs" aria-label={L.scheduleMatches}>
            {#each [['groups', L.secGroups], ['knockout', L.secBracket]] as [tab, label] (tab)}
              <button aria-pressed={scheduleTab === tab} class:active={scheduleTab === tab} onclick={() => scheduleChoice = tab as CupScheduleTab}>{label}</button>
            {/each}
          </nav>
          <div hidden={scheduleTab !== 'groups'} data-cup-groups>
            {#if groups.length}
              <nav class="schedule-chips" aria-label={L.secGroups}>
                {#each groups as g (g.no)}<button aria-pressed={selectedGroup === g.no} class:active={selectedGroup === g.no} onclick={() => groupChoice = g.no}>{L.groupName({no:g.no})}{g.no === mineGroup ? ` · ${L.myGroup}` : ''}</button>{/each}
              </nav>
              <p class="muted fs-sm">{L.advanceNote}</p>
              {#each groups as g (g.no)}
                <div hidden={selectedGroup !== g.no}><CupGroupCard {prediction} group={g} teams={names} matches={data.matches} {mineId} open={folds?.groups[g.no] ?? true} onopen={openMatch} /></div>
              {/each}
            {:else}<p class="muted">{L.noGroups}</p>{/if}
          </div>
          <div hidden={scheduleTab !== 'knockout'} data-cup-bracket>
        {#if rounds.length}

            <div class="bracket-tabs" role="group" aria-label={L.secBracket}>
              <button class:chosen={!bracketList} aria-pressed={!bracketList} onclick={() => bracketListChoice = false}>{L.bracketView}</button>
              <button class:chosen={bracketList} aria-pressed={bracketList} onclick={() => bracketListChoice = true}>{L.bracketList}</button>
            </div>
            <div hidden={bracketList}>
              <CupBracket matches={data.matches} teams={names} {mineId} {now} onselect={async m => { bracketMatch = m; await tick(); content.querySelector('[data-bracket-selected]')?.scrollIntoView({block:'center'}); }} />
              {#if bracketMatch}<div data-bracket-selected><CupMatchRow {prediction} m={bracketMatch} teams={names} {mineId} onopen={openMatch} /></div>{/if}
            </div>
            <div hidden={!bracketList}>
            {#each rounds as r (r.round)}
              <details class="cup-round" open={folds?.rounds[r.round] ?? r.round === shownRound} data-cup-round={r.round}>
                <summary><h3>{roundLabel(r.round)}</h3><span class="muted fs-xs">{whenText(r.matches[0]!.at)}</span></summary>
                <div class="stack" style="gap:6px">
                  {#each r.matches as m (m.id)}<CupMatchRow {prediction} {m} teams={names} {mineId} onopen={openMatch} />{/each}
                </div>
              </details>
            {/each}
            </div>
        {:else}<p class="muted">{L.noBracket}</p>{/if}
          </div>
        </section>
      {/if}
    </LoadState>
  </div>
</div>

<style>
  @media (min-width: 900px) { .cup-bracket { width:min(1400px, calc(100vw - 48px)); align-self:center; box-sizing:border-box; } }
  .schedule-tabs {display:flex;gap:16px;border-bottom:1px solid var(--line);}
  .schedule-tabs button {background:none;border:0;border-bottom:3px solid transparent;color:var(--muted);font:inherit;font-weight:700;min-height:48px;padding:8px 0;cursor:pointer;}
  .schedule-tabs button.active {border-bottom-color:var(--accent);color:var(--ink);}
  .schedule-chips {display:flex;gap:6px;overflow-x:auto;padding:8px 0 12px;max-width:100%;}
  .schedule-chips button {flex:none;border:1px solid var(--line);border-radius:10px;min-height:44px;padding:6px 10px;background:var(--bg);color:var(--ink);font:inherit;font-size:13px;cursor:pointer;}
  .schedule-chips button.active {border-color:var(--accent);color:var(--accent-text);font-weight:700;}
  [data-cup-bracket]:not([hidden]) {display:flex;flex-direction:column;gap:10px;}
  .bracket-tabs { display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:4px;border:1px solid var(--line);border-radius:14px;background:var(--bg); }
  .bracket-tabs button { min-width:0;min-height:44px;border:1px solid transparent;border-radius:10px;background:transparent;color:var(--muted);font:inherit;font-size:.875rem;font-weight:600;padding:8px 12px;cursor:pointer; }
  .bracket-tabs button.chosen { background:var(--surface);border-color:var(--line);color:var(--ink);box-shadow:0 1px 3px #0002; }
  .bracket-tabs button:focus-visible { outline:2px solid var(--accent);outline-offset:2px; }
  .cup-login { gap: 10px; border-color: var(--accent); }
  .cup-login h2 { margin: 0; }
  .cup-content {display:contents;}
  .cup-content[hidden] {display:none;}
  .cup-sec {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .cup-sec h2,
  .cup-info h2 {
    margin: 0;
  }
  .cup-sec h3 {
    margin: 0;
    font-size: 1rem;
  }
  .cup-sec p {
    margin: 0;
  }
  .cup-row {
    width: 100%;
    min-height: 44px;
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    text-align: left;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  .cup-champ {
    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border-radius: 14px;
    background: var(--pitch);
    color: var(--on-pitch);
  }
  .cup-laurel {
    position: absolute;
    inset: 0;
    opacity: 0.18;
    pointer-events: none;
  }
  .cup-champ-who {
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .cup-champ-who b {
    font-size: 1.125rem;
    color: var(--pitch-accent);
  }
  .cup-champ-who small {
    opacity: 0.85;
  }
  .cup-round {
    border-top: 1px solid var(--line);
  }
  .cup-round summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: 44px;
    cursor: pointer;
  }
  .cup-round summary h3 {
    flex: 1;
  }
  .cup-round summary span {
    text-align: right;
  }
  .cup-round[open] summary {
    margin-bottom: 6px;
  }
  .cup-round summary::after {
    content: '▸';
    color: var(--muted);
  }
  .cup-round[open] summary::after {
    content: '▾';
  }
  .cup-sched {
    display: flex;
    flex-direction: column;
    margin: 0;
  }
  .cup-sched div {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 0;
    border-top: 1px solid var(--line);
  }
  .cup-sched dt {
    color: var(--muted);
    flex: none;
  }
  .cup-sched dd {
    margin: 0;
    text-align: right;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
  }
  .cup-rewards {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
    margin-bottom: 8px;
  }
  .cup-rewards th,
  .cup-rewards td {
    text-align: left;
    padding: 8px 0;
    border-top: 1px solid var(--line);
    vertical-align: top;
  }
  .cup-rewards thead th {
    border-top: 0;
    font-size: 0.75rem;
    color: var(--muted);
  }
  .cup-rewards th:last-child,
  .cup-rewards td {
    text-align: right;
  }
  .cup-rewards td {
    font-weight: 700;
    white-space: normal;
  }
  .cup-rewards tbody th {
    font-weight: 400;
  }
  .cup-entrants {
    list-style: none;
    margin: 8px 0 0;
    padding: 0;
  }
  .cup-entrants li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 0;
    border-top: 1px solid var(--line);
  }
  .cup-entrants li.mine b {
    color: var(--accent);
  }
  .cup-entrant-no {
    width: 2ch;
    flex: none;
    text-align: right;
    color: var(--muted);
    font-size: 0.75rem;
    font-variant-numeric: tabular-nums;
  }
  .cup-entrant-who {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
    border:0;background:transparent;color:inherit;font:inherit;text-align:left;padding:0;min-height:44px;justify-content:center;cursor:pointer;
  }
  .cup-entrant-ovr {
    flex: none;
    font-size: 0.875rem;
    font-variant-numeric: tabular-nums;
  }
  .cup-rules {
    margin: 0;
    padding-left: 1.1em;
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 0.9375rem;
    line-height: 1.5;
  }
</style>
