<script lang="ts">
  // ui.ts careerTab() 포트 (371~387줄)
  import type { GameState, LegendSource } from '@offside/game/types';
  import { fmtValue, seasonLabelOf, totals } from '@offside/app-core/format';
  import ClubMark from '../ClubMark.svelte';
  import ValueChart from '../ValueChart.svelte';
  import { nextMilestones } from '@offside/game/records';
  import { peakValue, seasonValue } from '@offside/contracts/market-value';

  // 은퇴 상세(LegendSource)에는 '다음 목표'가 없다 — 진행 중인 커리어(GameState)에서만 계산한다.
  // chart: 몸값 그래프·최고 몸값 줄. 은퇴 크레딧은 자기 '몸값 흐름' 장면이 있어 끈다(T-10-106).
  const { s, chart = true }: { s: LegendSource | GameState; chart?: boolean } = $props();
  const t = $derived(totals(s));
  const rows = $derived(s.career.slice().reverse());
  const miles = $derived((s.miles || []).slice().reverse());
  const next = $derived('attrs' in s && !s.retired ? nextMilestones(s) : []);
  const peakV = $derived(chart ? peakValue(s.career) : null);
</script>

<section class="card stack">
  <div><div class="eyebrow">Career</div><h2>통산 기록</h2></div>
  <div class="totals">
    <div><b>{t.p}</b><span>경기</span></div>
    <div><b>{t.g}</b><span>골</span></div>
    {#if s.pos === 'GK' || s.pos === 'DF'}
      <div><b>{t.cs}</b><span>무실점</span></div>
    {:else}
      <div><b>{t.a}</b><span>도움</span></div>
    {/if}
    <div><b>{s.trophies.length + s.awards.length}</b><span>수상</span></div>
  </div>
  {#if peakV}
    <ValueChart rows={s.career} />
    <p class="muted fs-sm" data-peak-value>최고 몸값 <b>{fmtValue(peakV.value)}</b> · {seasonLabelOf(peakV.row)} {peakV.row.club}</p>
  {/if}
</section>
{#if next.length}
  <section class="card stack">
    <div><div class="eyebrow">Next Goals</div><h2>다음 목표</h2></div>
    <div class="mile-next">
      {#each next as m, i (m.key)}
        <div class="mile-row">
          <div class="mile-lbl"><b>{m.label}</b><span>{m.have} / {m.target} · 남은 {m.remaining}</span></div>
          <div class="legend-bar"><i style="width:{Math.min(100, Math.round((m.have / m.target) * 100))}%;--d:{i * 90}ms"></i></div>
        </div>
      {/each}
    </div>
  </section>
{/if}
<section class="card stack">
  {#if s.career.length}
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>시즌</th><th>소속</th><th class="n">경기</th><th class="n">골</th><th class="n">도움</th><th class="n">평점</th><th class="n">순위</th><th class="n">OVR</th></tr>
        </thead>
        <tbody>
          {#each rows as r, i (i)}
            {@const sv = seasonValue(r)}
            <tr>
              <td>{r.mil ? r.year : seasonLabelOf(r)} <span class="muted">({r.age})</span>{#if r.ch?.length}<br /><span class="badge-ch">CH×{r.ch.length}</span>{/if}</td>
              <td><ClubMark name={r.club} id={r.clubId} /> {r.club}<div class="muted season-sub">{r.league}{sv ? ' · ' : ''}{#if sv}<span class="season-value" data-season-value>몸값 {fmtValue(sv)}</span>{/if}{r.honors.length ? ` · ` : ''}{#if r.honors.length}<span class="honor">{r.honors.join(', ')}</span>{/if}</div></td>
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
    <p class="empty">첫 시즌을 마치면 기록이 쌓입니다.</p>
  {/if}
  <p class="muted fs-xs">경기·골·도움은 리그·컵·대륙 대회를 합친 공식전 기록입니다. 몸값은 시즌을 마친 때의 리그·OVR·나이로 매긴 추정치(이적료 기준)예요.</p>
</section>
<section class="card">
  <div class="eyebrow">Journey</div>
  <h2 style="margin-bottom:4px">커리어 여정</h2>
  {#if miles.length}
    {#each miles as m, i (i)}
      <div class="trophy"><span class="y">{m.year}</span><div><b>{m.t}</b></div></div>
    {/each}
  {:else}
    <p class="empty">프로 데뷔부터 여정이 기록됩니다.</p>
  {/if}
</section>
