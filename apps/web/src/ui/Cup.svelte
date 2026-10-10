<script lang="ts">
  // T-11-145 오프사이드 컵 화면 — 구단주 화면의 컵 배너로 연다. 내 상태(신청·다음 경기), 토너먼트 대진, 조별 순위표와 경기,
  // 일정·보상·규칙. 치른 경기를 누르면 같은 화면에서 상세(득점·승부차기)를 연다. 처음 열 때 불러오는 지연 청크다.
  import { onMount } from 'svelte';
  import { CUP_REWARDS, CUP_STAGES } from '@offside/contracts/cup';
  import { fetchCup, fetchCupMe, type CupMatch, type CupMeResponse, type CupResponse } from '@offside/app-core/api/cup';
  import { isMember } from '@offside/app-core/account';
  import { cupBeforeDraw } from '@offside/app-core/cupHome';
  import { cupText as L } from '@offside/app-core/i18n/ko/cup';
  import Topbar from './Topbar.svelte';
  import BackBar from './BackBar.svelte';
  import LoadState, { type LoadStatus } from './LoadState.svelte';
  import TeamLogo from './team/TeamLogo.svelte';
  import Laurel from './Laurel.svelte';
  import CupEntry from './cup/CupEntry.svelte';
  import CupGroupCard from './cup/CupGroupCard.svelte';
  import CupMatchDetail from './cup/CupMatchDetail.svelte';
  import CupMatchRow from './cup/CupMatchRow.svelte';
  import { accountCache, refreshAccount } from './account-state.svelte.js';
  import { go } from './nav.js';
  import { bracketRounds, kstParts, phaseLabel, phaseLine, roundLabel, stageLabel, teamMap, whenText, closeShownAt } from './cup/cupView.js';

  let status = $state<LoadStatus>('loading');
  let data = $state<CupResponse | null>(null);
  let me = $state<CupMeResponse | null>(null);
  let detail = $state<CupMatch | null>(null);

  const linked = $derived.by(() => {
    const acct = accountCache.value;
    return !!acct && acct !== 'error' && isMember(acct);
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
  // 내 조를 맨 위로.
  const groups = $derived.by(() => {
    if (!data) return [];
    const mine = (g: CupResponse['groups'][number]) => (mineId && g.standings.some((s) => s.teamId === mineId) ? 0 : 1);
    return [...data.groups].sort((a, b) => mine(a) - mine(b) || a.no - b.no);
  });
  const champion = $derived(data?.championTeamId ? data.teams.find((t) => t.teamId === data!.championTeamId) : undefined);
  const matchTime = $derived(data ? kstParts(data.cup.rounds[0]?.at ?? data.cup.opensAt).time : '');
  const lockTime = $derived(data ? kstParts(data.cup.rounds[0]?.lockAt ?? data.cup.opensAt).time : '');
  const stages = CUP_STAGES;

  function openMatch(m: CupMatch) {
    detail = m;
    window.scrollTo(0, 0);
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
  {:else}
    <header class="settings-head">
      <div class="eyebrow">Offside Cup</div>
      <h1>{data ? L.fullTitle({ n: data.cup.edition }) : L.title}</h1>
    </header>
    <LoadState {status} failText={L.loadFail} retry={load}>
      {#if data}
        <section class="card stack" style="gap:12px" aria-label={L.secMine} data-cup-hero data-cup-phase={data.phase}>
          <div class="cup-row">
            <span class="muted fs-sm" data-cup-line>{phaseLine(data)}</span>
            <span class="pill" class:good={data.phase === 'open' || data.phase === 'group' || data.phase === 'knockout'}>{phaseLabel(data.phase)}</span>
          </div>
          {#if champion}
            <div class="cup-champ" data-cup-champion-team>
              <span class="cup-laurel medal gold"><Laurel /></span>
              <TeamLogo logo={champion.logo} name={champion.name} size={44} decorative />
              <div class="cup-champ-who"><small>{L.champTitle({ n: data.cup.edition })}</small><b>{champion.name}</b><small>{champion.owner}</small></div>
            </div>
          {/if}
          <CupEntry {data} {me} {linked} onchanged={reload} />
        </section>

        {#if early && data.teams.length}
          <details class="card cup-info" open data-cup-entrants>
            <summary><h2>{L.secEntrants} <span class="muted fs-sm">{L.teamsCount({ n: data.teams.length })}</span></h2></summary>
            <p class="muted fs-sm">{L.entrantsNote}</p>
            <ol class="cup-entrants">
              {#each data.teams as t, i (t.teamId)}
                <li class:mine={t.teamId === mineId}>
                  <span class="cup-entrant-no">{i + 1}</span>
                  <TeamLogo logo={t.logo} name={t.name} size={28} decorative />
                  <span class="cup-entrant-who"><b>{t.name}</b><small class="muted">{t.owner}</small></span>
                  {#if t.teamId === mineId}<span class="pill good">{L.mineTeam}</span>{/if}
                  <span class="cup-entrant-ovr">OVR {t.ovr}</span>
                </li>
              {/each}
            </ol>
          </details>
        {/if}

        {#if rounds.length}
          <section class="cup-sec" data-cup-bracket>
            <h2>{L.secBracket}</h2>
            {#each rounds as r (r.round)}
              <div class="card stack" style="gap:8px">
                <h3>{roundLabel(r.round)}</h3>
                {#each r.matches as m (m.id)}<CupMatchRow {m} teams={names} {mineId} onopen={openMatch} />{/each}
              </div>
            {/each}
          </section>
        {:else if !early && data.phase !== 'cancelled'}
          <section class="cup-sec"><h2>{L.secBracket}</h2><p class="card muted">{L.noBracket}</p></section>
        {/if}

        {#if groups.length}
          <section class="cup-sec" data-cup-groups>
            <h2>{L.secGroups}</h2>
            <p class="muted fs-sm">{L.advanceNote}</p>
            {#each groups as g, i (g.no)}
              <CupGroupCard group={g} teams={names} matches={data.matches} {mineId} open={!!mineId && i === 0 && g.standings.some((s) => s.teamId === mineId)} onopen={openMatch} />
            {/each}
          </section>
        {:else if data.phase !== 'cancelled'}
          <section class="cup-sec"><h2>{L.secGroups}</h2><p class="card muted">{L.noGroups}</p></section>
        {/if}

        <details class="card cup-info" open={early} data-cup-schedule>
          <summary><h2>{L.secSchedule}</h2></summary>
          <dl class="cup-sched">
            <div><dt>{L.schedEntry}</dt><dd>{whenText(data.cup.opensAt)} ~ {whenText(closeShownAt(data.cup.closesAt))}</dd></div>
            <div><dt>{L.schedDraw}</dt><dd>{whenText(data.cup.drawAt)}</dd></div>
            {#each data.cup.rounds as r (r.round)}
              <div><dt>{roundLabel(r.round)}</dt><dd>{whenText(r.at)}</dd></div>
            {/each}
          </dl>
        </details>

        <details class="card cup-info" open={early} data-cup-rewards>
          <summary><h2>{L.secRewards}</h2></summary>
          <table class="cup-rewards">
            <thead><tr><th>{L.rewardStage}</th><th>{L.rewardItem}</th></tr></thead>
            <tbody>
              {#each stages as s (s)}
                <tr>
                  <th scope="row">{stageLabel(s)}</th>
                  <td>{L.rewardReroll({ n: CUP_REWARDS[s].rerolls })}{#if CUP_REWARDS[s].trophy}<br /><span class="pill good">{L.rewardTrophy}</span>{/if}</td>
                </tr>
              {/each}
            </tbody>
          </table>
          <p class="muted fs-sm">{L.rewardNote}</p>
        </details>

        <details class="card cup-info" open={early} data-cup-rules>
          <summary><h2>{L.secRules}</h2></summary>
          <ul class="cup-rules">
            <li>{L.rulePlay({ min: data.cup.minFilled, cap: data.cup.capacity })}</li>
            <li>{L.ruleGroup}</li>
            <li>{L.rulePoints}</li>
            <li>{L.ruleKnockout}</li>
            <li>{L.ruleDaily({ time: matchTime })}</li>
            <li>{L.ruleLock({ time: lockTime })}</li>
            <li>{L.ruleForfeit}</li>
          </ul>
        </details>
      {/if}
    </LoadState>
  {/if}
  <BackBar act="cup-back" fallback={() => go('owner')} />
</div>

<style>
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
  .cup-info summary {
    cursor: pointer;
    min-height: 44px;
    display: flex;
    align-items: center;
  }
  .cup-info[open] summary {
    margin-bottom: 8px;
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
