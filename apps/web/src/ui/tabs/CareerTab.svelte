<script lang="ts">
  import { tn } from '@offside/game/i18n/names';
  // ui.ts careerTab() 포트 (371~387줄)
  import type { GameState, LegendSource } from '@offside/game/types';
  import { fmtValue, seasonLabelOf, totals } from '@offside/app-core/format';
  import ClubMark from '../ClubMark.svelte';
  import ValueChart from '../ValueChart.svelte';
  import { careerGoals, goalsNote, retiredNumberHint } from '@offside/app-core/career-feedback';
  import { gameCareerText as L } from '@offside/app-core/i18n/ko/gameCareer';
  import { peakValue, seasonValue } from '@offside/contracts/market-value';

  // 은퇴 상세(LegendSource)에는 '다음 목표'가 없다 — 진행 중인 커리어(GameState)에서만 계산한다.
  // chart: 몸값 그래프·최고 몸값 줄. 은퇴 크레딧은 자기 '몸값 흐름' 장면이 있어 끈다(T-10-106).
  const { s, chart = true }: { s: LegendSource | GameState; chart?: boolean } = $props();
  const t = $derived(totals(s));
  const rows = $derived(s.career.slice().reverse());
  const miles = $derived((s.miles || []).slice().reverse());
  const next = $derived('attrs' in s && !s.retired ? careerGoals(s) : []);
  // 진행 중인 커리어에만 있다. 다음 목표 카드도 이 값으로 보인다.
  const rnHint = $derived('attrs' in s && !s.retired ? retiredNumberHint(s) : null);
  const peakV = $derived(chart ? peakValue(s.career) : null);
</script>

<section class="card stack">
  <div><div class="eyebrow">Career</div><h2>{L.totalsTitle}</h2></div>
  <div class="totals">
    <div><b>{t.p}</b><span>{L.apps}</span></div>
    <div><b>{t.g}</b><span>{L.goals}</span></div>
    {#if s.pos === 'GK' || s.pos === 'DF'}
      <div><b>{t.cs}</b><span>{L.cleanSheets}</span></div>
    {:else}
      <div><b>{t.a}</b><span>{L.assists}</span></div>
    {/if}
    <div><b>{s.trophies.length + s.awards.length}</b><span>{L.awards}</span></div>
  </div>
  {#if peakV}
    <ValueChart rows={s.career} />
    <p class="muted fs-sm" data-peak-value>{L.peakValue} <b>{fmtValue(peakV.value)}</b> · {seasonLabelOf(peakV.row)} {tn(peakV.row.club)}</p>
  {/if}
</section>
{#if rnHint}
  <section class="card stack" data-career-goals>
    <div><div class="eyebrow">Next Goals</div><h2>{L.goalsTitle}</h2></div>
    <p class="muted fs-sm">{goalsNote()}</p>
    <div class="mile-next">
      {#each next as m, i (m.key)}
        <div class="mile-row">
          <div class="mile-lbl"><b>{m.label}</b><span>{L.goalLine({ have: m.have, target: m.target, remaining: m.remaining })}</span></div>
          <div class="legend-bar" role="progressbar" aria-label={m.label} aria-valuemin={0} aria-valuemax={m.target} aria-valuenow={m.have}><i style="width:{Math.min(100, Math.round((m.have / m.target) * 100))}%;--d:{i * 90}ms"></i></div>
        </div>
      {/each}
    </div>
    <p class="muted fs-sm" data-rn-hint>{rnHint}</p>
  </section>
{/if}
<section class="card stack">
  {#if s.career.length}
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>{L.colSeason}</th><th>{L.colClub}</th><th class="n">{L.apps}</th><th class="n">{L.goals}</th><th class="n">{L.assists}</th><th class="n">{L.colRating}</th><th class="n">{L.colRank}</th><th class="n">OVR</th></tr>
        </thead>
        <tbody>
          {#each rows as r, i (i)}
            {@const sv = seasonValue(r)}
            <tr>
              <td>{r.mil ? r.year : seasonLabelOf(r)} <span class="muted">({r.age})</span>{#if r.ch?.length}<br /><span class="badge-ch">CH×{r.ch.length}</span>{/if}</td>
              <td><ClubMark name={r.club} id={r.clubId} /> {tn(r.club)}<div class="muted season-sub">{tn(r.league)}{sv ? ' · ' : ''}{#if sv}<span class="season-value" data-season-value>{L.seasonValue({ value: fmtValue(sv) })}</span>{/if}{r.honors.length ? ` · ` : ''}{#if r.honors.length}<span class="honor">{r.honors.map(tn).join(', ')}</span>{/if}</div></td>
              <td class="n">{r.apps}</td>
              <td class="n">{r.goals}</td>
              <td class="n">{r.assists}</td>
              <td class="n">{r.rating ? r.rating.toFixed(2) : '-'}</td>
              <td class="n">{r.rank}</td>
              <td class="n">{r.ovr}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <p class="empty">{L.emptyRecords}</p>
  {/if}
  <p class="muted fs-xs">{L.recordsNote}</p>
</section>
<section class="card">
  <div class="eyebrow">Journey</div>
  <h2 style="margin-bottom:4px">{L.journeyTitle}</h2>
  {#if miles.length}
    {#each miles as m, i (i)}
      <div class="trophy"><span class="y">{m.year}</span><div><b>{tn(m.t)}</b></div></div>
    {/each}
  {:else}
    <p class="empty">{L.emptyJourney}</p>
  {/if}
</section>
