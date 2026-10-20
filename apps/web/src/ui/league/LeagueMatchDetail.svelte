<script lang="ts">
  // T-11-418b 리그 경기 상세 — 스코어와 득점 기록, 처음 열면 문자중계부터. 컵 경기 상세와 같은 모양이고 리그는 홈 경기라
  // 중계에 홈 · 원정을 그대로 둔다. 선수 이름은 서버가 준 공개 이름 · 익명 표기 그대로다.
  import { onMount } from 'svelte';
  import { fetchLeagueMatch, type LeagueMatch, type LeagueMatchResponse, type LeagueTableResponse } from '@offside/app-core/api/league';
  import { cupText as C } from '@offside/app-core/i18n/ko/cup';
  import { leagueText as L } from '@offside/app-core/i18n/ko/league';
  import { kstMonthDayTime } from '@offside/app-core/boardText';
  import { cupLiveMatch, firstLive } from '@offside/app-core/teamLive';
  import { teamMatchText as TM } from '@offside/app-core/i18n/ko/teamMatch';
  import LoadState, { type LoadStatus } from '../LoadState.svelte';
  import TeamLogo from '../team/TeamLogo.svelte';
  import TeamLive from '../team/TeamLive.svelte';

  let { season, m, table, mineId, onback }: { season: number; m: LeagueMatch; table: LeagueTableResponse; mineId: string | null; onback: () => void } = $props();

  let status = $state<LoadStatus>('loading');
  let detail = $state<LeagueMatchResponse | null>(null);
  let live = $state(false);
  const keep = (_: string | null, fallback: string) => fallback;
  const owners = $derived(new Map(table.teams.map((t) => [t.teamId, t.owner])));

  async function load() {
    status = 'loading';
    const r = await fetchLeagueMatch(season, m.id);
    if (!r.ok) return (status = 'error');
    detail = r.data;
    live = firstLive(m.id);
    status = 'ready';
  }
  onMount(() => void load());
  const mineSide = $derived(m.homeTeamId === mineId ? 'home' : m.awayTeamId === mineId ? 'away' : null);
</script>

<button class="btn btn-sm self-start" data-act="league-detail-back" onclick={onback}>{L.detailBack}</button>
<LoadState {status} failText={C.detailFail} retry={load}>
  {#if detail && live}
    {@const v = cupLiveMatch(detail.match, mineId)}
    <TeamLive match={v.match} neutral={v.neutral} name={keep} onend={() => ((live = false), window.scrollTo(0, 0))} />
  {:else if detail}
    {@const d = detail.match}
    <section class="card stack lmd" style="gap:14px" data-league-detail={m.id}>
      <div>
        <div class="eyebrow">Offside League</div>
        <h1>{L.detailTitle({ tier: detail.league.tier, league: detail.league.league, round: detail.league.round })}</h1>
      </div>
      <div class="lmd-score">
        <div class="lmd-side" class:mine={mineSide === 'home'}>
          <TeamLogo logo={d.home.logo} name={d.home.name} size={40} decorative />
          <b>{d.home.name}</b><small class="muted">{owners.get(d.home.teamId) ?? d.home.owner} · OVR {d.home.ovr}</small>
        </div>
        <div class="lmd-goals"><b>{d.home.goals}</b><span aria-hidden="true">:</span><b>{d.away.goals}</b></div>
        <div class="lmd-side away" class:mine={mineSide === 'away'}>
          <TeamLogo logo={d.away.logo} name={d.away.name} size={40} decorative />
          <b>{d.away.name}</b><small class="muted">{owners.get(d.away.teamId) ?? d.away.owner} · OVR {d.away.ovr}</small>
        </div>
      </div>
      {#if d.events.length}
        <ol class="lmd-events">
          {#each d.events as e, k (k)}
            <li class:away={e.side === 'away'}>
              <span class="lmd-min">{e.minute}'</span>
              <span><b>{e.scorer}</b>{#if e.assist}<small class="muted">{C.assist({ name: e.assist })}</small>{/if}</span>
            </li>
          {/each}
        </ol>
      {:else}
        <p class="muted">{C.noGoals}</p>
      {/if}
      <p class="muted fs-sm">{kstMonthDayTime(d.createdAt)}</p>
      <button class="btn self-start" data-act="league-replay" onclick={() => (live = true)}>{TM.replay}</button>
    </section>
  {/if}
</LoadState>

<style>
  .lmd-score { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 10px; }
  .lmd-side { display: flex; flex-direction: column; gap: 2px; min-width: 0; overflow-wrap: anywhere; }
  .lmd-side.away { text-align: right; align-items: flex-end; }
  .lmd-side.mine b { color: var(--accent-text); }
  .lmd-goals { display: flex; gap: 8px; font-family: var(--display); font-size: 2.5rem; font-weight: 700; line-height: 1; }
  .lmd-events { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .lmd-events li { display: flex; gap: 10px; align-items: baseline; }
  .lmd-events li.away { flex-direction: row-reverse; text-align: right; }
  .lmd-events li > span:last-child { display: flex; flex-direction: column; }
  .lmd-min { flex: none; font-family: var(--display); font-weight: 700; color: var(--muted); min-width: 2.2em; }
</style>
