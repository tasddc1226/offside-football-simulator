<script lang="ts">
  import { tn } from '@offside/game/i18n/names';
  // T-10-024: 방금 끝난 구간 결과를 시즌 탭 맨 위에서 순서대로 채워 보여 준다 — 경기 결과 점이 하나씩
  // 켜지고, 숫자가 올라가고, 순위 변화·하이라이트·능력치 변화가 이어서 나타난다. 감속 모션이면 즉시.
  import { onMount } from 'svelte';
  import { Tween } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import Chips from '../sheets/Chips.svelte';
  import NewTitles from '../titles/NewTitles.svelte';
  import { dur } from '../motion.js';
  import TickerLine from '../sheets/TickerLine.svelte';
  import { RES_LABEL as RES, type PhaseReport } from '@offside/app-core/sheets';
  import { gameReportText as L } from '@offside/app-core/i18n/ko/gameReport';

  const { r }: { r: PhaseReport } = $props();
  const DOT_MS = 60;
  // 점이 다 켜진 뒤에 다음 요소가 나오도록 지연을 잡는다.
  const afterDots = $derived(dur(Math.min(r.games.length * DOT_MS, 1200) + 150));
  const rankDelta = $derived(r.rank.before != null && r.rank.after != null ? r.rank.before - r.rank.after : 0);

  // 숫자는 0에서 카운트업한다. 카드는 리포트마다 {#key}로 새로 마운트되므로 마운트 때 한 번만 목표를 준다.
  const tween = () => new Tween(0, { duration: dur(900), easing: cubicOut });
  const t = { w: tween(), d: tween(), l: tween(), apps: tween(), goals: tween(), col: tween(), rating: tween() };
  // 리포트는 {#key}로 매번 새로 마운트되므로 r은 이 카드가 살아 있는 동안 바뀌지 않는다.
  const b = $derived(r.block);
  onMount(() => {
    const x = b;
    if (!x) return;
    void Promise.all([
      t.w.set(x.w), t.d.set(x.d), t.l.set(x.l), t.apps.set(x.apps), t.goals.set(x.goals),
      t.col.set(r.back ? x.cs : x.assists), t.rating.set(x.rating ? Number(x.rating) : 0),
    ]);
  });
  const tally = $derived([
    { l: L.tallyApps, v: t.apps.current.toFixed(0) },
    { l: L.tallyGoals, v: t.goals.current.toFixed(0) },
    { l: r.back ? L.tallyCs : L.tallyAssists, v: t.col.current.toFixed(0) },
    { l: L.tallyRating, v: b?.rating ? t.rating.current.toFixed(2) : '-' },
  ]);
</script>

<section class="card report" data-report data-tour="report" aria-labelledby="report-title" style="--after:{afterDots}ms">
  <div class="row" style="justify-content:space-between;align-items:flex-start">
    <div>
      <div class="eyebrow">{r.eyebrow}</div>
      <h2 id="report-title">{r.title}</h2>
    </div>
    {#if r.rank.after}
      <span class="pill rp-rank" class:good={rankDelta > 0} class:bad={rankDelta < 0}>
        {L.teamRank({ n: r.rank.after })}{#if rankDelta > 0} ▲{rankDelta}{:else if rankDelta < 0} ▼{-rankDelta}{/if}
      </span>
    {/if}
  </div>

  {#if b}
    <ol class="rp-dots" aria-label={L.dotsLabel({ w: b.w, d: b.d, l: b.l })}>
      {#each r.games as m, i (m.key)}
        <li class="res {m.res}" style="--i:{i}" title="{m.rd}R {m.opp} {m.score}">{RES[m.res]}</li>
      {/each}
    </ol>
    <div class="result-big rp-wdl num" aria-hidden="true">
      {Math.round(t.w.current)}<small>{L.win}</small> {Math.round(t.d.current)}<small>{L.draw}</small> {Math.round(t.l.current)}<small>{L.loss}</small>
    </div>
    <div class="tally">
      {#each tally as x (x.l)}
        <div><b>{x.v}</b><span>{x.l}</span></div>
      {/each}
    </div>
    {#if b.hl.length}
      <div class="rp-later stack" style="gap:6px">
        {#each b.hl as h, i (i)}<p class="hl">{h}</p>{/each}
      </div>
    {/if}
  {:else}
    <p class="muted">{L.expectedRole} <b>{tn(r.role)}</b></p>
  {/if}

  {#if r.comps.length}
    <div class="rp-later">
      <div class="eyebrow" style="margin-bottom:6px">{L.cups}</div>
      {#each r.comps as c, i (i)}<p class={c.good ? 'hl' : 'muted'}>{c.t}</p>{/each}
    </div>
  {/if}
  {#each r.nat as x, i (i)}
    <div class="rp-later">
      {#if x.called}
        <div class="eyebrow" style="margin-bottom:6px">{tn(x.name)} · {tn(x.comp)}</div>
        {#each x.games as m, j (j)}<p class:hl={m.hl}>{m.line} <span class="muted">· {m.detail}</span></p>{/each}
      {:else}
        <div class="eyebrow" style="margin-bottom:6px">{tn(x.name)}</div>
        <p class="muted">{L.notCalled}</p>
      {/if}
    </div>
  {/each}

  {#if r.titles.length}<div class="rp-later"><NewTitles titles={r.titles} pop /></div>{/if}

  <div class="rp-later">
    <div class="eyebrow" style="margin-bottom:6px">{L.changes}</div>
    {#if r.chips.length}<Chips chips={r.chips} pop />{:else}<p class="muted">{L.noChange}</p>{/if}
  </div>

  {#if r.games.length}
    <details class="rp-games">
      <summary>{L.gamesSummary({ n: r.games.length })}</summary>
      <div class="ticker">
        {#each r.games as m (m.key)}
          <TickerLine {m} />
        {/each}
      </div>
    </details>
  {/if}
</section>
