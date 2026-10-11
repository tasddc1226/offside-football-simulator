<script lang="ts" module>
  /** 마지막으로 안내 스크롤을 돈 리포트 — 탭을 오가며 다시 마운트돼도 같은 리포트로 또 돌지 않는다. */
  let touredKey = 0;
  /** 순위 변동 연출을 이미 튼 리포트 — 안내든 직접 스크롤이든 한 리포트에 한 번만. */
  let rankedKey = 0;
</script>

<script lang="ts">
  import { appFormatText as W } from '@offside/app-core/i18n/ko/appFormat';
  import { tn } from '@offside/game/i18n/names';
  // ui.ts seasonTab()/compsCard()/storiesCard()/meter() 포트 (224~259줄, 340~345줄, 671~684줄)
  // T-11-025 순서: 방금 끝난 구간 리포트 → 다음 구간 준비(컨디션·훈련·자기 투자) → 시즌 현황(진행 막대·누적 기록·
  // 순위표·대회) → 스토리 → 최근 소식. 리포트와 겹치는 숫자·소식은 다시 그리지 않는다. T-11-036 진행·이벤트 확인 버튼은
  // 화면 아래 고정 바(Game.svelte)에 있다 — 탭 맨 아래에 두니 구간마다 끝까지 내려야 해 불편했다.
  import { coachFeedback } from '@offside/app-core/career-feedback';
  import { visibleCareerLog } from '@offside/app-core/potential-view';
  import { PHASES, LAST_PHASE } from '@offside/game/data';
  import { roundRange, logLabel, TRAININGS, trainingLabel, trainingCard, INVESTS, investCard, investCost, investName, investNote, investDef, plannedSpend, fmtMoney, STORIES, turnNo } from '@offside/game/engine';
  import { eventById } from '@offside/game/events-data';
  import type { GameState } from '@offside/game/types';
  import { save } from '../helpers.js';
  import { seasonLabel } from '@offside/app-core/career';
  import { RANK_SEEN_RATIO, RESULT_TOUR, rankBeforeOf, TOUR_PICK_MS, TOUR_RANK_DELAY, TOUR_RANK_MS, type TourGate } from '@offside/app-core/resultTour';
  import { appState } from '../state.svelte.js';
  import { dur } from '../motion.js';
  import PhaseReport from './PhaseReport.svelte';
  import LeagueTable from './LeagueTable.svelte';
  import Radar from '../Radar.svelte';
  import { gameSeasonText as L } from '@offside/app-core/i18n/ko/gameSeason';

  const { s }: { s: GameState } = $props();

  const coach = $derived(coachFeedback(s));
  const S = $derived(s.season);
  const avg = $derived(S.apps ? (S.ratingSum / S.apps).toFixed(2) : '-');
  const phase = $derived(Math.min(s.phase, LAST_PHASE));
  const label = $derived(phase === 0 ? L.preseason : `${tn(PHASES[phase] ?? '')} · ${roundRange(s, phase)}`);
  const lastCol = $derived((s.pos === 'GK' || s.pos === 'DF' ? [L.colCs, S.cs] : [L.colAssists, S.assists]) as [string, number]);
  const comps = $derived(s.season.comps || []);
  const activeStories = $derived(Object.entries(s.story || {}).filter(([, v]) => !v.done));
  const t = $derived(turnNo(s));
  const picked = $derived(TRAININGS.find((x) => x.id === s.training));
  const invest = $derived(investDef(s));
  const spend = $derived(plannedSpend(s));
  const report = $derived(appState.report && appState.report.year === s.year ? appState.report : null);
  // 리포트가 개막 후 첫 구간이면 시즌 누적 = 구간 기록이라 누적 칸을 숨긴다. 개막 전(0경기)에도 숨긴다.
  const showTotals = $derived(S.played > 0 && !(report?.block && S.played === report.games.length));
  // 최근 소식: 리포트에 이미 나온 구간 기록은 빼고 5줄만, '더 보기'로 14줄까지.
  const FEED_SHORT = 5;
  const FEED_LONG = 14;
  let feedAll = $state(false);
  const feed = $derived.by(() => {
    const hide = report ? logLabel(report.year, report.ph) : null;
    return visibleCareerLog(s.log).filter((l) => l.t !== hide).slice(0, FEED_LONG);
  });

  // T-11-025 결과 안내 스크롤(순서·시간은 app-core resultTour): 중계 시트를 닫고 새 리포트가 뜨면, 리포트를 읽을 시간을 준 뒤
  // 아래 카드들([data-tour])을 차례로 화면 위쪽에 맞춰 부드럽게 내려가며 잠깐씩 강조하고, 아래 고정 진행 바(Game.svelte)를 비추고 멈춘다. 훈련·자기
  // 투자 카드에서는 시간 대신 사용자가 하나를 고를 때까지 기다렸다가(고른 카드가 톡 튄다) 넘어가고, 시즌 현황에서는 순위표의
  // 내 팀 순위 변동을 움직여 보여 준다. 기다리는 카드 밖의 단계에서 사용자가 손대면(휠·터치·클릭·키) 바로 그만둔다.
  // 감속 모션·업무 모드에서는 돌지 않는다.
  let tourWait = $state<TourGate | null>(null);
  // T-11-200 자기 투자는 드롭다운처럼 고른 한 줄만 보이고, 그 줄을 누르면 펼쳐져 고르면 다시 접힌다. 결과 안내가 투자를 기다릴 때와 고른 투자를 할 돈이 없을 때는 펼친다.
  let investOpen = $state(false);
  const investForced = $derived(tourWait === 'invest' || !investCard(s, invest).affordable);
  const investAll = $derived(investOpen || investForced);
  let resume: ((btn: HTMLElement) => void) | null = null;
  let table = $state<ReturnType<typeof LeagueTable>>();
  let touring = $state(false);
  /** 이 리포트의 순위 변동 — 이전 순위. 바뀌지 않았으면 null. */
  const rankBefore = $derived(rankBeforeOf(report?.rank));
  const playRank = () => {
    if (rankBefore === null || !report || report.key === rankedKey) return;
    rankedKey = report.key;
    table?.playRank(rankBefore);
  };
  $effect(() => {
    const k = report?.key;
    if (!k || k === touredKey) return;
    touredKey = k;
    if (!dur(1)) return;
    return tour();
  });

  // T-11-162 안내가 순위 연출까지 가지 못했으면, 사용자가 직접 내려와 순위표가 화면에 들어올 때 한 번 튼다.
  $effect(() => {
    if (touring || rankBefore === null || report?.key === rankedKey || !dur(1)) return;
    const el = document.querySelector('[data-league-table]');
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        io.disconnect();
        playRank();
      },
      { threshold: RANK_SEEN_RATIO },
    );
    io.observe(el);
    return () => io.disconnect();
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
      touring = false;
      timers.forEach(clearTimeout);
      light(null);
      tourWait = null;
      resume = null;
      for (const e of evs) removeEventListener(e, onUser, true);
    };
    touring = true;
    for (const e of evs) addEventListener(e, onUser, { capture: true, passive: true });
    const steps = RESULT_TOUR.flatMap(([k, wait]) => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${k}"]`);
      return el ? [{ k, el, wait }] : [];
    });
    const go = (i: number) => {
      const step = steps[i];
      if (!step) return stop();
      const { k, el, wait } = step;
      // T-11-036 마지막 단계(go)는 화면 아래 고정 진행 버튼이라 내려가지 않고 초점만 옮긴다.
      if (k === 'go') el.focus({ preventScroll: true });
      else if (i) {
        const head = document.querySelector<HTMLElement>('.topbar')?.offsetHeight ?? 0;
        const box = el.getBoundingClientRect();
        let y = box.top + scrollY - head - 12;
        // 고르기를 기다리는 카드가 화면보다 길면 선택지·설명이 있는 아래쪽이 보이게, 아래 고정 진행 바 바로 위에 바닥을 맞춘다.
        if (typeof wait !== 'number') {
          const floor = document.querySelector('.season-bar, .tabs')?.getBoundingClientRect().top ?? innerHeight;
          y = Math.max(y, box.bottom + scrollY - (floor - 12));
        }
        scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
      }
      light(el);
      if (typeof wait !== 'number') {
        tourWait = wait;
        resume = (btn) => {
          tourWait = null;
          resume = null;
          btn.dataset.picked = '';
          later(() => {
            delete btn.dataset.picked;
            go(i + 1);
          }, TOUR_PICK_MS);
        };
        return;
      }
      let ms = wait;
      if (k === 'status' && rankBefore !== null) {
        later(playRank, TOUR_RANK_DELAY);
        ms += TOUR_RANK_MS;
      }
      later(() => go(i + 1), ms);
    };
    go(0);
    return stop;
  }

  function meterCls(v: number, badAt: number, warnAt: number): string {
    return v < badAt ? 'bad' : v < warnAt ? 'warn' : '';
  }

  function setTraining(id: string, btn: HTMLElement) {
    s.training = id;
    save();
    if (tourWait === 'train') resume?.(btn);
  }

  function setInvest(id: string, btn: HTMLElement) {
    s.invest = id;
    investOpen = false;
    save();
    if (tourWait === 'invest') resume?.(btn);
  }

  function waitText(k: string): string {
    const c = (s.chains || []).find((x) => {
      const e = eventById(x.id);
      return e && e.story === k;
    });
    if (!c) return '';
    return c.at <= t ? L.storySoon : L.storyWait({ n: c.at - t });
  }
