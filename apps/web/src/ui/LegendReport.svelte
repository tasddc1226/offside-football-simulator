<script lang="ts">
  // 은퇴 리포트 본문. 은퇴 직후 화면(Retired) · 명예의 전당 상세(Legend) · 공유 링크(SharedCareer)가 함께 쓴다 —
  // 진행 중 세이브(G)든 저장된 스냅샷이든 LegendView 하나로 그린다.
  // T-10-062: 정보 나열 대신 한 편의 엔딩 크레딧처럼 — 타이틀 → 통산 기록 → 클럽별 챕터(우승·이정표·이야기) →
  // 대표팀 → 우승·수상 롤 → 마지막 휘슬. 은퇴 직후든 다시 볼 때든 사용자가 스크롤해 내려가는 대로 장면이
  // 화면에 들어올 때 하나씩 올라온다. 점수 구성·시즌별 표는 맨 아래 '자세히 보기'에 접어 둔다.
  import type { Snippet } from 'svelte';
  import { legendScoreBreakdown, legendTitle } from '@offside/game/season';
  import { careerChapters, nationalEvents, honoursRoll, type ChapterEvent, type HonourLine } from '@offside/game/retirement-report';
  import { POS_LABEL } from '@offside/game/pos-label';
  import { potAchText } from '@offside/game/stats';
  import { fmtValue, seasonLabelOf, totals } from '@offside/app-core/format';
  import { peakValue, retireValue } from '@offside/contracts/market-value';
  import type { LegendView } from './state.svelte.js';
  import CareerTab from './tabs/CareerTab.svelte';
  import { titleById } from '@offside/game/titles';
  import { legendTitleOf } from './titles/legendTitle.svelte.js';
  import CountUp from './CountUp.svelte';
  import ValueChart from './ValueChart.svelte';
  import { motionOK } from './motion.js';
  import ClubMark from './ClubMark.svelte';
  import { rnOf } from './retiredNumber.svelte.js';
  import { EVENT_ICON as ICON, potVerdict as verdictOf, yearsOf } from '@offside/app-core/legendReport';

  // end: 리포트 맨 아래(다음 행동 버튼 등).
  const { v, end }: { v: LegendView; end?: Snippet } = $props();
  const d = $derived(v.d);
  const back = $derived(v.pos === 'GK' || v.pos === 'DF');
  const t = $derived(d ? totals(d) : null);
  const main = $derived(titleById(legendTitleOf(v.own?.id, v.title)));

  const chapters = $derived(d ? careerChapters(d) : []);
  const national = $derived(d ? nationalEvents(d) : []);
  const caps = $derived(d ? d.nat.caps : v.totals.caps);
  const honours = $derived(d ? honoursRoll(d.trophies) : []);
  const awards = $derived(d ? honoursRoll(d.awards).slice(0, 8) : []);
  const span = $derived(d?.career.length ? `${d.career[0]!.year} — ${d.career.at(-1)!.year}` : null);
  const breakdown = $derived(d ? legendScoreBreakdown(d) : null);
  // T-10-100 은퇴 가치: 가장 비쌌던 세 시즌 몸값 평균에 레전드 점수만큼 웃돈.
  const worth = $derived(d ? retireValue(d.career, v.score) : 0);
  const peakV = $derived(d ? peakValue(d.career) : null);
  const maxAbs = $derived(breakdown ? Math.max(1, ...breakdown.items.map((i) => Math.abs(i.value))) : 1);


  // ───────── 스크롤 크레딧 (T-10-029 → T-10-062) ─────────
  // 장면(data-credit)이 화면 아래쪽 15%를 넘어 들어오면 한 번 올라온다. 그 전에는 자리만 차지하고 숨어 있다
  // (opacity 대신 visibility — 전환 중간 프레임의 axe 명도 대비, T-10-003 참고). 감속 모션이면 처음부터 다 보인다.
  const playing = motionOK;
  /** 숫자를 세기 시작할 장면들(통산 기록·A매치)과, 스크롤 안내를 거둘 첫 장면(여정). */
  const seen = $state({ highlights: false, national: false, journey: false });
  // 장면 하나마다 관찰자를 두지 않고 하나로 본다. 들어온 장면은 credit-wait → credit-in으로 바꾸고 관찰을 멈춘다.
  const io = playing
    ? new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            const el = e.target as HTMLElement;
            el.classList.replace('credit-wait', 'credit-in');
            const key = el.dataset.credit;
            if (key === 'highlights' || key === 'national' || key === 'journey') seen[key] = true;
            io!.unobserve(el);
          }
        },
        { rootMargin: '0px 0px -15% 0px' },
      )
    : null;
  $effect(() => () => io?.disconnect());
  function reveal(el: HTMLElement) {
    if (!io) return;
    el.classList.add('credit-wait');
    io.observe(el);
    return { destroy: () => io.unobserve(el) };
  }
  let more = $state(false);

  // ───────── T-10-076 영구결번 ─────────
  // 세리머니는 첫 화면 번들을 늘리지 않게 따로 불러온다(LateCredits → RetiredNumberCredit). 결번 배지만 여기서 그린다.
  /** 내 선수는 이번 접속에서 받은 심사 결과(이름 공개 직후 등)를 먼저 본다. */
  const rnv = $derived.by(() => {
    const id = v.own?.id ?? v.shareId;
    return id ? rnOf(id, v.rn) : v.rn;
  });
  const rnGranted = $derived(rnv?.kind === 'granted' ? rnv : null);

  // T-10-073 은퇴 직후에만: 숨겨져 있던 실제 잠재력을 마지막 스카우트 평가와 견준다.
  const potVerdict = $derived(verdictOf(v.pot));
