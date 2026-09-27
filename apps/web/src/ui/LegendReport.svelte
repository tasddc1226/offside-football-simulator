<script lang="ts">
  // 은퇴 리포트 본문. 은퇴 직후 화면(Retired) · 명예의 전당 상세(Legend) · 공유 링크(SharedCareer)가 함께 쓴다 —
  // 진행 중 세이브(G)든 저장된 스냅샷이든 LegendView 하나로 그린다.
  // T-10-062: 정보 나열 대신 한 편의 엔딩 크레딧처럼 — 타이틀 → 통산 기록 → 클럽별 챕터(우승·이정표·이야기) →
  // 대표팀 → 우승·수상 롤 → 마지막 휘슬. 은퇴 직후(credits)에는 장면이 하나씩 올라오고 화면이 따라 내려간다
  // (사용자가 직접 스크롤하면 멈춘다). 점수 구성·시즌별 표는 맨 아래 '자세히 보기'에 접어 둔다.
  import { onMount, tick, type Snippet } from 'svelte';
  import { legendScoreBreakdown, legendTitle } from '../game/season.js';
  import { careerChapters, nationalEvents, honoursRoll, type ChapterEvent } from '../game/retirement-report.js';
  import { POS_LABEL } from '../game/pos-label.js';
  import { totals } from './format.js';
  import type { LegendView } from './state.svelte.js';
  import CareerTab from './tabs/CareerTab.svelte';
  import { titleById } from '../game/titles.js';
  import CountUp from './CountUp.svelte';
  import { motionOK } from './motion.js';

  // end: 리포트 맨 아래(크레딧이면 크레딧이 끝난 뒤 마지막으로 올라온다).
  const { v, credits = false, end }: { v: LegendView; credits?: boolean; end?: Snippet } = $props();
  const d = $derived(v.d);
  const back = $derived(v.pos === 'GK' || v.pos === 'DF');
  const t = $derived(d ? totals(d) : null);
  const main = $derived(titleById(v.title));

  const chapters = $derived(d ? careerChapters(d) : []);
  const national = $derived(d ? nationalEvents(d) : []);
  const caps = $derived(d ? d.nat.caps : v.totals.caps);
  const honours = $derived(d ? honoursRoll(d.trophies) : []);
  const awards = $derived(d ? honoursRoll(d.awards).slice(0, 8) : []);
  const span = $derived(d?.career.length ? `${d.career[0]!.year} — ${d.career.at(-1)!.year}` : null);
  const breakdown = $derived(d ? legendScoreBreakdown(d) : null);
  const maxAbs = $derived(breakdown ? Math.max(1, ...breakdown.items.map((i) => Math.abs(i.value))) : 1);

  /** 2036 · 37 · 39 — 첫 해만 네 자리. */
  const yearsOf = (ys: number[]) => ys.map((y, i) => (i ? String(y % 100).padStart(2, '0') : y)).join(' · ');
  const ICON: Record<ChapterEvent['kind'], string> = { trophy: '🏆', mile: '◆', story: '✦' };

  // ───────── 크레딧 연출 (T-10-029 → T-10-062) ─────────
  // 보여 줄 장면 순서. 내용이 없는 장면은 빠진다.
  const order = $derived([
    'player',
    'highlights',
    ...chapters.map((_, i) => `journey-${i}`),
    ...(caps > 0 || national.length ? ['national'] : []),
    ...(honours.length || awards.length ? ['honours'] : []),
    'finale',
  ]);
  // 연출 여부는 마운트 때 한 번 정한다.
  // svelte-ignore state_referenced_locally
  const playing = credits && motionOK;
  let step = $state(playing ? 0 : Infinity);
  const on = (key: string) => {
    const i = order.indexOf(key);
    return i >= 0 && step >= i;
  };
  const running = $derived(step < order.length);
  /** 장면 하나가 무대에 머무는 시간 — 숫자가 차오르고 줄이 다 올라올 만큼. */
  function hold(key: string | undefined): number {
    if (key === 'player') return 2400;
    if (key === 'highlights') return 1800;
    if (key === 'finale') return 2400;
    if (key?.startsWith('journey-')) {
      const c = chapters[Number(key.slice(8))];
      return Math.min(3400, 1300 + (c?.events.length ?? 0) * 300);
    }
    if (key === 'national') return Math.min(3000, 1400 + national.length * 250);
    if (key === 'honours') return Math.min(3800, 1200 + (honours.length + awards.length) * 160);
    return 1500;
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  let follow = true;
  let endEl = $state<HTMLElement | null>(null);
  function finish(skipped: boolean) {
    clearTimeout(timer);
    step = Infinity;
    // 끝까지 흘러갔으면 마지막(end)까지 따라 내려간다.
    if (!skipped && follow) void tick().then(() => endEl?.scrollIntoView({ behavior: 'smooth', block: 'end' }));
  }
  function next() {
    step++;
    if (step >= order.length) return finish(false);
    const key = order[step];
    void tick().then(() => {
      const el = document.querySelector<HTMLElement>(`[data-credit="${key}"]`);
      if (!follow || !el) return;
      // 긴 장면은 머리를, 짧은 장면은 꼬리를 화면에 맞춰 크레딧이 올라가듯 따라간다.
      el.scrollIntoView({ behavior: 'smooth', block: el.offsetHeight > window.innerHeight * 0.7 ? 'start' : 'end' });
    });
    timer = setTimeout(next, hold(key));
  }
  onMount(() => {
    if (!playing) return;
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

<article class="film" class:playing aria-label="{v.name} 커리어 결산">
  <section class="film-open" class:credit-in={playing} data-credit="player">
    <div class="film-kicker">Full Time{v.number != null ? ` · No.${v.number}` : ''}</div>
    <h1>{v.name}</h1>
    <div class="film-sub">{POS_LABEL[v.pos]}{span ? ` · ${span}` : ''} · {v.age}세 은퇴</div>
    <div class="film-score">
      <b><CountUp value={v.score} animate={playing} ms={1800} /></b><span>Legend Score</span>
    </div>
    <div class="film-pills" class:credit-late={playing}>
      <span class="pill pill-gold">{legendTitle(v.score)}</span>
      {#if main && main.cat !== 'legend'}<span class="pill" data-legend-title>‘{main.name}’</span>{/if}
      <span class="pill">최고 OVR {v.peak}</span>
    </div>
  </section>

  {#if on('highlights')}
    <section class="film-stats" class:credit-in={playing} data-credit="highlights" aria-label="통산 기록">
      <div><b><CountUp value={d ? d.career.length : 0} animate={playing} /></b><span>시즌</span></div>
      <div><b><CountUp value={t ? t.p : v.totals.apps} animate={playing} /></b><span>경기</span></div>
      {#if back && t}
        <div><b><CountUp value={t.cs} animate={playing} /></b><span>무실점</span></div>
        <div><b><CountUp value={t.g + t.a} animate={playing} /></b><span>공격P</span></div>
      {:else}
        <div><b><CountUp value={t ? t.g : v.totals.goals} animate={playing} /></b><span>골</span></div>
        <div><b><CountUp value={t ? t.a : v.totals.assists} animate={playing} /></b><span>도움</span></div>
      {/if}
      <div><b><CountUp value={caps} animate={playing} /></b><span>A매치</span></div>
      <div><b><CountUp value={v.totals.trophies} animate={playing} /></b><span>트로피</span></div>
    </section>
    {#if !d}<p class="film-note">시즌별 상세 기록이 없는 예전 기록이라 요약만 보여 드립니다.</p>{/if}
  {/if}

  {#if chapters.length && on('journey-0')}
    <header class="film-head" class:credit-in={playing}><div class="film-kicker">The Journey</div><h2>커리어 여정</h2></header>
  {/if}
  <ol class="film-rail">
    {#each chapters as c, i (i)}
      {#if on(`journey-${i}`)}
        <li class="chapter" class:credit-in={playing} data-credit="journey-{i}">
          <div class="ch-years">{c.from}{c.to !== c.from ? ` — ${c.to}` : ''}</div>
          <h3 class="ch-club">{c.club}</h3>
          <div class="ch-meta">{c.leagues.join(' → ')} · {c.ageFrom === c.ageTo ? `${c.ageFrom}세` : `${c.ageFrom}–${c.ageTo}세`} · {c.seasons}시즌</div>
          <div class="ch-stats">
            <span><b>{c.apps}</b>경기</span>
            {#if back}<span><b>{c.cs}</b>무실점</span>{/if}
            <span><b>{c.goals}</b>골</span><span><b>{c.assists}</b>도움</span>
          </div>
          {#if c.events.length}
            <ul class="ch-events">
              {#each c.events as e, j (j)}
                <li class="ev ev-{e.kind}" style="--i:{j}">
                  <span class="ev-ic" aria-hidden="true">{ICON[e.kind]}</span>
                  <span>{e.text}{#if e.years.length > 1} <b class="ev-n">×{e.years.length}</b>{/if}<span class="ev-y">{yearsOf(e.years)}</span></span>
                </li>
              {/each}
            </ul>
          {/if}
        </li>
      {/if}
    {/each}
  </ol>

  {#if on('national')}
    <section class="film-national" class:credit-in={playing} data-credit="national">
      <div class="film-kicker">For the Country</div>
      <h2>국가대표</h2>
      <div class="nat-caps"><b><CountUp value={caps} animate={playing} /></b> A매치</div>
      {#if national.length}
        <ul class="ch-events">
          {#each national as e, j (j)}
            <li class="ev ev-{e.kind}" style="--i:{j}">
              <span class="ev-ic" aria-hidden="true">{ICON[e.kind]}</span>
              <span>{e.text}<span class="ev-y">{e.year}</span></span>
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  {/if}

  {#if on('honours')}
    <section class="film-roll" class:credit-in={playing} data-credit="honours">
      {#if honours.length}
        <div class="film-kicker">Honours</div>
        <h2>우승 연혁</h2>
        {#each honours as h, j (h.name)}
          <div class="roll-line" style="--i:{j}"><b>{h.name}{h.years.length > 1 ? ` ×${h.years.length}` : ''}</b><span>{yearsOf(h.years)}</span></div>
        {/each}
      {/if}
      {#if awards.length}
        <div class="film-kicker roll-gap">Individual Awards</div>
        {#each awards as h, j (h.name)}
          <div class="roll-line" style="--i:{honours.length + j}"><b>{h.name}{h.years.length > 1 ? ` ×${h.years.length}` : ''}</b><span>{yearsOf(h.years)}</span></div>
        {/each}
      {/if}
    </section>
  {/if}

  {#if on('finale')}
    <section class="film-finale" class:credit-in={playing} data-credit="finale">
      <div class="film-kicker">The Final Whistle</div>
      <p>{v.age}세, {v.lastClub}에서<br />마지막 휘슬이 울렸습니다.</p>
      <h2>수고했어요, {v.name}</h2>
      <div class="film-end">Full Time</div>
    </section>
  {/if}
</article>

{#if !running}
  {#if d}
    <details class="card film-more" data-credit="career">
      <summary>시즌별 기록 · 레전드 점수 구성 자세히 보기</summary>
      {#if breakdown}
        <div class="stack">
          <h2>레전드 점수 구성</h2>
          <p class="muted fs-xs">포지션별 기여(공격수·미드필더는 골·도움, 수비수·골키퍼는 무실점 중심) + 출전 · 우승 · 개인상 · A매치 · 최고 OVR · 발롱도르/월드컵 보너스</p>
          <div class="legend-break">
            {#each breakdown.items as it, i (it.key)}
              <div class="legend-break-row"><span>{it.label}</span><b>{Math.round(it.value)}</b></div>
              <div class="legend-bar" style="--i:{i}"><i style="width:{Math.round((Math.abs(it.value) / maxAbs) * 100)}%"></i></div>
            {/each}
          </div>
        </div>
      {/if}
      <CareerTab s={d} />
    </details>
  {/if}
  {#if end}
    <div class="credit-wrap" class:credit-in={playing} data-credit="end" bind:this={endEl}>{@render end()}</div>
  {/if}
{/if}
