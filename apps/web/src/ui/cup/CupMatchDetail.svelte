<script lang="ts">
  // T-11-145 컵 경기 상세 — 스코어(승부차기 포함)와 득점 기록. 팀 경기 결과 화면과 같은 모양이고, 컵 경기는 공개라 선수 이름은
  // 서버가 준 공개 이름·익명 표기 그대로 보여 준다. 레이팅 변화는 없다.
  import { onMount } from 'svelte';
  import { fetchCupMatch, type CupMatch, type CupMatchResponse, type CupTeam } from '@offside/app-core/api/cup';
  import { cupText as L } from '@offside/app-core/i18n/ko/cup';
  import { kstMonthDayTime } from '@offside/app-core/boardText';
  import LoadState, { type LoadStatus } from '../LoadState.svelte';
  import TeamLogo from '../team/TeamLogo.svelte';
  import { roundLabel, winnerSide } from './cupView.js';

  let { cupId, m, teams, mineId, onback }: { cupId: string; m: CupMatch; teams: ReadonlyMap<string, CupTeam>; mineId: string | null; onback: () => void } = $props();

  let status = $state<LoadStatus>('loading');
  let detail = $state<CupMatchResponse | null>(null);
  async function load() {
    status = 'loading';
    const r = await fetchCupMatch(cupId, m.id);
    if (!r.ok) {
      status = 'error';
      return;
    }
    detail = r.data;
    status = 'ready';
  }
  onMount(() => void load());

  const win = $derived(winnerSide(m));
  const mineSide = $derived(m.homeTeamId === mineId ? 'home' : m.awayTeamId === mineId ? 'away' : null);
</script>

<button class="btn btn-sm self-start" data-act="cup-detail-back" onclick={onback}>{L.detailBack}</button>
<LoadState {status} failText={L.detailFail} retry={load}>
  {#if detail}
    {@const d = detail.match}
    <section class="card stack cmd" style="gap:14px" data-cup-detail={m.id}>
      <div>
        <div class="eyebrow">Offside Cup</div>
        <h1>{L.detailRound({ round: roundLabel(detail.cup.round), group: detail.cup.group })}</h1>
      </div>
      <div class="cmd-score">
        <div class="cmd-side" class:mine={mineSide === 'home'}>
          <TeamLogo logo={d.home.logo} name={d.home.name} size={40} decorative />
          <b>{d.home.name}</b><small class="muted">{teams.get(d.home.teamId)?.owner ?? d.home.owner} · OVR {d.home.ovr}</small>
        </div>
        <div class="cmd-goals"><b>{d.home.goals}</b><span aria-hidden="true">:</span><b>{d.away.goals}</b></div>
        <div class="cmd-side away" class:mine={mineSide === 'away'}>
          <TeamLogo logo={d.away.logo} name={d.away.name} size={40} decorative />
          <b>{d.away.name}</b><small class="muted">{teams.get(d.away.teamId)?.owner ?? d.away.owner} · OVR {d.away.ovr}</small>
        </div>
      </div>
      {#if detail.cup.pens}
        <p class="cmd-pens" data-cup-pens>
          <span class="pill">{L.pens(detail.cup.pens)}</span>
          <b>{L.penWinner({ team: win === 'away' ? d.away.name : d.home.name })}</b>
        </p>
      {:else if detail.cup.forfeit}
        <p class="muted fs-sm">{L.forfeitNote}</p>
      {:else if win}
        <p class="fs-sm"><b>{L.winner({ team: win === 'home' ? d.home.name : d.away.name })}</b></p>
      {:else}
        <p class="fs-sm"><b>{L.draw}</b></p>
      {/if}
      {#if d.events.length}
        <ol class="cmd-events">
          {#each d.events as e, k (k)}
            <li class:away={e.side === 'away'}>
              <span class="cmd-min">{e.minute}'</span>
              <span>
                <b>{e.scorer}</b>
                {#if e.assist}<small class="muted">{L.assist({ name: e.assist })}</small>{/if}
              </span>
            </li>
          {/each}
        </ol>
      {:else}
        <p class="muted">{L.noGoals}</p>
      {/if}
      <p class="muted fs-sm">{kstMonthDayTime(d.createdAt)}</p>
    </section>
  {/if}
</LoadState>

<style>
  .cmd-score {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 10px;
  }
  .cmd-side {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .cmd-side.away {
    text-align: right;
    align-items: flex-end;
  }
  .cmd-side.mine b {
    color: var(--accent-text);
  }
  .cmd-goals {
    display: flex;
    gap: 8px;
    font-family: var(--display);
    font-size: 2.5rem;
    font-weight: 700;
    line-height: 1;
  }
  .cmd-pens {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    font-size: 0.875rem;
  }
  .cmd-events {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .cmd-events li {
    display: flex;
    gap: 10px;
    align-items: baseline;
  }
  .cmd-events li.away {
    flex-direction: row-reverse;
    text-align: right;
  }
  .cmd-events li > span:last-child {
    display: flex;
    flex-direction: column;
  }
  .cmd-min {
    flex: none;
    font-family: var(--display);
    font-weight: 700;
    color: var(--muted);
    min-width: 2.2em;
  }
</style>