</script>

{#snippet event(e: ChapterEvent, j: number)}
  <li class="ev ev-{e.kind}" style="--i:{j}">
    <span class="ev-ic" aria-hidden="true">{ICON[e.kind]}</span>
    <span>{e.text}{#if e.years.length > 1} <b class="ev-n">×{e.years.length}</b>{/if}<span class="ev-y">{yearsOf(e.years)}</span></span>
  </li>
{/snippet}
{#snippet roll(list: HonourLine[], from: number)}
  {#each list as h, j (h.name)}
    <div class="roll-line" style="--i:{from + j}"><b>{h.name}{h.years.length > 1 ? ` ×${h.years.length}` : ''}</b><span>{yearsOf(h.years)}</span></div>
  {/each}
{/snippet}

<article class="film" class:playing aria-label="{v.name} 커리어 결산">
  <section class="film-open" class:credit-in={playing} data-credit="player">
    <div class="eyebrow film-kicker">Full Time{v.number != null ? ` · No.${v.number}` : ''}</div>
    <h1>{v.name}</h1>
    <div class="film-sub">{POS_LABEL[v.pos]}{span ? ` · ${span}` : ''} · {v.age}세 은퇴</div>
    <div class="film-score">
      <b><CountUp value={v.score} animate={playing} ms={1800} /></b><span>Legend Score</span>
    </div>
    {#if worth > 0}
      <div class="film-worth" class:credit-late={playing} data-legend-value>
        <span>은퇴 가치</span><b>{fmtValue(worth)}</b>
        {#if peakV}<small>최고 몸값 {fmtValue(peakV.value)} · {seasonLabelOf(peakV.row)} {peakV.row.club}</small>{/if}
      </div>
    {/if}
    <div class="film-pills" class:credit-late={playing}>
      <span class="pill pill-gold">{legendTitle(v.score)}</span>
      {#if main && main.cat !== 'legend'}<span class="pill" data-legend-title>‘{main.name}’</span>{/if}
      <span class="pill">최고 OVR {v.peak}</span>
      {#if rnGranted}<span class="pill pill-rn" data-legend-rn-pill title="{rnGranted.club} 영구결번 {rnGranted.number}번">👑 {rnGranted.club} 영결 {rnGranted.number}</span>{/if}
    </div>
    <!-- 통산 기록은 레전드 점수 바로 아래(첫 화면에서 한눈에). -->
    <section class="film-stats" data-credit="highlights" aria-label="통산 기록" use:reveal>
      <div><b><CountUp value={d ? d.career.length : 0} animate={playing} run={seen.highlights} /></b><span>시즌</span></div>
      <div><b><CountUp value={t ? t.p : v.totals.apps} animate={playing} run={seen.highlights} /></b><span>경기</span></div>
      {#if back && t}
        <div><b><CountUp value={t.cs} animate={playing} run={seen.highlights} /></b><span>무실점</span></div>
        <div><b><CountUp value={t.g + t.a} animate={playing} run={seen.highlights} /></b><span>공격P</span></div>
      {:else}
        <div><b><CountUp value={t ? t.g : v.totals.goals} animate={playing} run={seen.highlights} /></b><span>골</span></div>
        <div><b><CountUp value={t ? t.a : v.totals.assists} animate={playing} run={seen.highlights} /></b><span>도움</span></div>
      {/if}
      <div><b><CountUp value={caps} animate={playing} run={seen.highlights} /></b><span>A매치</span></div>
      <div><b><CountUp value={v.totals.trophies} animate={playing} run={seen.highlights} /></b><span>트로피</span></div>
    </section>
    {#if !d}<p class="film-note">시즌별 상세 기록이 없는 예전 기록이라 요약만 보여 드립니다.</p>{/if}
    {#if playing && !seen.journey}<div class="film-cue" aria-hidden="true">스크롤해서 커리어 돌아보기<i>↓</i></div>{/if}
  </section>

  {#if chapters.length}
    <header class="film-head" data-credit="journey" use:reveal>
      <div class="eyebrow film-kicker">The Journey</div>
      <h2>커리어 여정</h2>
    </header>
    <ol class="film-rail">
      {#each chapters as c, i (i)}
        <li class="chapter" data-credit="journey-{i}" use:reveal>
          <div class="ch-years">{c.from}{c.to !== c.from ? ` — ${c.to}` : ''}</div>
          <h3 class="ch-club"><ClubMark name={c.club} id={c.clubId} size={24} /> {c.club}</h3>
          <div class="ch-meta">{c.leagues.join(' → ')} · {c.ageFrom === c.ageTo ? `${c.ageFrom}세` : `${c.ageFrom}–${c.ageTo}세`} · {c.seasons}시즌</div>
          <div class="ch-stats">
            <span><b>{c.apps}</b>경기</span>
            {#if back}<span><b>{c.cs}</b>무실점</span>{/if}
            <span><b>{c.goals}</b>골</span><span><b>{c.assists}</b>도움</span>
          </div>
          {#if c.events.length}
            <ul class="ch-events">
              {#each c.events as e, j (j)}{@render event(e, j)}{/each}
            </ul>
          {/if}
        </li>
      {/each}
    </ol>
  {/if}

  <!-- T-10-106 여정 다음에 몸값 흐름: 클럽을 옮겨 다닌 이야기를 숫자 하나의 곡선으로 되짚는다. -->
  {#if d && peakV}
    <section class="film-value" data-credit="value" use:reveal>
      <div class="eyebrow film-kicker">Market Value</div>
      <h2>몸값 흐름</h2>
      <ValueChart rows={d.career} />
    </section>
  {/if}

  {#if caps > 0 || national.length}
    <section class="film-national" data-credit="national" use:reveal>
      <div class="eyebrow film-kicker">For the Country</div>
      <h2>국가대표</h2>
      <div class="nat-caps"><b><CountUp value={caps} animate={playing} run={seen.national} /></b> A매치</div>
      {#if d?.nat.goals !== undefined}
        <div class="nat-ga" data-nat-ga>{d.nat.goals}골 · {d.nat.assists ?? 0}도움</div>
      {/if}
      {#if national.length}
        <ul class="ch-events">
          {#each national as e, j (j)}{@render event(e, j)}{/each}
        </ul>
      {/if}
    </section>
  {/if}

  {#if honours.length || awards.length}
    <section class="film-roll" data-credit="honours" use:reveal>
      {#if honours.length}
        <div class="eyebrow film-kicker">Honours</div>
        <h2>우승 연혁</h2>
        {@render roll(honours, 0)}
      {/if}
      {#if awards.length}
        <div class="eyebrow film-kicker roll-gap">Individual Awards</div>
        {@render roll(awards, honours.length)}
      {/if}
    </section>
  {/if}

  {#if v.pot}
    <section class="film-pot" data-credit="pot" data-legend-pot use:reveal>
      <div class="eyebrow film-kicker">Scout Report</div>
      <p>끝까지 숨겨져 있던 잠재력</p>
      <b>{v.pot.real}</b>
      <p>{potVerdict}</p>
      <div class="film-pot-ach" data-legend-ach>
        <span>잠재력 달성도</span><strong>{v.pot.ach}%</strong>
        <small>최고 OVR {v.peak} · {potAchText(v.pot.ach)}</small>
      </div>
    </section>
  {/if}
  {#if d || rnGranted}
    {#await import('./LateCredits.svelte') then { default: Credit }}
      <Credit {v} rn={rnv} {reveal} />
    {/await}
  {/if}
  <section class="film-finale" data-credit="finale" use:reveal>
    <ClubMark name={v.lastClub} id={v.lastClubId} size={56} />
    <div class="eyebrow film-kicker">The Final Whistle</div>
    <p>{v.age}세, {v.lastClub}에서<br />마지막 휘슬이 울렸습니다.</p>
    <h2>수고했어요, {v.name}</h2>
    <div class="film-end">Full Time</div>
  </section>
</article>

{#if d}
  <!-- 펼칠 때만 그린다(시즌별 표가 길다). -->
  <details class="card film-more" data-credit="career" bind:open={more}>
    <summary>시즌별 기록 · 레전드 점수 구성 자세히 보기</summary>
    {#if more && breakdown}
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
    {#if more}<CareerTab s={d} chart={false} />{/if}
  </details>
{/if}
{#if end}
  <div class="credit-wrap">{@render end()}</div>
{/if}
