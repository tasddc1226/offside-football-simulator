<script lang="ts" module>
  /** 마지막으로 안내 스크롤을 돈 리포트 — 탭을 오가며 다시 마운트돼도 같은 리포트로 또 돌지 않는다. */
  let touredKey = 0;
</script>

<script lang="ts">
  // ui.ts seasonTab()/compsCard()/storiesCard()/meter() 포트 (224~259줄, 340~345줄, 671~684줄)
  // T-11-025 순서: 방금 끝난 구간 리포트 → 다음 구간 준비(컨디션·훈련·자기 투자) → 시즌 현황(진행 막대·누적 기록·
  // 순위표·대회) → 스토리 → 최근 소식 → 버튼. 버튼은 고정 바 없이 탭 맨 아래 한 자리에 둔다 — 이벤트·시즌 결산이 대기 중이면
  // 그걸 열고, 아니면 구간을 진행한다. 결과와 훈련 선택을 지나야 누를 수 있다. 리포트와 겹치는 숫자·소식은 다시 그리지 않는다.
  import { PHASES, LAST_PHASE } from '@offside/game/data';
  import { roundRange, leagueOf, blockMatches, TRAININGS, trainingLabel, trainingCard, trainingHelp, INVESTS, investCard, investHelp, investDef, fmtMoney, STORIES, turnNo } from '@offside/game/engine';
  import { eventById } from '@offside/game/events-data';
  import type { GameState } from '@offside/game/types';
  import { save } from '../helpers.js';
  import { seasonLabel } from '@offside/app-core/career';
  import { appState } from '../state.svelte.js';
  import { advance, nextPending } from '../actions.js';
  import { buzz, dur } from '../motion.js';
  import PhaseReport from './PhaseReport.svelte';
  import LeagueTable from './LeagueTable.svelte';

  const { s }: { s: GameState } = $props();

  const S = $derived(s.season);
  const avg = $derived(S.apps ? (S.ratingSum / S.apps).toFixed(2) : '-');
  const phase = $derived(Math.min(s.phase, LAST_PHASE));
  const label = $derived(phase === 0 ? '프리시즌' : `${PHASES[phase]} · ${roundRange(s, phase)}`);
  const lastCol = $derived((s.pos === 'GK' || s.pos === 'DF' ? ['무실점', S.cs] : ['도움', S.assists]) as [string, number]);
  const comps = $derived(s.season.comps || []);
  const activeStories = $derived(Object.entries(s.story || {}).filter(([, v]) => !v.done));
  const t = $derived(turnNo(s));
  const picked = $derived(TRAININGS.find((x) => x.id === s.training));
  const invest = $derived(investDef(s));
  const report = $derived(appState.report && appState.report.year === s.year ? appState.report : null);
  // 리포트가 개막 후 첫 구간이면 시즌 누적 = 구간 기록이라 누적 칸을 숨긴다. 개막 전(0경기)에도 숨긴다.
  const showTotals = $derived(S.played > 0 && !(report?.block && S.played === report.games.length));
  const left = $derived(leagueOf(s.leagueId).matches - S.played);
  const btnLabel = $derived(phase === 0 ? '프리시즌 훈련 진행' : `훈련 후 ${phase >= LAST_PHASE ? left : Math.min(blockMatches(s), left)}경기 진행`);
  // 최근 소식: 리포트에 이미 나온 구간 기록은 빼고 5줄만, '더 보기'로 14줄까지.
  const FEED_SHORT = 5;
  const FEED_LONG = 14;
  let feedAll = $state(false);
  const feed = $derived.by(() => {
    const hide = report ? `${report.year} ${PHASES[report.ph]}` : null;
    return s.log.filter((l) => l.t !== hide).slice(0, FEED_LONG);
  });

  const pendingLabel = $derived(s.pending?.type === 'event' ? '⚡ 이벤트 확인' : '시즌 결산 보기');

  // T-11-025 결과 안내 스크롤: 중계 시트를 닫고 새 리포트가 뜨면, 리포트를 읽을 시간을 준 뒤 아래 카드들을 차례로
  // 화면 위쪽에 맞춰 부드럽게 내려가며 잠깐씩 강조하고, 맨 아래 버튼에서 멈춘다. 훈련·자기 투자 카드에서는 시간 대신
  // 사용자가 하나를 고를 때까지 기다렸다가(고른 카드가 톡 튄다) 넘어가고, 순위표에서는 내 팀 순위 변동을 움직여 보여 준다.
  // 기다리는 카드 밖의 단계에서 사용자가 손대면(휠·터치·클릭·키) 바로 그만둔다. 감속 모션·업무 모드에서는 돌지 않는다.
  type Gate = 'train' | 'invest';
  const TOUR: [string, number | Gate][] = [
    ['[data-report]', 2600],
    ['[data-prep]', 'train'],
    ['[data-invest-card]', 'invest'],
    ['[data-season-status]', 1600],
    ['[data-stories]', 1000],
    ['[data-feed]', 1000],
    ['.advance-go', 1400],
  ];
  const PICK_MS = 650;
  const RANK_DELAY = 500;
  const RANK_MS = 1000;
  let tourWait = $state<Gate | null>(null);
  let onPick: ((g: Gate, btn: HTMLElement) => void) | null = null;
  let table = $state<ReturnType<typeof LeagueTable>>();
  $effect(() => {
    const k = report?.key;
    if (!k || k === touredKey) return;
    touredKey = k;
    if (!dur(1)) return;
    return tour();
  });

  function tour(): () => void {
    const timers: number[] = [];
    const later = (fn: () => void, ms: number) => void timers.push(window.setTimeout(fn, ms));
    let lit: HTMLElement | null = null;
    const light = (el: HTMLElement | null) => {
      if (lit) delete lit.dataset.tourSpot;
      lit = el;
      if (el) el.dataset.tourSpot = '';
    };
    const evs = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;
    // 고르기를 기다리는 동안에는 스크롤·탭으로 카드를 살펴볼 수 있어야 하니 멈추지 않는다.
    const onUser = () => void (tourWait || stop());
    const stop = () => {
      timers.forEach(clearTimeout);
      light(null);
      tourWait = null;
      onPick = null;
      for (const e of evs) removeEventListener(e, onUser, true);
    };
    for (const e of evs) addEventListener(e, onUser, { capture: true, passive: true });
    const steps = TOUR.map(([sel, wait]) => [document.querySelector<HTMLElement>(sel), wait] as const).filter(([el]) => el);
    const go = (i: number) => {
      if (i >= steps.length) return stop();
      const [el, wait] = steps[i]!;
      if (i) {
        const last = i === steps.length - 1;
        const head = document.querySelector<HTMLElement>('.topbar')?.offsetHeight ?? 0;
        const box = el!.getBoundingClientRect();
        let y = last ? document.documentElement.scrollHeight : box.top + scrollY - head - 12;
        // 고르기를 기다리는 카드가 화면보다 길면 선택지·설명이 있는 아래쪽이 보이게 바닥에 맞춘다.
        if (typeof wait !== 'number') {
          const foot = document.querySelector<HTMLElement>('.tabs')?.offsetHeight ?? 0;
          y = Math.max(y, box.bottom + scrollY - (innerHeight - foot - 12));
        }
        scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
        if (last) el!.querySelector('button')?.focus({ preventScroll: true });
      }
      light(el);
      if (typeof wait !== 'number') {
        tourWait = wait;
        onPick = (g, btn) => {
          if (g !== wait) return;
          tourWait = null;
          onPick = null;
          btn.dataset.picked = '';
          later(() => {
            delete btn.dataset.picked;
            go(i + 1);
          }, PICK_MS);
        };
        return;
      }
      let ms = wait;
      if (el!.hasAttribute('data-season-status') && report && report.rank.before !== report.rank.after) {
        later(() => table?.playRank(report.rank.before), RANK_DELAY);
        ms += RANK_MS;
      }
      later(() => go(i + 1), ms);
    };
    go(0);
    return stop;
  }

  function onAdvance() {
    buzz();
    void advance();
  }

  function onPending() {
    buzz();
    nextPending();
  }

  function meterCls(v: number, badAt: number, warnAt: number): string {
    return v < badAt ? 'bad' : v < warnAt ? 'warn' : '';
  }

  function setTraining(id: string, btn: HTMLElement) {
    s.training = id;
    save();
    onPick?.('train', btn);
  }

  function setInvest(id: string, btn: HTMLElement) {
    s.invest = id;
    save();
    onPick?.('invest', btn);
  }

  function waitText(k: string): string {
    const c = (s.chains || []).find((x) => {
      const e = eventById(x.id);
      return e && e.story === k;
    });
    if (!c) return '';
    return c.at <= t ? '곧 이어짐' : `약 ${c.at - t}구간 후`;
  }
