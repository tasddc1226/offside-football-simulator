<script lang="ts">
  import type { GameState } from '@offside/game/types';
  import {
    careerCalendarYears,
    careerScoring,
    calendarSummary,
    scoringSummary,
    scoringNotStarted,
  } from '@offside/app-core/careerOverview';
  import { careerOverviewText as L } from '@offside/app-core/i18n/ko/careerOverview';
  let { s }: { s: GameState } = $props();
  let key = $state<'goals' | 'assists'>('goals');
  const years = $derived(careerCalendarYears(s));
  const rows = $derived(careerScoring(s, key));
  const empty = $derived(scoringNotStarted(s));
  const TONE = { qualified: 'good', eliminated: 'bad', pending: '' } as const;
</script>
<section class="card stack" data-career-overview>
  <h2 data-career-date>{L.cardTitle}</h2>
  <div class="groups">
    <details>
      <summary class="disc-row"><span class="label">{L.calendarTitle}</span><span class="peek">{calendarSummary(s)}</span><span class="disc-chev" aria-hidden="true"></span></summary>
      <p class="muted fs-sm">{L.calendarHint}</p>
      <ol class="calendar">
        {#each years as y (y.year)}
          <li class:current={y.current}>
            <div class="year num">{y.head}</div>
            <ul>
              {#each y.items as r (r.key)}
                <li>
                  <b>{r.title}</b>
                  <small class="muted">{r.detail}</small>
                  {#if r.status}<span class="pill {TONE[r.status]}" data-cal-status={r.status}>{r.statusText}</span>{/if}
                </li>
              {/each}
            </ul>
          </li>
        {/each}
      </ol>
    </details>
    <details data-career-scoring>
      <summary class="disc-row"><span class="label">{L.scoringTitle}</span><span class="peek">{scoringSummary(s)}</span><span class="disc-chev" aria-hidden="true"></span></summary>
      {#if rows}
        <p class="muted fs-sm">{L.scoringHint}</p>
        <div class="seg two rank-tabs" role="group" aria-label={L.scoringTitle}>
          <button class="opt" aria-pressed={key === 'goals'} onclick={() => key = 'goals'}>{L.goalRank}</button>
          <button class="opt" aria-pressed={key === 'assists'} onclick={() => key = 'assists'}>{L.assistRank}</button>
        </div>
        {#if empty}
          <p class="empty muted fs-sm" data-scoring-empty>{L.scoringEmpty}</p>
        {:else}
          <ol class="scoring" aria-label={key === 'goals' ? L.goalRank : L.assistRank}>
            {#each rows as r (r.id)}
              {#if r.gap}<li class="gap" aria-hidden="true">…</li>{/if}
              <li class:mine={r.me} data-scoring-me={r.me || undefined}><span class="num rank">{L.rankLabel({ rank: r.rank })}</span><span class="name">{r.name}{#if r.me}<small class="me-tag">{L.mine}</small>{/if}</span><b class="num">{r.value}</b></li>
            {/each}
          </ol>
        {/if}
      {:else}<p class="muted fs-sm">{L.scoringLegacy}</p>{/if}
    </details>
  </div>
</section>
<style>
  .groups > details { border-top:1px solid var(--line); }
  .groups > details:last-child { border-bottom:1px solid var(--line); }
  summary:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
  summary .label { flex:none; }
  summary .peek { flex:1; min-width:0; text-align:right; color:var(--muted); font-weight:600; font-size:var(--fs-caption); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  summary .disc-chev { margin-left:4px; }
  details > :not(summary):last-child { margin-bottom:14px; }
  .calendar,.calendar ul,.scoring { list-style:none; margin:0; padding:0; }
  .calendar { margin-top:10px; display:grid; gap:12px; }
  .calendar > li { display:grid; grid-template-columns:72px minmax(0,1fr); gap:10px; padding-left:10px; border-left:2px solid var(--line); }
  .calendar > li.current { border-color:var(--accent); }
  .calendar .year { font-weight:700; font-size:var(--fs-caption); color:var(--muted); padding-top:2px; }
  .calendar > li.current .year { color:var(--accent); }
  .calendar ul { display:grid; gap:10px; }
  .calendar ul li { display:grid; gap:3px; justify-items:start; }
  .rank-tabs { margin-top:10px; }
  .rank-tabs .opt { align-items:center; font-weight:700; }
  .empty { margin:12px 0 0; padding:14px; text-align:center; border-radius:var(--radius-md); background:var(--surface-2); }
  .scoring { margin-top:6px; }
  .scoring li { display:grid; grid-template-columns:40px minmax(0,1fr) auto; gap:8px; padding:10px 6px; border-bottom:1px solid var(--line); align-items:center; overflow-wrap:anywhere; }
  .scoring li:last-child { border-bottom:0; }
  .scoring .rank { color:var(--muted); font-size:var(--fs-caption); font-weight:700; }
  .scoring li.mine { border-radius:var(--radius-sm); background:color-mix(in srgb, var(--accent) 12%, var(--surface)); font-weight:700; border-bottom-color:transparent; }
  .scoring li.mine .rank, .scoring li.mine small { color:var(--accent); }
  .scoring .me-tag { margin-left:6px; font-weight:600; }
  .scoring li.gap { display:block; text-align:center; color:var(--muted); padding:2px 0; border-bottom:0; }
  @media (max-width: 360px) { .calendar > li { grid-template-columns:1fr; gap:6px; } }
</style>
