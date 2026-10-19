<script lang="ts">
  // T-11-145 컵 경기 한 줄 — 홈 · 점수(또는 경기 시각) · 원정. 치른 경기는 점수를 눌러 상세를 연다. 승부차기·몰수를 함께 적는다.
  // T-11-290 팀(로고·이름)을 누르면 팀 프로필, 그 아래 구단주 이름을 누르면 구단주 프로필(승부예측 줄에서 상대를 살핀다).
  // T-11-407 명단이 잠긴 경기(1시간 전부터)는 홈 · 무 · 원정 예상 막대를 붙이고, 끝난 경기는 '경기 전 예상'으로 남긴다.
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

{#snippet side(id: string | null, kind: 'home' | 'away')}
  {@const t = id ? teams.get(id) : undefined}
  {@const nm = kind === 'home' ? home : away}
  <span class="cm-side {kind}">
    {#if id && t}
      <button class="cm-team-btn" data-act="cup-team" onclick={() => prediction.team(id)} aria-label={L.teamProfileOpen({ team: nm })}>
        <TeamLogo logo={t.logo} name={nm} size={24} decorative />
        <span class="cm-team" class:win={win === kind} class:own={id === mineId}>{nm}</span>
      </button>
      <button class="cm-owner" data-act="cup-owner" onclick={() => prediction.team(id, true)} aria-label={L.ownerProfileOpen({ owner: t.owner })}>{t.owner}</button>
    {:else}
      <span class="cm-team" class:win={win === kind}>{nm}</span>
    {/if}
  </span>
{/snippet}

<div class="cm" class:mine data-cup-match={m.id}>
  <span class="cm-status"><span class="pill" class:good={m.played} class:cup-upcoming={!m.played && m.at > new Date().toISOString()} class:warn={!m.played && m.at <= new Date().toISOString()} data-cup-status>{m.played ? L.matchFinished : m.at <= new Date().toISOString() ? L.matchProcessing : L.matchScheduled}</span></span>
  {@render side(m.homeTeamId, 'home')}
  {#if clickable}
    <button class="cm-score cm-open" data-act="cup-match-open" aria-label={L.matchAria({ home, away, hg: m.homeGoals ?? 0, ag: m.awayGoals ?? 0 })} onclick={() => onopen(m)}>
      <b>{m.homeGoals ?? 0}</b><i aria-hidden="true">:</i><b>{m.awayGoals ?? 0}</b>
    </button>
  {:else}
    <span class="cm-score">
      {#if m.played}<b>{m.homeGoals ?? 0}</b><i aria-hidden="true">:</i><b>{m.awayGoals ?? 0}</b>{:else}<span>vs</span>{/if}
    </span>
  {/if}
  {@render side(m.awayTeamId, 'away')}
  <span class="cm-tags muted fs-xs">
    {#if m.round.startsWith('g')}<span>{kstMonthDayTime(m.at)}</span>{/if}
    {#if mine}<span class="pill good">{L.mineTag}</span>{/if}
    {#if m.pens}<span class="pill" data-cup-pens>{L.pens(m.pens)}</span>{/if}
    {#if m.forfeit}<span class="pill warn" data-cup-forfeit>{L.forfeit}</span>{/if}
  </span>
  {#if m.odds}
    {@const label = m.played ? L.matchOddsBefore : L.matchOddsLabel}
    <span class="cm-odds" role="img" data-cup-match-odds aria-label={L.matchOddsAria({ label, home, away, h: m.odds.home, d: m.odds.draw, a: m.odds.away })}>
      <span class="cm-odds-bar" aria-hidden="true"><i class="h" style:flex-grow={m.odds.home}></i><i class="d" style:flex-grow={m.odds.draw}></i><i class="a" style:flex-grow={m.odds.away}></i></span>
      <span class="cm-odds-nums fs-xs" aria-hidden="true"><b>{m.odds.home}%</b><span class="muted">{label} · {L.matchOddsDraw({ n: m.odds.draw })}</span><b>{m.odds.away}%</b></span>
    </span>
  {/if}
</div>

<CupPrediction {m} {prediction} />

<style>
  .cm {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 0;
    border-top: 1px solid var(--line);
    color: var(--ink);
    min-height: 44px;
  }
  .cm.mine {
    border-top-color: var(--accent);
  }
  .cm-side {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .cm-side.home {
    align-items: flex-end;
    text-align: right;
  }
  .cm-side.away {
    align-items: flex-start;
    text-align: left;
  }
  .cm-team-btn,
  .cm-owner {
    display: flex;
    align-items: center;
    gap: 6px;
    max-width: 100%;
    min-width: 0;
    padding: 2px 0;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: inherit;
    cursor: pointer;
    border-radius: var(--radius-xs);
  }
  .home .cm-team-btn {
    flex-direction: row-reverse;
  }
  .cm-owner {
    color: var(--muted);
    font-size: var(--fs-caption2);
    min-height: 20px;
    text-decoration: underline dotted;
    text-underline-offset: 3px;
  }
  .cm-team-btn:focus-visible,
  .cm-owner:focus-visible,
  .cm-open:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  @media (hover: hover) {
    .cm-team-btn:hover .cm-team,
    .cm-owner:hover {
      color: var(--accent-text);
    }
  }
  .cm-team {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
    font-size: var(--fs-body2);
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
    font-size: var(--fs-title2);
    font-variant-numeric: tabular-nums;
    color: inherit;
  }
  .cm-open {
    min-height: 40px;
    padding: 0 10px;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    cursor: pointer;
    font: inherit;
    font-family: var(--display);
    font-size: var(--fs-title2);
  }
  @media (hover: hover) {
    .cm-open:hover {
      border-color: var(--accent);
    }
  }
  .cm-odds {
    grid-column: 1 / -1;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .cm-odds-bar {
    display: flex;
    gap: 2px;
    height: 6px;
    border-radius: 3px;
    overflow: hidden;
  }
  .cm-odds-bar i { flex-basis: 0; min-width: 2px; }
  .cm-odds-bar .h { background: var(--accent); }
  .cm-odds-bar .d { background: var(--line); }
  .cm-odds-bar .a { background: var(--muted); }
  .cm-odds-nums {
    display: flex;
    justify-content: space-between;
    gap: 8px;
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
