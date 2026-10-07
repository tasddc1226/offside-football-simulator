<script lang="ts">
  // T-11-145 컵 경기 한 줄 — 홈 · 점수(또는 경기 시각) · 원정. 치른 경기는 눌러 상세를 연다. 승부차기·몰수를 함께 적는다.
  import type { CupMatch, CupTeam } from '@offside/app-core/api/cup';
  import { kstMonthDayTime } from '@offside/app-core/boardText';
  import { cupText as L } from '@offside/app-core/i18n/ko/cup';
  import { involves, teamName, winnerSide } from './cupView.js';

  let { m, teams, mineId, onopen }: { m: CupMatch; teams: ReadonlyMap<string, CupTeam>; mineId: string | null; onopen: (m: CupMatch) => void } = $props();

  const home = $derived(teamName(teams, m.homeTeamId));
  const away = $derived(teamName(teams, m.awayTeamId));
  const win = $derived(winnerSide(m));
  const mine = $derived(involves(m, mineId));
  // 몰수 경기는 경기 기록이 없어 상세를 열 수 없다.
  const clickable = $derived(m.played && !m.forfeit);
</script>

{#snippet body()}
  <span class="cm-team" class:win={win === 'home'}>{home}</span>
  <span class="cm-score">
    {#if m.played}<b>{m.homeGoals ?? 0}</b><i aria-hidden="true">:</i><b>{m.awayGoals ?? 0}</b>{:else}<small>{kstMonthDayTime(m.at)}</small>{/if}
  </span>
  <span class="cm-team away" class:win={win === 'away'}>{away}</span>
  {#if m.pens || m.forfeit || mine}
    <span class="cm-tags">
      {#if mine}<span class="pill good">{L.mineTag}</span>{/if}
      {#if m.pens}<span class="pill" data-cup-pens>{L.pens(m.pens)}</span>{/if}
      {#if m.forfeit}<span class="pill warn" data-cup-forfeit>{L.forfeit}</span>{/if}
    </span>
  {/if}
{/snippet}

{#if clickable}
  <button class="cm click" class:mine data-cup-match={m.id} aria-label={L.matchAria({ home, away, hg: m.homeGoals ?? 0, ag: m.awayGoals ?? 0 })} onclick={() => onopen(m)}>{@render body()}</button>
{:else}
  <div class="cm" class:mine data-cup-match={m.id}>{@render body()}</div>
{/if}

<style>
  .cm {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--surface);
    color: var(--ink);
    font: inherit;
    text-align: left;
    min-height: 44px;
  }
  .cm.click {
    cursor: pointer;
  }
  .cm.mine {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 8%, var(--surface));
  }
  .cm-team {
    min-width: 0;
    overflow-wrap: anywhere;
    font-size: 0.9375rem;
  }
  .cm-team.away {
    text-align: right;
  }
  .cm-team.win {
    font-weight: 700;
  }
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
  .cm-score small {
    font-family: var(--body);
    font-size: 0.75rem;
    color: var(--muted);
    white-space: nowrap;
  }
  .cm-tags {
    grid-column: 1 / -1;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    justify-content: center;
  }
</style>
