<script lang="ts">
  // ui.ts renderRetired() 포트 (398~414줄)
  import { legendScore, legendScoreBreakdown, legendTitle } from '../game/season.js';
  import { personalBests, primeSeasons, bestSeasons, careerTimeline } from '../game/retirement-report.js';
  import { appState } from './state.svelte.js';
  import { goHome, goNew } from './actions.js';
  import { totals, seasonLabelOf } from './format.js';
  import Topbar from './Topbar.svelte';
  import CareerTab from './tabs/CareerTab.svelte';
  import TrophyTab from './tabs/TrophyTab.svelte';

  const s = $derived(appState.G!);
  const t = $derived(totals(s));
  const e = $derived(appState.lastRetired || { score: legendScore(s) });
  const clubCount = $derived(new Set(s.career.map((r) => r.club)).size);

  // T-10-002 은퇴 리포트: legendScore()와 total이 항상 같은 breakdown, 전성기 3시즌, 베스트
  // 3시즌, 개인 기록, 연도별 타임라인. 전부 순수 파생值(s.career 기반) — 저장 포맷은 안 바뀐다.
  const breakdown = $derived(legendScoreBreakdown(s));
  const maxAbs = $derived(Math.max(1, ...breakdown.items.map((i) => Math.abs(i.value))));
  const prime = $derived(primeSeasons(s));
  const best3 = $derived(bestSeasons(s));
  const bests = $derived(personalBests(s));
  const timeline = $derived(careerTimeline(s).slice().reverse());
</script>

<div class="wrap">
  <Topbar />
  <section class="player">
    <div class="chalk"></div>
    <div>
      <div class="shirt">Full Time · No.{s.number}</div>
      <h2>{s.name}</h2>
      <div class="meta">{s.age}세 은퇴 · 마지막 소속 {s.club.name}</div>
    </div>
    <div class="ovr"><div class="n">{e.score}</div><div class="l">LEGEND</div></div>
    <div class="foot"><span class="pill role-주전">{legendTitle(e.score)}</span><span class="pill">최고 OVR {s.peak}</span></div>
  </section>
  <section class="card stack">
    <div class="eyebrow">Career Highlights</div>
    <div class="totals">
      <div><b>{t.p}</b><span>경기</span></div>
      {#if s.pos === 'GK' || s.pos === 'DF'}
        <div><b>{t.cs}</b><span>무실점</span></div>
        <div><b>{t.g + t.a}</b><span>공격P</span></div>
      {:else}
        <div><b>{t.g}</b><span>골</span></div>
        <div><b>{t.a}</b><span>도움</span></div>
      {/if}
      <div><b>{s.nat.caps}</b><span>A매치</span></div>
    </div>
    <p>{s.career.length}시즌 동안 {clubCount}개 팀에서 뛰며 트로피 {s.trophies.length}개, 개인상 {s.awards.length}개를 들어 올렸습니다.</p>
    <p class="muted" style="font-size:12px">레전드 점수 = 포지션별 기여(공격수·미드필더는 골·도움, 수비수·골키퍼는 무실점 중심) + 출전 · 우승 · 개인상 · A매치 · 최고 OVR · 발롱도르/월드컵 보너스</p>
  </section>

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

  <TrophyTab {s} />
  <CareerTab {s} />
  <button class="btn btn-primary btn-block" data-act="new" onclick={goNew}>새 커리어 킥오프 →</button>
  <button class="btn btn-block" data-act="home" onclick={goHome}>명예의 전당 보기</button>
</div>
