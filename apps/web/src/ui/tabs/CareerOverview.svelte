<script lang="ts">
  import type { GameState } from '@offside/game/types';
  import { careerDate, careerCalendar, careerScoring } from '@offside/app-core/careerOverview';
  import { careerOverviewText as L } from '@offside/app-core/i18n/ko/careerOverview';
  let { s }: { s: GameState } = $props();
  let key = $state<'goals' | 'assists'>('goals');
  const calendar = $derived(careerCalendar(s));
  const rows = $derived(careerScoring(s, key));
</script>
<section class="card stack" data-career-overview>
  <h2 data-career-date>{careerDate(s)}</h2>
  <details>
    <summary>{L.calendarTitle}</summary>
    <p class="muted fs-sm">{L.calendarHint}</p>
    <ol class="calendar">
      {#each calendar as r (`${r.year}-${r.key}`)}
        <li class:current={r.year === s.year}><b>{r.title}</b><small class="muted">{r.detail}</small></li>
      {/each}
    </ol>
  </details>
  <details data-career-scoring>
    <summary>{L.scoringTitle}</summary>
    {#if rows}
      <p class="muted fs-sm">{L.scoringHint}</p>
      <div class="rank-tabs" role="group" aria-label={L.scoringTitle}>
        <button class="btn btn-sm" aria-pressed={key === 'goals'} onclick={() => key = 'goals'}>{L.goalRank}</button>
        <button class="btn btn-sm" aria-pressed={key === 'assists'} onclick={() => key = 'assists'}>{L.assistRank}</button>
      </div>
      <ol class="scoring" aria-label={key === 'goals' ? L.goalRank : L.assistRank}>
        {#each rows as r (r.id)}
          <li class:mine={r.me} data-scoring-me={r.me || undefined}><span class="num">{L.rankLabel({ rank: r.rank })}</span><span>{r.name}{#if r.me}<small class="muted"> {L.mine}</small>{/if}</span><b class="num">{r.value}</b></li>
        {/each}
      </ol>
    {:else}<p class="muted fs-sm">{L.scoringLegacy}</p>{/if}
  </details>
</section>
<style>
  summary { min-height:44px; display:flex; align-items:center; cursor:pointer; font-weight:700; text-decoration:underline; text-underline-offset:4px; }
  summary:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
  .calendar,.scoring { list-style:none; margin:8px 0 0; padding:0; }
  .calendar li { padding:8px 0 8px 10px; border-left:2px solid var(--line); display:grid; gap:4px; }
  .calendar li.current { border-color:var(--accent); }
  .rank-tabs { display:flex; gap:8px; margin-top:8px; }
  .rank-tabs button { min-height:44px; }
  .rank-tabs [aria-pressed=true] { border-color:var(--accent); }
  .scoring li { display:grid; grid-template-columns:36px minmax(0,1fr) 28px; gap:8px; padding:10px 0; border-bottom:1px solid var(--line); align-items:center; overflow-wrap:anywhere; }
  .scoring li.mine { color:var(--accent); font-weight:700; }
</style>