</script>

{#if report}
  {#key report.key}
    <PhaseReport r={report} />
  {/key}
{/if}

<section class="card stack" data-season-status data-tour="status">
  <div>
    <div class="eyebrow">{seasonLabel(s)} Season</div>
    <h2>{label}</h2>
    <div class="track">
      {#each [0, 1, 2] as i (i)}
        <div class={i < phase ? 'done' : i === phase ? 'now' : ''}></div>
      {/each}
    </div>
    <div class="track-lbl">
      {#each [L.preseason, L.phaseFirst, L.phaseSecond] as tl (tl)}
        <span>{tl}</span>
      {/each}
    </div>
  </div>
  {#if showTotals}
    <p class="muted fs-sm" data-season-totals>{L.totals({ w: S.w, d: S.d, l: S.l, apps: S.apps, goals: S.goals, col: lastCol[0], colN: lastCol[1], rating: avg })}</p>
  {/if}
  <LeagueTable {s} bind:this={table} />
  {#if comps.length}
    <div>
      <h3 class="sub-title" style="margin-bottom:2px">{L.compsTitle}</h3>
      {#each comps as c (c.name)}
        <div class="story-row">
          <b>{tn(c.name)}</b>
          <span class="muted">{tn(c.stage) || (c.type === 'super' ? L.compSuper : L.compStart)}{c.alive && c.stage ? ` · ${L.compAlive}` : ''}</span>
          <span class="muted">{L.compLine({ apps: c.apps, g: c.g })}</span>
        </div>
      {/each}
    </div>
  {/if}
</section>

<section class="card stack" data-prep data-tour="prep">
  <div><div class="eyebrow">Next · {label}</div><h2>{L.prepTitle}</h2></div>
  <div class="meters">
    <div class="meter"><span>{L.condition}</span><div class="bar"><i class={meterCls(s.cond, 40, 65)} style="width:{Math.round(s.cond)}%"></i></div><span class="v">{Math.round(s.cond)}</span></div>
    <div class="meter"><span>{L.morale}</span><div class="bar"><i class={meterCls(s.morale, 40, 60)} style="width:{Math.round(s.morale)}%"></i></div><span class="v">{Math.round(s.morale)}</span></div>
    <div class="meter"><span>{L.fame}</span><div class="bar"><i class="acc" style="width:{Math.min(100, Math.round(s.fame))}%"></i></div><span class="v">{Math.round(s.fame)}</span></div>
  </div>
  <div class="stack" style="gap:6px" data-coach-feedback>
    <h3 class="sub-title">{L.coachMemo}</h3>
    <p class="fs-sm">{coach.summary}</p>
    {#each coach.notes as note (note)}<p class="muted fs-sm">{note}</p>{/each}
  </div>
  <h3 class="sub-title">{L.trainingTitle}</h3>
  {#if tourWait === 'train'}<p class="tour-hint" aria-live="polite">{L.trainHint}</p>{/if}
  <Radar {s} onpick={setTraining} />
  <div class="train train-misc">
    {#each TRAININGS.filter((x) => !x.attr) as tr (tr.id)}
      {@const c = trainingCard(s, tr)}
      <button class="opt" data-train={tr.id} aria-pressed={s.training === tr.id} onclick={(e) => setTraining(tr.id, e.currentTarget)}>
        <b>{trainingLabel(s, tr)}</b>{#if c.tag}<small class="train-tag">{c.tag}</small>{/if}
      </button>
    {/each}
  </div>
  {#if picked}
    {@const c = trainingCard(s, picked)}
    <div class="train-help" data-train-help aria-live="polite">
      <b>{trainingLabel(s, picked)} <span class="muted">· {c.effect.join(' · ')}</span></b>
      {#if c.tag}<small class="train-tag">{c.tag}</small>{/if}
    </div>
  {/if}
</section>

<section class="card stack" data-invest-card data-tour="invest">
  <div class="row" style="justify-content:space-between">
    <div><div class="eyebrow">Invest</div><h2>{L.investTitle}</h2></div>
    <span class="pill" data-invest-money
      >{spend ? L.fundsAfter({ v: W.won({ v: fmtMoney(s.money) }), after: W.won({ v: fmtMoney(Math.max(0, s.money - spend)) }) }) : L.funds({ v: W.won({ v: fmtMoney(s.money) }) })}</span
    >
  </div>
  {#if tourWait === 'invest'}<p class="tour-hint" aria-live="polite">{L.investHint}</p>{/if}
  <div class="invest-list">
    {#each investAll ? INVESTS : [invest] as d (d.id)}
      {@const c = investCard(s, d)}
      {@const cost = investCost(s, d)}
      {@const note = investNote(d)}
      {@const tags = c.tag.split(' · ')}
      {@const extra = tags.slice(cost ? 1 : 0).join(' · ')}
      {@const drop = !investForced && invest.id === d.id}
      <button
        class="opt"
        class:iv-drop={drop}
        data-invest={d.id}
        aria-pressed={invest.id === d.id}
        aria-expanded={drop ? investAll : undefined}
        disabled={!c.affordable}
        onclick={(e) => (investAll ? setInvest(d.id, e.currentTarget) : (investOpen = true))}
      >
        <span class="iv-main">
          <b>{investName(s, d)}{#if note}<small class="iv-note">{note}</small>{/if}</b>
          <small>{c.effect.join(' · ')}{#if extra}<span class="train-tag"> · {extra}</span>{/if}</small>
        </span>
        <span class="iv-cost num">{cost ? (c.affordable ? W.won({ v: fmtMoney(cost) }) : tags[0]) : ''}</span>
        {#if drop}<svg class="iv-chev" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>{/if}
      </button>
    {/each}
  </div>
</section>

{#if activeStories.length}
  <section class="card" data-stories data-tour="stories">
    <div class="eyebrow">Storylines</div>
    <h2 style="margin-bottom:6px">{L.storiesTitle}</h2>
    {#each activeStories as [k, v] (k)}
      <div class="story-row">
        <b>{tn(STORIES[k]!.name)}</b>
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
  <section class="card" data-feed data-tour="feed">
    <div class="eyebrow">Timeline</div>
    <h2 style="margin-bottom:6px">{L.feedTitle}</h2>
    <div class="feed">
      {#each feedAll ? feed : feed.slice(0, FEED_SHORT) as l, i (i)}
        <div><time>{tn(l.t)}</time><span class={l.kind}>{l.text}</span></div>
      {/each}
    </div>
    {#if feed.length > FEED_SHORT}
      <button class="more-chev" data-act="feed-more" aria-expanded={feedAll} aria-label={feedAll ? L.feedLessAria : L.feedMoreAria} onclick={() => (feedAll = !feedAll)}><svg class="chev" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></button>
    {/if}
  </section>
{/if}

