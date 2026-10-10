<script lang="ts">
  // T-11-145 컵 경기 한 줄 — 홈 · 점수(또는 경기 시각) · 원정. 치른 경기는 눌러 상세를 연다. 승부차기·몰수를 함께 적는다.
  import type { CupMatch, CupTeam } from '@offside/app-core/api/cup';
  import { kstMonthDayTime } from '@offside/app-core/boardText';
  import { cupText as L } from '@offside/app-core/i18n/ko/cup';
  import { involves, teamName, winnerSide } from './cupView.js';
  import CupPrediction from './CupPrediction.svelte';
  import type { CupPredictionContext } from '@offside/app-core/cupPredictions';
  import TeamLogo from '../team/TeamLogo.svelte';

  let { m, teams, mineId, onopen, prediction }: { m: CupMatch; teams: ReadonlyMap<string, CupTeam>; mineId: string | null; onopen: (m: CupMatch) => void; prediction: CupPredictionContext } = $props();

  const home = $derived(teamName(teams, m.homeTeamId));
  const away = $derived(teamName(teams, m.awayTeamId));
  const win = $derived(winnerSide(m));
  const mine = $derived(involves(m, mineId));
  // 몰수 경기는 경기 기록이 없어 상세를 열 수 없다.
  const clickable = $derived(m.played && !m.forfeit);
</script>

{#snippet body()}
  <span class="cm-status"><span class="pill" class:good={m.played} class:cup-upcoming={!m.played && m.at > new Date().toISOString()} class:warn={!m.played && m.at <= new Date().toISOString()} data-cup-status>{m.played ? L.matchFinished : m.at <= new Date().toISOString() ? L.matchProcessing : L.matchScheduled}</span></span>
  <span class="cm-side home">
    {#if m.homeTeamId}<TeamLogo logo={teams.get(m.homeTeamId)?.logo} name={home} size={24} decorative />{/if}
    <span class="cm-team" class:win={win === 'home'} class:own={m.homeTeamId === mineId}>{home}</span>
  </span>
  <span class="cm-score">
    {#if m.played}<b>{m.homeGoals ?? 0}</b><i aria-hidden="true">:</i><b>{m.awayGoals ?? 0}</b>{:else}<span>vs</span>{/if}
  </span>
  <span class="cm-side away">
    {#if m.awayTeamId}<TeamLogo logo={teams.get(m.awayTeamId)?.logo} name={away} size={24} decorative />{/if}
    <span class="cm-team" class:win={win === 'away'} class:own={m.awayTeamId === mineId}>{away}</span>
  </span>
    <span class="cm-tags muted fs-xs">
      {#if m.round.startsWith('g')}<span>{kstMonthDayTime(m.at)}</span>{/if}
      {#if mine}<span class="pill good">{L.mineTag}</span>{/if}
      {#if m.pens}<span class="pill" data-cup-pens>{L.pens(m.pens)}</span>{/if}
      {#if m.forfeit}<span class="pill warn" data-cup-forfeit>{L.forfeit}</span>{/if}
    </span>
{/snippet}

{#if clickable}
  <button class="cm click" class:mine data-cup-match={m.id} aria-label={L.matchAria({ home, away, hg: m.homeGoals ?? 0, ag: m.awayGoals ?? 0 })} onclick={() => onopen(m)}>{@render body()}</button>
{:else}
  <div class="cm" class:mine data-cup-match={m.id}>{@render body()}</div>
{/if}

<CupPrediction {m} {prediction} />

<style>
  .cm {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 0;
    border: 0;
    border-top: 1px solid var(--line);
    background: transparent;
    color: var(--ink);
    font: inherit;
    text-align: left;
    min-height: 44px;
  }
  .cm.click {
    cursor: pointer;
  }
  .cm.mine {
    border-top-color: var(--accent);
  }
  .cm-side { display: flex; align-items: center; gap: 6px; min-width: 0; }
  .cm-side.home { flex-direction: row-reverse; text-align: right; }
  .cm-team {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
    font-size: 0.875rem;
  }
  .cm-team.own { color: var(--accent); }
  .cm-team.win {
    font-weight: 700;
  }
  .cm-status { grid-column: 1 / -1; justify-self: center; white-space: nowrap; }
  .cm-score {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    min-width: 56px;
    font-family: var(--display);
    font-size: 1.25rem;
    font-variant-numeric: tabular-nums;
  }
  .cm-tags {
    grid-column: 1 / -1;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    justify-content: center;
  }
</style>