</script>

{#if report}
  {#key report.key}
    <PhaseReport r={report} />
  {/key}
{/if}

<!-- 훈련·자기 투자 카드 공통 내용. T-11-025 카드에는 무엇이 오르는지(첫 효과)와 눈여겨볼 한 가지(주력·비용 등)만 두고,
     컨디션 소모 같은 나머지 효과와 자세한 설명은 고른 카드의 설명 칸에서만 보여 준다. -->
{#snippet optBody(label: string, c: { effect: string[]; tag: string })}
  <b>{label}</b><small>{c.effect[0]}</small>{#if c.tag}<small class="train-tag">{c.tag}</small>{/if}
{/snippet}
{#snippet helpBody(title: string, c: { effect: string[] }, body: string)}
  <b>{title} <span class="muted">· {c.effect.join(' · ')}</span></b>
  <p>{body}</p>
{/snippet}

<section class="card stack" data-prep>
  <div><div class="eyebrow">Next · {label}</div><h2>다음 구간 준비</h2></div>
  <div class="meters">
    <div class="meter"><span>컨디션</span><div class="bar"><i class={meterCls(s.cond, 40, 65)} style="width:{Math.round(s.cond)}%"></i></div><span class="v">{Math.round(s.cond)}</span></div>
    <div class="meter"><span>사기</span><div class="bar"><i class={meterCls(s.morale, 40, 60)} style="width:{Math.round(s.morale)}%"></i></div><span class="v">{Math.round(s.morale)}</span></div>
    <div class="meter"><span>인기</span><div class="bar"><i class="acc" style="width:{Math.min(100, Math.round(s.fame))}%"></i></div><span class="v">{Math.round(s.fame)}</span></div>
  </div>
  <h3 class="sub-title">훈련 방향</h3>
  {#if tourWait === 'train'}<p class="tour-hint" aria-live="polite">이번 구간 훈련을 고르면 다음으로 넘어가요</p>{/if}
  <div class="train">
    {#each TRAININGS as tr (tr.id)}
      {@const c = trainingCard(s, tr)}
      <button class="opt" data-train={tr.id} aria-pressed={s.training === tr.id} onclick={(e) => setTraining(tr.id, e.currentTarget)}>
        {@render optBody(trainingLabel(s, tr), c)}
      </button>
    {/each}
  </div>
  {#if picked}
    <div class="train-help" data-train-help aria-live="polite">
      {@render helpBody(trainingLabel(s, picked), trainingCard(s, picked), trainingHelp(s, picked))}
    </div>
  {/if}
</section>

<section class="card stack" data-invest-card>
  <div class="row" style="justify-content:space-between">
    <div><div class="eyebrow">Invest</div><h2>자기 투자</h2></div>
    <span class="pill" data-invest-money>보유 {fmtMoney(s.money)}원</span>
  </div>
  {#if tourWait === 'invest'}<p class="tour-hint" aria-live="polite">투자를 고르면 넘어가요 · 아끼려면 투자 안 함</p>{/if}
  <div class="train">
    {#each INVESTS as d (d.id)}
      {@const c = investCard(s, d)}
      <button class="opt" data-invest={d.id} aria-pressed={invest.id === d.id} disabled={!c.affordable} onclick={(e) => setInvest(d.id, e.currentTarget)}>
        {@render optBody(d.label, c)}
      </button>
    {/each}
  </div>
  <div class="train-help" data-invest-help aria-live="polite">
    {@render helpBody(invest.label, investCard(s, invest), investHelp(s, invest))}
  </div>
</section>

<section class="card stack" data-season-status>
  <div>
    <div class="eyebrow">{seasonLabel(s)} Season</div>
    <h2>{label}</h2>
    <div class="track">
      {#each [0, 1, 2] as i (i)}
        <div class={i < phase ? 'done' : i === phase ? 'now' : ''}></div>
      {/each}
    </div>
    <div class="track-lbl">
      {#each ['프리시즌', '전반기', '후반기'] as tl (tl)}
        <span>{tl}</span>
      {/each}
    </div>
  </div>
  {#if showTotals}
    <p class="muted fs-sm" data-season-totals>시즌 누적 · {S.w}승 {S.d}무 {S.l}패 · 출전 {S.apps} · {S.goals}골 · {lastCol[0]} {lastCol[1]} · 평점 {avg}</p>
  {/if}
  <LeagueTable {s} bind:this={table} />
  {#if comps.length}
    <div>
      <h3 class="sub-title" style="margin-bottom:2px">이번 시즌 대회</h3>
      {#each comps as c (c.name)}
        <div class="story-row">
          <b>{c.name}</b>
          <span class="muted">{c.stage || (c.type === 'super' ? '개막 전 단판' : '1구간 시작')}{c.alive && c.stage ? ' · 진행 중' : ''}</span>
          <span class="muted">{c.apps}경기 {c.g}골</span>
        </div>
      {/each}
    </div>
  {/if}
</section>

{#if activeStories.length}
  <section class="card" data-stories>
    <div class="eyebrow">Storylines</div>
    <h2 style="margin-bottom:6px">진행 중인 스토리</h2>
    {#each activeStories as [k, v] (k)}
      <div class="story-row">
        <b>{STORIES[k]!.name}</b>
        <span class="dots">
          {#each Array.from({ length: STORIES[k]!.total }) as _, i (i)}
            <i class={i < v.stage ? 'on' : ''}></i>
          {/each}
        </span>
        <span class="muted">{waitText(k)}</span>
      </div>
    {/each}
  </section>
{/if}

{#if feed.length}
  <section class="card" data-feed>
    <div class="eyebrow">Timeline</div>
    <h2 style="margin-bottom:6px">최근 소식</h2>
    <div class="feed">
      {#each feedAll ? feed : feed.slice(0, FEED_SHORT) as l, i (i)}
        <div><time>{l.t}</time><span class={l.kind}>{l.text}</span></div>
      {/each}
    </div>
    {#if feed.length > FEED_SHORT}
      <button class="icon-btn" style="margin-top:8px" data-act="feed-more" aria-expanded={feedAll} onclick={() => (feedAll = !feedAll)}>{feedAll ? '접기' : '더 보기'}</button>
    {/if}
  </section>
{/if}

<div class="advance-go">
  {#if s.pending}
    <button class="btn btn-block btn-accent" data-act="resume" onclick={onPending}>{pendingLabel} →</button>
  {:else}
    <p class="muted fs-sm">훈련 <b>{picked ? trainingLabel(s, picked) : '-'}</b> · 자기 투자 <b>{invest.label}</b></p>
    <button class="btn btn-block btn-primary" data-act="advance" onclick={onAdvance}>{btnLabel} →</button>
  {/if}
</div>
