<script lang="ts">
  // T-10-024: 방금 끝난 구간 결과를 시즌 탭 맨 위에서 순서대로 채워 보여 준다 — 경기 결과 점이 하나씩
  // 켜지고, 숫자가 올라가고, 순위 변화·하이라이트·능력치 변화가 이어서 나타난다. 감속 모션이면 즉시.
  import { onMount } from 'svelte';
  import { Tween } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import Chips from '../sheets/Chips.svelte';
  import { dur } from '../motion.js';
  import type { PhaseReport } from '../sheets/types.js';

  const { r }: { r: PhaseReport } = $props();
  const RES = { W: '승', D: '무', L: '패' } as const;
  const DOT_MS = 60;
  // 점이 다 켜진 뒤에 다음 요소가 나오도록 지연을 잡는다.
  const afterDots = $derived(dur(Math.min(r.games.length * DOT_MS, 1200) + 150));
  const b = $derived(r.block);
  const rankDelta = $derived(r.rank.before != null && r.rank.after != null ? r.rank.before - r.rank.after : 0);

  // 숫자는 0에서 카운트업한다. 카드는 리포트마다 {#key}로 새로 마운트되므로 마운트 때 한 번만 목표를 준다.
  const tween = () => new Tween(0, { duration: dur(900), easing: cubicOut });
  const t = { w: tween(), d: tween(), l: tween(), apps: tween(), goals: tween(), col: tween(), rating: tween() };
  onMount(() => {
    const x = r.block;
    if (!x) return;
    void Promise.all([
      t.w.set(x.w), t.d.set(x.d), t.l.set(x.l), t.apps.set(x.apps), t.goals.set(x.goals),
      t.col.set(r.back ? x.cs : x.assists), t.rating.set(x.rating ? Number(x.rating) : 0),
    ]);
  });
  const tally = $derived([
    { l: '출전', v: t.apps.current.toFixed(0) },
    { l: '골', v: t.goals.current.toFixed(0) },
    { l: r.back ? '무실점' : '도움', v: t.col.current.toFixed(0) },
    { l: '평점', v: b?.rating ? t.rating.current.toFixed(2) : '-' },
  ]);
</script>

<section class="card report" data-report aria-labelledby="report-title" style="--after:{afterDots}ms">
  <div class="row" style="justify-content:space-between;align-items:flex-start">
    <div>
      <div class="eyebrow">{r.eyebrow}</div>
      <h2 id="report-title">{r.title}</h2>
    </div>
    {#if r.rank.after}
      <span class="pill rp-rank" class:good={rankDelta > 0} class:bad={rankDelta < 0}>
        팀 {r.rank.after}위{#if rankDelta > 0} ▲{rankDelta}{:else if rankDelta < 0} ▼{-rankDelta}{/if}
      </span>
    {/if}
  </div>

  {#if b}
    <ol class="rp-dots" aria-label="경기 결과 {b.w}승 {b.d}무 {b.l}패">
      {#each r.games as m, i (m.key)}
        <li class="res {m.res}" style="--i:{i}" title="{m.rd}R {m.opp} {m.score}">{RES[m.res]}</li>
      {/each}
    </ol>
    <div class="rp-wdl num" aria-hidden="true">
      {Math.round(t.w.current)}<small>승</small> {Math.round(t.d.current)}<small>무</small> {Math.round(t.l.current)}<small>패</small>
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
    <p class="muted">예상 역할: <b>{r.role}</b></p>
  {/if}

  {#if r.comps.length}
    <div class="rp-later">
      <div class="eyebrow" style="margin-bottom:6px">컵 · 대륙 대회</div>
      {#each r.comps as c, i (i)}<p class={c.good ? 'hl' : 'muted'}>{c.t}</p>{/each}
    </div>
  {/if}
  {#each r.nat as x, i (i)}
    <div class="rp-later">
      {#if x.called}
        <div class="eyebrow" style="margin-bottom:6px">{x.name} · {x.comp}</div>
        {#each x.games as m, j (j)}<p class:hl={m.hl}>{m.line} <span class="muted">· {m.detail}</span></p>{/each}
      {:else}
        <div class="eyebrow" style="margin-bottom:6px">{x.name}</div>
        <p class="muted">이번 A매치 명단에서 제외됐습니다.</p>
      {/if}
    </div>
  {/each}

  <div class="rp-later">
    <div class="eyebrow" style="margin-bottom:6px">변화</div>
    {#if r.chips.length}<Chips chips={r.chips} pop />{:else}<p class="muted">큰 변화 없음</p>{/if}
  </div>

  {#if r.games.length}
    <details class="rp-games">
      <summary>경기별 기록 {r.games.length}경기</summary>
      <div class="ticker">
        {#each r.games as m (m.key)}
          <div>
            <span class="rd">{m.rd}R</span><span class="res {m.res}">{RES[m.res]}</span>
            <span
              >{m.opp} {m.score}
              <span class="muted"
                >· {#if m.mins}{m.mins}분{#if m.g} · <b>{m.g}골</b>{/if}{#if m.a} · {m.a}도움{/if} · {m.rating}{:else if m.inj}부상 결장{:else}출전 없음{/if}</span
              ></span
            >
          </div>
        {/each}
      </div>
    </details>
  {/if}
</section>
