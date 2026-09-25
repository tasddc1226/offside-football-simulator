<script lang="ts">
  // 은퇴 리포트 본문(T-10-002에서 Retired.svelte에 있던 것). T-10-005부터 은퇴 직후 화면과 명예의 전당
  // 상세 화면이 함께 쓴다 — 진행 중 세이브(G)든 저장된 스냅샷이든 LegendView 하나로 그린다.
  // T-10-029: 은퇴 직후(credits)에는 영화 크레딧처럼 섹션이 하나씩 올라오고 숫자가 카운트업, 점수 막대가
  // 차오른다. 화면이 새 섹션을 따라 내려가고(사용자가 직접 스크롤하면 멈춘다), 건너뛰기로 한 번에 펼친다.
  import { onMount, tick } from 'svelte';
  import { legendScoreBreakdown, legendTitle } from '../game/season.js';
  import { personalBests, primeSeasons, bestSeasons, careerTimeline } from '../game/retirement-report.js';
  import { totals, seasonLabelOf } from './format.js';
  import type { LegendView } from './state.svelte.js';
  import CareerTab from './tabs/CareerTab.svelte';
  import TrophyTab from './tabs/TrophyTab.svelte';
  import TitleTag from './titles/TitleTag.svelte';
  import { titleById, type TitleDef } from '../game/titles.js';
  import CountUp from './CountUp.svelte';
  import { motionOK } from './motion.js';

  const {
    v,
    credits = false,
    ondone,
  }: { v: LegendView; credits?: boolean; ondone?: (skipped: boolean) => void } = $props();
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
  const main = $derived(titleById(v.title));
  // T-10-026 획득한 칭호(등급 높은 순). 칭호 도입 전 은퇴 기록엔 없다.
  const titles = $derived(
    (d?.titles ?? [])
      .map((e) => titleById(e.id))
      .filter((x): x is TitleDef => !!x)
      .sort((a, b) => b.rarity - a.rarity),
  );

  // ───────── 크레딧 연출 (T-10-029) ─────────
  // 보여 줄 섹션 순서. 내용이 없는 섹션은 빠진다.
  const order = $derived([
    'player',
    'highlights',
    ...(breakdown ? ['breakdown'] : []),
    ...(bests.length ? ['bests'] : []),
    ...(prime.length ? ['prime'] : []),
    ...(best3.length ? ['best3'] : []),
    ...(timeline.length ? ['timeline'] : []),
    ...(titles.length ? ['titles'] : []),
    ...(d ? ['trophies', 'career'] : []),
  ]);
  // 연출 여부는 마운트 때 한 번 정한다.
  // svelte-ignore state_referenced_locally
  const playing = credits && motionOK;
  let step = $state(playing ? 0 : Infinity);
  const on = (key: string) => step >= order.indexOf(key);
  const running = $derived(step < order.length);
  /** 섹션 하나가 무대에 머무는 시간 — 숫자·막대·줄이 다 차오를 만큼. */
  function hold(key: string | undefined): number {
    if (key === 'player') return 2000;
    if (key === 'highlights') return 1700;
    if (key === 'breakdown') return 1300 + (breakdown?.items.length ?? 0) * 90;
    if (key === 'timeline') return Math.min(3200, 1200 + timeline.length * 80);
    return 1300;
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  let follow = true;
  function finish(skipped: boolean) {
    clearTimeout(timer);
    step = Infinity;
    ondone?.(skipped);
  }
  function next() {
    step++;
    if (step >= order.length) return finish(false);
    const key = order[step];
    void tick().then(() => {
      const el = document.querySelector<HTMLElement>(`[data-credit="${key}"]`);
      if (!follow || !el) return;
      // 긴 섹션은 머리를, 짧은 섹션은 꼬리를 화면에 맞춰 크레딧이 올라가듯 따라간다.
      el.scrollIntoView({ behavior: 'smooth', block: el.offsetHeight > window.innerHeight * 0.7 ? 'start' : 'end' });
    });
    timer = setTimeout(next, hold(key));
  }
  onMount(() => {
    if (!playing) {
      if (credits) ondone?.(false);
      return;
    }
    const stopFollow = () => (follow = false);
    window.addEventListener('wheel', stopFollow, { passive: true });
    window.addEventListener('touchmove', stopFollow, { passive: true });
    timer = setTimeout(next, hold('player'));
    return () => {
      clearTimeout(timer);
      window.removeEventListener('wheel', stopFollow);
      window.removeEventListener('touchmove', stopFollow);
    };
  });
</script>

{#if running}
  <button class="credits-skip" data-act="credits-skip" onclick={() => finish(true)}>건너뛰기 ▸▸</button>
{/if}

<section class="player" class:credit-in={playing} data-credit="player">
  <div class="chalk"></div>
  <div>
    <div class="shirt">Full Time{v.number != null ? ` · No.${v.number}` : ''}</div>
    <h1>{v.name}</h1>
    <div class="meta">{v.age}세 은퇴 · 마지막 소속 {v.lastClub}</div>
  </div>
  <div class="ovr"><div class="n"><CountUp value={v.score} animate={playing} ms={1600} /></div><div class="l">LEGEND</div></div>
  <div class="foot" class:credit-late={playing}>
    <span class="pill role-주전">{legendTitle(v.score)}</span>
    {#if main && main.cat !== 'legend'}<span class="pill" data-legend-title>‘{main.name}’</span>{/if}
    <span class="pill">최고 OVR {v.peak}</span>
  </div>
</section>
{#if on('highlights')}
<section class="card stack" class:credit-in={playing} data-credit="highlights">
  <div class="eyebrow">Career Highlights</div>
  <div class="totals">
    <div><b><CountUp value={t ? t.p : v.totals.apps} animate={playing} /></b><span>경기</span></div>
    {#if back && t}
      <div><b><CountUp value={t.cs} animate={playing} /></b><span>무실점</span></div>
      <div><b><CountUp value={t.g + t.a} animate={playing} /></b><span>공격P</span></div>
    {:else}
      <div><b><CountUp value={t ? t.g : v.totals.goals} animate={playing} /></b><span>골</span></div>
      <div><b><CountUp value={t ? t.a : v.totals.assists} animate={playing} /></b><span>도움</span></div>
    {/if}
    <div><b><CountUp value={d ? d.nat.caps : v.totals.caps} animate={playing} /></b><span>A매치</span></div>
  </div>
  {#if d}
    <p>{d.career.length}시즌 동안 {clubCount}개 팀에서 뛰며 트로피 {d.trophies.length}개, 개인상 {d.awards.length}개를 들어 올렸습니다.</p>
    <p class="muted" style="font-size:12px">레전드 점수 = 포지션별 기여(공격수·미드필더는 골·도움, 수비수·골키퍼는 무실점 중심) + 출전 · 우승 · 개인상 · A매치 · 최고 OVR · 발롱도르/월드컵 보너스</p>
  {:else}
    <p>트로피 {v.totals.trophies}개, 개인상 {v.totals.awards}개를 들어 올렸습니다.</p>
    <p class="muted" style="font-size:12px">시즌별 상세 기록이 없는 예전 기록이라 요약만 보여 드립니다.</p>
  {/if}
</section>
{/if}

{#if d && breakdown}
  {#if on('breakdown')}
  <section class="card stack" class:credit-in={playing} data-credit="breakdown">
    <div><div class="eyebrow">Score Breakdown</div><h2>레전드 점수 구성</h2></div>
    <div class="legend-break">
      {#each breakdown.items as it, i (it.key)}
        <div class="legend-break-row">
          <span>{it.label}</span><b><CountUp value={Math.round(it.value)} animate={playing} ms={900} /></b>
        </div>
        <div class="legend-bar" style="--i:{i}"><i style="width:{Math.round((Math.abs(it.value) / maxAbs) * 100)}%"></i></div>
      {/each}
    </div>
  </section>
  {/if}

  {#if bests.length && on('bests')}
    <section class="card stack" class:credit-in={playing} data-credit="bests">
      <div><div class="eyebrow">Personal Bests</div><h2>개인 최고 기록</h2></div>
      <div class="pb-grid">
        {#each bests as b (b.key)}
          <div class="pb-item"><b>{b.key === 'rating' || b.key === 'ovr' ? b.value.toFixed(b.key === 'rating' ? 2 : 0) : b.value}</b><span>{b.label} · {b.year} ({b.age}세)</span></div>
        {/each}
      </div>
    </section>
  {/if}

  {#if prime.length && on('prime')}
    <section class="card stack" class:credit-in={playing} data-credit="prime">
      <div><div class="eyebrow">Prime</div><h2>전성기 {prime.length}시즌</h2></div>
      {#each prime as r, i (i)}
        <div class="trophy"><span class="y">{r.year}</span><div><b>{r.club} · {r.league}</b><span class="muted" style="font-size:12px">{r.apps}경기 {r.goals}골 {r.assists}도움 · 평점 {r.rating ? r.rating.toFixed(2) : '-'}</span></div></div>
      {/each}
    </section>
  {/if}

  {#if best3.length && on('best3')}
    <section class="card stack" class:credit-in={playing} data-credit="best3">
      <div><div class="eyebrow">Best Seasons</div><h2>베스트 시즌 TOP {best3.length}</h2></div>
      {#each best3 as r, i (i)}
        <div class="trophy"><span class="y">{seasonLabelOf(r)}</span><div><b>{r.club}</b><span class="muted" style="font-size:12px">{r.apps}경기 {r.goals}골 {r.assists}도움{r.honors.length ? ` · ${r.honors.join(', ')}` : ''}</span></div></div>
      {/each}
    </section>
  {/if}

  {#if timeline.length && on('timeline')}
    <section class="card" class:credit-in={playing} data-credit="timeline">
      <div class="eyebrow">Timeline</div>
      <h2 style="margin-bottom:4px">연도별 커리어</h2>
      {#each timeline as row, i (row.year + row.club)}
        <div class="timeline-row" style="--i:{i}">
          <span class="y">{row.year}</span>
          <div>
            {row.summary}
            {#if row.ch.length}<div style="margin-top:2px">{#each row.ch as k (k)}<span class="badge-ch" style="margin-right:4px">CH</span>{/each}</div>{/if}
          </div>
        </div>
      {/each}
    </section>
  {/if}

  {#if titles.length && on('titles')}
    <section class="card" class:credit-in={playing} data-credit="titles" data-legend-titles>
      <div class="eyebrow">Titles</div>
      <h2 style="margin-bottom:8px">획득한 칭호 {titles.length}개</h2>
      <div class="chips">{#each titles as x (x.id)}<TitleTag name={x.name} rarity={x.rarity} />{/each}</div>
    </section>
  {/if}
  {#if on('trophies')}<div class="credit-wrap" class:credit-in={playing} data-credit="trophies"><TrophyTab s={d} /></div>{/if}
  {#if on('career')}<div class="credit-wrap" class:credit-in={playing} data-credit="career"><CareerTab s={d} /></div>{/if}
{/if}
