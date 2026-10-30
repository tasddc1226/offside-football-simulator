<script lang="ts">
  // T-11-418d 마지막 라운드 동시 중계: 같은 리그 경기를 한 시계(0' → 90')로 같이 흘리며, 골이 들어가면 그 스코어로 순위표를
  // 다시 센다. 결과는 이미 서버가 정했고 여기서는 보여 주기만 한다. 감속 모션이어도 시계 템포는 그대로 두고(읽는 시간) 움직임
  // 효과만 뺀다. '결과 바로 보기'로 언제든 끝낸다.
  import { onDestroy } from 'svelte';
  import type { LeagueTableResponse } from '@offside/app-core/api/league';
  import { cupText as C } from '@offside/app-core/i18n/ko/cup';
  import { leagueText as L } from '@offside/app-core/i18n/ko/league';
  import { LEAGUE_LIVE_END, leagueLastRound, leagueLive } from '@offside/app-core/leagueView';
  import PopSheet from '../PopSheet.svelte';

  let { table, mineId, onclose }: { table: LeagueTableResponse; mineId: string | null; onclose: () => void } =
    $props();

  /** 1분이 흐르는 시간(ms). 90분이 36초. */
  const MINUTE_MS = 400;
  let minute = $state(0);
  let timer: ReturnType<typeof setInterval> | null = null;

  function start() {
    stop();
    minute = 0;
    timer = setInterval(() => {
      minute = Math.min(LEAGUE_LIVE_END, minute + 1);
      if (minute >= LEAGUE_LIVE_END) stop();
    }, MINUTE_MS);
  }
  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }
  function skip() {
    stop();
    minute = LEAGUE_LIVE_END;
  }
  start();
  onDestroy(stop);

  const teams = $derived(new Map(table.teams.map((t) => [t.teamId, t])));
  const name = (id: string) => teams.get(id)?.name ?? C.tbd;
  const matches = $derived(table.matches.filter((m) => m.round === leagueLastRound(table)));
  const live = $derived(leagueLive(table, minute));
  const ended = $derived(minute >= LEAGUE_LIVE_END);
  /** 방금(2분 안) 골이 난 경기. */
  const fresh = (id: string) =>
    !!matches.find((m) => m.id === id)?.goals?.some((g) => g.minute <= minute && g.minute > minute - 2);
</script>

<PopSheet label={L.finalLive} {onclose}>
  <div class="fl" data-league-live>
    <div class="fl-head">
      <h2>{L.finalLive}</h2>
      <span class="fl-clock" data-league-clock>{ended ? L.liveFullTime : L.liveClock({ minute })}</span>
    </div>
    <p class="muted fs-sm">{L.finalLiveNote}</p>
    <ul class="fl-matches">
      {#each matches as m (m.id)}
        {@const sc = live.scores.get(m.id)}
        <li class:mine={m.homeTeamId === mineId || m.awayTeamId === mineId} class:goal={fresh(m.id)} data-league-live-match={m.id}>
          <span class="fl-side">{name(m.homeTeamId)}</span>
          <b class="fl-mid">{sc?.home ?? 0} : {sc?.away ?? 0}{#if m.forfeit}<small class="pill warn">{L.forfeitScore}</small>{/if}</b>
          <span class="fl-side away">{name(m.awayTeamId)}</span>
        </li>
      {/each}
    </ul>
    <h3>{L.liveTable}</h3>
    <ol class="fl-table">
      {#each live.rows as r (r.teamId)}
        <li class:mine={r.teamId === mineId} data-league-live-rank={r.rank}>
          <span class="rk">{r.rank}</span>
          <span class="nm">{name(r.teamId)}</span>
          <span class="mv" class:up={r.move > 0} class:down={r.move < 0}>{r.move > 0 ? `▲${r.move}` : r.move < 0 ? `▼${-r.move}` : ''}</span>
          <b>{r.pts}</b>
        </li>
      {/each}
    </ol>
    <div class="fl-acts">
      {#if ended}
        <button class="btn btn-primary" data-act="league-live-replay" onclick={start}>{L.liveReplay}</button>
      {:else}
        <button class="btn btn-primary" data-act="league-live-skip" onclick={skip}>{L.liveSkip}</button>
      {/if}
      <button class="btn" data-act="league-live-close" onclick={onclose}>{L.liveClose}</button>
    </div>
  </div>
</PopSheet>

<style>
  .fl { display: flex; flex-direction: column; gap: 10px; }
  .fl h2, .fl h3, .fl p { margin: 0; }
  .fl-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .fl-clock { font-family: var(--display); font-weight: 700; font-variant-numeric: tabular-nums; min-width: 4.5em; text-align: right; }
  .fl-matches, .fl-table { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
  .fl-matches li { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 8px; min-height: 44px; border-top: 1px solid var(--line); font-size: var(--fs-body2); }
  .fl-matches li.mine .fl-side { font-weight: 700; }
  .fl-matches li.goal .fl-mid { color: var(--accent-text); }
  .fl-side { min-width: 0; overflow-wrap: anywhere; }
  .fl-side.away { text-align: right; }
  .fl-mid { display: flex; flex-direction: column; align-items: center; gap: 2px; font-family: var(--display); font-variant-numeric: tabular-nums; }
  .fl-table li { display: grid; grid-template-columns: 1.6em 1fr auto 2.2em; align-items: center; gap: 6px; min-height: 36px; border-top: 1px solid var(--line); font-size: var(--fs-body2); font-variant-numeric: tabular-nums; }
  .fl-table li.mine .nm { font-weight: 700; color: var(--accent-text); }
  .fl-table .rk { color: var(--muted); }
  .fl-table .nm { min-width: 0; overflow-wrap: anywhere; }
  .fl-table b { text-align: right; }
  .mv { font-size: var(--fs-caption); }
  .mv.up { color: var(--good); }
  .mv.down { color: var(--warn); }
  .fl-acts { display: flex; gap: 8px; flex-wrap: wrap; }
  .fl-acts .btn { flex: 1; min-height: 44px; }
</style>
