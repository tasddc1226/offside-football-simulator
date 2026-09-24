<script lang="ts">
  // 은퇴 리포트 본문(T-10-002에서 Retired.svelte에 있던 것). T-10-005부터 은퇴 직후 화면과 명예의 전당
  // 상세 화면이 함께 쓴다 — 진행 중 세이브(G)든 저장된 스냅샷이든 LegendView 하나로 그린다.
  import { legendScoreBreakdown, legendTitle } from '../game/season.js';
  import { personalBests, primeSeasons, bestSeasons, careerTimeline } from '../game/retirement-report.js';
  import { totals, seasonLabelOf } from './format.js';
  import type { LegendView } from './state.svelte.js';
  import CareerTab from './tabs/CareerTab.svelte';
  import TrophyTab from './tabs/TrophyTab.svelte';

  const { v }: { v: LegendView } = $props();
  const d = $derived(v.d);
  const back = $derived(v.pos === 'GK' || v.pos === 'DF');
  const t = $derived(d ? totals(d) : null);
  const clubCount = $derived(d ? new Set(d.career.map((r) => r.club)).size : 0);

  const breakdown = $derived(d ? legendScoreBreakdown(d) : null);
  const maxAbs = $derived(breakdown ? Math.max(1, ...breakdown.items.map((i) => Math.abs(i.value))) : 1);
  const prime = $derived(d ? primeSeasons(d) : []);
  const best3 = $derived(d ? bestSeasons(d) : []);
  const bests = $derived(d ? personalBests(d) : []);
  const timeline = $derived(d ? careerTimeline(d).slice().reverse() : []);
</script>

<section class="player">
  <div class="chalk"></div>
  <div>
    <div class="shirt">Full Time{v.number != null ? ` · No.${v.number}` : ''}</div>
    <h2>{v.name}</h2>
    <div class="meta">{v.age}세 은퇴 · 마지막 소속 {v.lastClub}</div>
  </div>
  <div class="ovr"><div class="n">{v.score}</div><div class="l">LEGEND</div></div>
  <div class="foot"><span class="pill role-주전">{legendTitle(v.score)}</span><span class="pill">최고 OVR {v.peak}</span></div>
</section>
<section class="card stack">
  <div class="eyebrow">Career Highlights</div>
  <div class="totals">
    <div><b>{t ? t.p : v.totals.apps}</b><span>경기</span></div>
    {#if back && t}
      <div><b>{t.cs}</b><span>무실점</span></div>
      <div><b>{t.g + t.a}</b><span>공격P</span></div>
    {:else}
      <div><b>{t ? t.g : v.totals.goals}</b><span>골</span></div>
      <div><b>{t ? t.a : v.totals.assists}</b><span>도움</span></div>
    {/if}
    <div><b>{d ? d.nat.caps : v.totals.caps}</b><span>A매치</span></div>
  </div>
  {#if d}
    <p>{d.career.length}시즌 동안 {clubCount}개 팀에서 뛰며 트로피 {d.trophies.length}개, 개인상 {d.awards.length}개를 들어 올렸습니다.</p>
    <p class="muted" style="font-size:12px">레전드 점수 = 포지션별 기여(공격수·미드필더는 골·도움, 수비수·골키퍼는 무실점 중심) + 출전 · 우승 · 개인상 · A매치 · 최고 OVR · 발롱도르/월드컵 보너스</p>
  {:else}
    <p>트로피 {v.totals.trophies}개, 개인상 {v.totals.awards}개를 들어 올렸습니다.</p>
    <p class="muted" style="font-size:12px">시즌별 상세 기록이 없는 예전 기록이라 요약만 보여 드립니다.</p>
  {/if}
</section>

{#if d && breakdown}
  <section class="card stack">
    <div><div class="eyebrow">Score Breakdown</div><h2>레전드 점수 구성</h2></div>
    <div class="legend-break">
      {#each breakdown.items as it (it.key)}
        <div class="legend-break-row">
          <span>{it.label}</span><b>{Math.round(it.value)}</b>
        </div>
        <div class="legend-bar"><i style="width:{Math.round((Math.abs(it.value) / maxAbs) * 100)}%"></i></div>
      {/each}
    </div>
  </section>

  {#if bests.length}
    <section class="card stack">
      <div><div class="eyebrow">Personal Bests</div><h2>개인 최고 기록</h2></div>
      <div class="pb-grid">
        {#each bests as b (b.key)}
          <div class="pb-item"><b>{b.key === 'rating' || b.key === 'ovr' ? b.value.toFixed(b.key === 'rating' ? 2 : 0) : b.value}</b><span>{b.label} · {b.year} ({b.age}세)</span></div>
        {/each}
      </div>
    </section>
  {/if}

  {#if prime.length}
    <section class="card stack">
      <div><div class="eyebrow">Prime</div><h2>전성기 {prime.length}시즌</h2></div>
      {#each prime as r, i (i)}
        <div class="trophy"><span class="y">{r.year}</span><div><b>{r.club} · {r.league}</b><span class="muted" style="font-size:12px">{r.apps}경기 {r.goals}골 {r.assists}도움 · 평점 {r.rating ? r.rating.toFixed(2) : '-'}</span></div></div>
      {/each}
    </section>
  {/if}

  {#if best3.length}
    <section class="card stack">
      <div><div class="eyebrow">Best Seasons</div><h2>베스트 시즌 TOP {best3.length}</h2></div>
      {#each best3 as r, i (i)}
        <div class="trophy"><span class="y">{seasonLabelOf(r)}</span><div><b>{r.club}</b><span class="muted" style="font-size:12px">{r.apps}경기 {r.goals}골 {r.assists}도움{r.honors.length ? ` · ${r.honors.join(', ')}` : ''}</span></div></div>
      {/each}
    </section>
  {/if}

  {#if timeline.length}
    <section class="card">
      <div class="eyebrow">Timeline</div>
      <h2 style="margin-bottom:4px">연도별 커리어</h2>
      {#each timeline as row (row.year + row.club)}
        <div class="timeline-row">
          <span class="y">{row.year}</span>
          <div>
            {row.summary}
            {#if row.ch.length}<div style="margin-top:2px">{#each row.ch as k (k)}<span class="badge-ch" style="margin-right:4px">CH</span>{/each}</div>{/if}
          </div>
        </div>
      {/each}
    </section>
  {/if}

  <TrophyTab s={d} />
  <CareerTab s={d} />
{/if}
