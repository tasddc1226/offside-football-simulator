<script lang="ts">
  // T-11-825 원정 투어(내 구단 화면 '원정 투어' 칸으로 연다). 열 때 투어 홈과 내 팀(선수 목록, 1분 메모)만 받는다. 사다리 · 제한 ·
  // 자동 편성은 contracts 계산이라 따로 부르지 않는다. 여정 지도 → 편성(상대 분석 · 선발 · 교체 명단 · 전술) → 작전 경기(30분 ·
  // 60분 작전 타임) → 결과. 주간 순위는 탭을 열 때만 받는다. 그라운드 · 선수 카드는 팀 화면의 것을 그대로 쓴다.
  import PopSheet from '../PopSheet.svelte';
  import TeamPitch from '../team/TeamPitch.svelte';
  import PlayerCard from '../team/PlayerCard.svelte';
  import type { TeamPlayer } from '@offside/app-core/api/team';
  import { fetchOwnerTeam } from '@offside/app-core/api/team';
  import { fetchTour, fetchTourRanking, orderTourMatch, startTourMatch } from '@offside/app-core/api/tour';
  import type { TourMatchView, TourRankingResponse, TourStage, TourStateResponse } from '@offside/contracts';
  import { FORMATIONS, FORMATION_IDS, type FormationId } from '@offside/contracts/owner-team';
  import { TOUR_TRIES_PER_DAY } from '@offside/contracts/squad-tour';
  import {
    TOUR_LIVE,
    TOUR_MAIN_STAGES,
    TOUR_TACTICS,
    tourAutoDraft,
    tourBenchOptions,
    tourCells,
    tourChances,
    tourEdge,
    tourOptions,
    tourPicks,
    tourRuleText,
    tourSpan,
    tourStageName,
    tourStageState,
    tourTacticDesc,
    tourTacticName,
    tourTired,
    tourWeekLeft,
    type TourDraft,
    type TourTactic,
  } from '@offside/app-core/tour';
  import { marketName } from '@offside/app-core/market';
  import { fmtValue } from '@offside/contracts/market-value';
  import { localCareerNames } from '@offside/game/hof-store';
  import { tourText as L } from '@offside/app-core/i18n/ko/tour';
  import { playSfx } from '../sfx.js';

  const { onclose }: { onclose: () => void } = $props();
  const local = localCareerNames();

  type View = 'map' | 'prep' | 'live' | 'result' | 'rank';
  let view = $state<View>('map');
  let tour = $state<TourStateResponse | null>(null);
  let players = $state<TeamPlayer[]>([]);
  let failed = $state(false);
  let busy = $state(false);
  let error = $state('');

  async function load() {
    failed = false;
    const [t, team] = await Promise.all([fetchTour(), fetchOwnerTeam()]);
    if (!t.ok || !team.ok) {
      failed = true;
      return;
    }
    tour = t.data;
    players = team.data.players;
    if (!draftFormation && team.data.team) draftFormation = team.data.team.formation;
    if (t.data.live) {
      match = t.data.live;
      resetOrder();
      view = 'live';
    }
  }
  $effect(() => void load());

  const byId = $derived(new Map(players.map((p) => [p.careerId, p])));
  const picks = $derived(tourPicks(players));
  const pickById = $derived(new Map(picks.map((p) => [p.id, p])));
  const nameOf = (id: string | null) => {
    const p = id ? byId.get(id) : undefined;
    return p ? marketName(p, local) : L.mercName;
  };
  const totalStars = $derived((tour?.stages ?? []).reduce((a, s) => a + s.stars, 0));
  const left = $derived(tourWeekLeft(new Date().toISOString()));

  // ── 편성 ──
  let draftFormation = $state<FormationId | null>(null);
  let stage = $state<TourStage | null>(null);
  let draft = $state<TourDraft | null>(null);
  let slotOpen = $state<number | null>(null);
  let benchOpen = $state(false);

  function openStage(s: TourStage) {
    if (!tour) return;
    stage = s;
    draft = tourAutoDraft(s, picks, tour.season, draftFormation ?? '4-3-3');
    slotOpen = null;
    benchOpen = false;
    error = '';
    view = 'prep';
  }
  function setFormation(f: FormationId) {
    if (!tour || !stage || !draft) return;
    draftFormation = f;
    draft = { ...tourAutoDraft(stage, picks, tour.season, f), tactic: draft.tactic };
    slotOpen = null;
  }
  function auto() {
    if (!tour || !stage || !draft) return;
    draft = { ...tourAutoDraft(stage, picks, tour.season, draft.formation), tactic: draft.tactic };
    slotOpen = null;
  }
  const cells = $derived(stage && draft ? tourCells(draft, pickById, stage.rules, stage.merc) : []);
  const pitchCells = $derived(
    cells.map((c) => ({ rating: c.rating, name: nameOf(c.id), youth: c.merc, player: c.id ? byId.get(c.id) : undefined })),
  );
  const options = $derived(
    tour && stage && draft && slotOpen !== null ? tourOptions(draft, slotOpen, picks, stage.rules, tour.season) : [],
  );
  const benchOptions = $derived(tour && stage && draft && benchOpen ? tourBenchOptions(draft, picks, stage.rules, tour.season) : []);
  function place(id: string | null) {
    if (!draft || slotOpen === null) return;
    const slotIds = [...draft.slotIds];
    slotIds[slotOpen] = id;
    draft = { ...draft, slotIds };
    slotOpen = null;
  }
  function toggleBench(id: string) {
    if (!draft) return;
    const has = draft.bench.includes(id);
    if (!has && draft.bench.length >= TOUR_LIVE.bench) return;
    draft = { ...draft, bench: has ? draft.bench.filter((x) => x !== id) : [...draft.bench, id] };
  }
  async function depart() {
    if (!stage || !draft || busy) return;
    busy = true;
    error = '';
    const r = await startTourMatch({ stage: stage.stage, ...draft });
    busy = false;
    if (!r.ok) {
      error = r.error.message || L.departFail;
      return;
    }
    playSfx('reward');
    match = r.data.match;
    if (tour) tour = { ...tour, triesLeft: r.data.triesLeft };
    resetOrder();
    view = 'live';
  }

  // ── 작전 경기 ──
  let match = $state<TourMatchView | null>(null);
  let orderTactic = $state<TourTactic>('possession');
  let subs = $state<{ slot: number; cardId: string }[]>([]);
  let outSlot = $state<number | null>(null);
  function resetOrder() {
    orderTactic = match?.tactic ?? 'possession';
    subs = [];
    outSlot = null;
  }
  const liveStage = $derived(match ? (tour?.stages.find((s) => s.stage === match!.stage) ?? null) : null);
  const liveSlots = $derived(match ? match.slotIds.map((id, i) => subs.find((s) => s.slot === i)?.cardId ?? id) : []);
  const liveCells = $derived.by(() => {
    if (!match) return [];
    const slots = FORMATIONS[match.formation];
    return liveSlots.map((id, i) => {
      const p = id ? byId.get(id) : undefined;
      const fresh = subs.some((s) => s.slot === i);
      const base = tourCells({ formation: match!.formation, slotIds: liveSlots }, pickById, liveStage?.rules ?? [], liveStage?.merc ?? 0)[i]!;
      const t = tourTired(base.rating, fresh ? 100 : (match!.stamina[i] ?? 100));
      return { i, id, slot: slots[i]!, name: nameOf(id), player: p, merc: !p, ...t };
    });
  });
  const livePitch = $derived(liveCells.map((c) => ({ rating: Math.round(c.rating), name: c.name, youth: c.merc, player: c.player })));
  const benchLeft = $derived(match ? match.bench.filter((id) => !subs.some((s) => s.cardId === id)) : []);
  const chances = $derived(match ? tourChances(match) : []);
  const span = $derived(match ? tourSpan(match.done) : { from: 0, to: 30 });
  function pickOut(i: number) {
    if (!match || subs.length >= match.subsLeft || subs.some((s) => s.slot === i)) return true;
    outSlot = outSlot === i ? null : i;
    return true;
  }
  function pickIn(cardId: string) {
    if (outSlot === null) return;
    subs = [...subs, { slot: outSlot, cardId }];
    outSlot = null;
  }
  async function sendOrder() {
    if (!match || busy) return;
    busy = true;
    error = '';
    const r = await orderTourMatch(match.id, {
      done: match.done,
      ...(orderTactic !== match.tactic ? { tactic: orderTactic } : {}),
      ...(subs.length ? { subs } : {}),
    });
    busy = false;
    if (!r.ok) {
      error = r.error.message || L.orderFail;
      return;
    }
    match = r.data.match;
    if (tour) tour = { ...tour, triesLeft: r.data.triesLeft };
    resetOrder();
    if (match.status !== 'live') {
      if (match.status === 'won') playSfx('reward');
      view = 'result';
      // 진행 · 순위 · 별이 바뀌었다(지시 요청이 메모를 비웠다).
      const t = await fetchTour();
      if (t.ok) tour = t.data;
    }
  }
  const goalText = (e: TourMatchView['events'][number]) =>
    e.side === 'away' ? (e.scorerId ? nameOf(e.scorerId) : e.scorer) : L.oppGoal;

  // ── 주간 순위 ──
  let ranking = $state<TourRankingResponse | null>(null);
  let rankFailed = $state(false);
  async function openRank() {
    view = 'rank';
    rankFailed = false;
    const r = await fetchTourRanking();
    if (r.ok) ranking = r.data;
    else rankFailed = true;
  }
  const nextStage = $derived(tour ? (tour.stages.find((s) => s.stage === tour!.cleared + 1) ?? null) : null);
</script>

<PopSheet label={L.title} step={view} {onclose}>
  <div class="stack st" data-squad-tour aria-busy={busy}>
    <div class="st-head">
      {#if view === 'prep' || view === 'rank'}<button class="btn btn-sm st-icon" data-act="tour-back" aria-label={L.back} onclick={() => (view = 'map')}>‹</button>{/if}
      <h2>{view === 'rank' ? L.rankingTitle : stage && view === 'prep' ? tourStageName(stage.stage) : L.title}</h2>
      {#if view !== 'live'}<button class="btn btn-sm st-icon" data-act="tour-close" aria-label={L.close} onclick={onclose}>✕</button>{/if}
    </div>

    {#if failed}
      <p class="muted">{L.loadFail}</p>
      <button class="btn" data-act="tour-retry" onclick={() => void load()}>{L.retry}</button>
    {:else if !tour}
      <p class="muted">{L.loading}</p>
    {:else if !tour.open}
      <p class="muted" data-tour-closed>{L.closedTitle}</p>
    {:else if view === 'map'}
      <div class="stack st-band" data-tour-summary>
        <div class="st-band-top">
          <span>{L.weekEnds(left)}</span>
          <button class="btn btn-sm st-ghost" data-act="tour-rank" onclick={() => void openRank()}>{L.rankingTitle}</button>
        </div>
        <div class="st-stats">
          <div><small>{L.score}</small><b class="st-num">{tour.score}</b></div>
          <div><small>{L.rankingTitle}</small><b class="st-num">{tour.rank ? L.rank({ n: tour.rank }) : L.rankNone}</b></div>
          <div><small>{L.starsOf({ n: totalStars, max: TOUR_MAIN_STAGES * 3 })}</small><b class="st-num st-gold">★ {totalStars}</b></div>
        </div>
        <span data-tour-tries>{L.triesLeft({ n: tour.triesLeft, max: TOUR_TRIES_PER_DAY })}</span>
      </div>
      <p class="muted st-lead">{L.lead}</p>
      <ol class="st-map" data-tour-map>
        {#each tour.stages as s (s.stage)}
          {@const state = tourStageState(s, tour.cleared)}
          <li class="st-node {state}" data-tour-stage={s.stage} data-state={state}>
            <div class="st-badge st-num">{state === 'done' ? '✓' : s.stage}</div>
            <div class="stack st-node-body">
              <div class="st-node-top">
                <b>{tourStageName(s.stage)}</b>
                <span class="st-stars" aria-label={L.starsOf({ n: s.stars, max: 3 })}>{'★'.repeat(s.stars)}<i>{'★'.repeat(3 - s.stars)}</i></span>
              </div>
              <small class="muted">{L.oppOvr({ n: s.opp })} · {s.formation} · {tourTacticName(s.tactic)}</small>
              {#each s.rules as r, k (k)}<span class="st-rule">{tourRuleText(r)}</span>{/each}
              <small class={state === 'done' ? 'muted' : 'st-fee'}>{state === 'done' ? L.cleared : L.fee({ v: fmtValue(s.fee) })}</small>
              {#if state === 'next'}
                {#if tour.triesLeft > 0}
                  <button class="btn btn-primary" data-act="tour-go" onclick={() => openStage(s)}>{L.go}</button>
                {:else}
                  <small class="muted" data-tour-no-tries>{L.noTries}</small>
                {/if}
              {:else if state === 'locked'}
                <small class="muted">{L.locked}</small>
              {/if}
            </div>
          </li>
        {/each}
      </ol>
      <ul class="st-info muted">
        <li>{L.infoTries({ n: TOUR_TRIES_PER_DAY })}</li>
        <li>{L.infoFee}</li>
        <li>{L.infoDraw}</li>
        <li>{L.infoWeek}</li>
      </ul>
    {:else if view === 'prep' && stage && draft}
      {@const edge = tourEdge(draft.tactic, stage.tactic)}
      <div class="stack st-card" data-tour-scout>
        <b>{L.scoutTitle}</b>
        <span>{L.oppOvr({ n: stage.opp })} · {stage.formation} · {L.oppTactic({ name: tourTacticName(stage.tactic) })}</span>
        <small class="muted">{L.oppHabit}</small>
        <b>{L.restriction}</b>
        {#each stage.rules as r, k (k)}<span class="st-rule">{tourRuleText(r)}</span>{/each}
        <small class="muted">{L.merc({ n: stage.merc })}</small>
      </div>
      <div class="st-tools">
        <b>{L.lineupTitle}</b>
        <div class="st-row">
          <select class="btn btn-sm" data-tour-formation aria-label={L.lineupTitle} value={draft.formation} onchange={(e) => setFormation(e.currentTarget.value as FormationId)}>
            {#each FORMATION_IDS as f (f)}<option value={f}>{f}</option>{/each}
          </select>
          <button class="btn btn-sm" data-act="tour-auto" onclick={auto}>{L.auto}</button>
        </div>
      </div>
      <small class="muted">{L.pickSlot}</small>
      <TeamPitch formation={draft.formation} cells={pitchCells} selected={slotOpen} onpick={(i) => { slotOpen = slotOpen === i ? null : i; benchOpen = false; return true; }} />
      {#if slotOpen !== null}
        <div class="st-picker" data-tour-options>
          <button class="st-opt" data-act="tour-clear" onclick={() => place(null)}><b>{L.emptySlot}</b><small class="muted">{L.mercName} {stage.merc}</small></button>
          {#each options as o (o.id)}
            {@const p = byId.get(o.id)}
            {#if p}
              <button class="st-opt" class:off={!!o.blocked} disabled={!!o.blocked} data-tour-option={o.id} onclick={() => place(o.id)}>
                <PlayerCard player={p} name={marketName(p, local)} rating={o.rating} role={FORMATIONS[draft.formation][slotOpen]!} mini />
                {#if o.blocked}<small class="st-bad">{o.blocked === 'rule' ? L.blocked : L.capFull}</small>{/if}
              </button>
            {/if}
          {/each}
        </div>
      {/if}
      <div class="st-tools">
        <b data-tour-bench-count>{L.benchTitle({ n: draft.bench.length, max: TOUR_LIVE.bench })}</b>
        <button class="btn btn-sm" data-act="tour-bench" onclick={() => { benchOpen = !benchOpen; slotOpen = null; }}>{benchOpen ? L.close : L.pickBench}</button>
      </div>
      <div class="st-picker" data-tour-bench>
        {#each draft.bench as id (id)}
          {@const p = byId.get(id)}
          {#if p}
            <button class="st-opt on" onclick={() => toggleBench(id)}>
              <PlayerCard player={p} name={marketName(p, local)} rating={p.peak} role={p.dpos ?? FORMATIONS[draft.formation][0]!} mini />
            </button>
          {/if}
        {/each}
        {#if benchOpen}
          {#each benchOptions as c (c.id)}
            {@const p = byId.get(c.id)}
            {#if p}
              <button class="st-opt" disabled={draft.bench.length >= TOUR_LIVE.bench} data-tour-bench-option={c.id} onclick={() => toggleBench(c.id)}>
                <PlayerCard player={p} name={marketName(p, local)} rating={p.peak} role={p.dpos ?? FORMATIONS[draft.formation][0]!} mini />
              </button>
            {/if}
          {/each}
        {/if}
      </div>
      <b>{L.tacticPick}</b>
      <div class="st-tactics" role="radiogroup" aria-label={L.tacticPick}>
        {#each TOUR_TACTICS as t (t)}
          {@const e = tourEdge(t, stage.tactic)}
          <button class="st-tactic" class:on={draft.tactic === t} role="radio" aria-checked={draft.tactic === t} data-tour-tactic={t} onclick={() => (draft = { ...draft!, tactic: t })}>
            <b>{tourTacticName(t)}</b>
            <small class={e.edge > 0 ? 'st-good' : e.edge < 0 ? 'st-bad' : 'muted'}>{e.text}</small>
          </button>
        {/each}
      </div>
      <small class="muted">{tourTacticDesc(draft.tactic)} · {edge.text}</small>
      {#if error}<p class="st-bad" role="alert">{error}</p>{/if}
      <button class="btn btn-primary st-cta" data-act="tour-depart" disabled={busy} onclick={() => void depart()}>{L.depart}</button>
    {:else if (view === 'live' || view === 'result') && match}
      {@const over = match.status !== 'live'}
      <div class="stack st-band" data-tour-match data-status={match.status} data-done={match.done}>
        <div class="st-band-top">
          <span>{tourStageName(match.stage)}</span>
          <span class="st-gold">{over ? (match.status === 'won' ? L.winTitle : L.loseTitle) : `${L.minute({ n: span.from })} · ${L.timeout}`}</span>
        </div>
        <div class="st-score st-num" data-tour-score>{match.goalsAgainst} : {match.goalsFor}</div>
        <div class="st-segs" aria-hidden="true">{#each Array.from({ length: TOUR_LIVE.segments }, (_, i) => i) as i (i)}<i class:on={i < match.done}></i>{/each}</div>
        <small>{L.oppNow({ name: tourTacticName(match.oppTactic) })}</small>
      </div>
      <ul class="st-events" data-tour-events>
        {#each match.events as e, k (k)}
          <li class:mine={e.side === 'away'}><span class="st-num">{e.minute}'</span><span>{goalText(e)}{#if e.side === 'away' && e.assist} · {L.assist({ name: e.assistId ? nameOf(e.assistId) : e.assist })}{/if}</span></li>
        {:else}
          <li class="muted">{L.noGoals}</li>
        {/each}
      </ul>
      {#if !over}
        <b>{L.timeout}</b>
        <small class="muted">{L.timeoutLead}</small>
        <div class="st-tactics" role="radiogroup" aria-label={L.timeout}>
          {#each chances as c (c.tactic)}
            <button class="st-tactic" class:on={orderTactic === c.tactic} role="radio" aria-checked={orderTactic === c.tactic} data-tour-tactic={c.tactic} onclick={() => (orderTactic = c.tactic)}>
              <b>{tourTacticName(c.tactic)}{#if c.tactic === match.tactic} <small class="muted">{L.now}</small>{/if}</b>
              <small class={c.diff > 0 ? 'st-good' : c.diff < 0 ? 'st-bad' : 'muted'}>{L.chance({ n: c.pct })}</small>
            </button>
          {/each}
        </div>
        <div class="st-tools">
          <b data-tour-subs>{L.subsLeft({ n: match.subsLeft - subs.length })}</b>
          <small class="muted">{outSlot === null ? L.subPickOut : L.subPickIn}</small>
        </div>
        <TeamPitch formation={match.formation} cells={livePitch} selected={outSlot} onpick={pickOut} />
        <ul class="st-stamina">
          {#each liveCells.filter((c) => c.tired) as c (c.i)}
            <li><b>{c.slot} {c.name}</b><span class="st-bad">{L.stamina({ n: c.stamina })}</span></li>
          {/each}
        </ul>
        <div class="st-picker" data-tour-live-bench>
          {#each benchLeft as id (id)}
            {@const p = byId.get(id)}
            {#if p}
              <button class="st-opt" disabled={outSlot === null} data-tour-sub-in={id} onclick={() => pickIn(id)}>
                <PlayerCard player={p} name={marketName(p, local)} rating={p.peak} role={outSlot !== null ? FORMATIONS[match.formation][outSlot]! : (p.dpos ?? FORMATIONS[match.formation][0]!)} mini />
              </button>
            {/if}
          {/each}
        </div>
        {#each subs as s, k (s.slot)}
          <div class="st-sub" data-tour-sub>
            <span><b class="st-bad">{L.subOut}</b> {nameOf(match.slotIds[s.slot] ?? null)} → <b class="st-good">{L.subIn}</b> {nameOf(s.cardId)}</span>
            <button class="btn btn-sm" onclick={() => (subs = subs.filter((_, i) => i !== k))}>{L.subCancel}</button>
          </div>
        {/each}
        {#if error}<p class="st-bad" role="alert">{error}</p>{/if}
        <button class="btn btn-primary st-cta" data-act="tour-continue" disabled={busy} onclick={() => void sendOrder()}>{L.continueBtn(span)}</button>
      {:else}
        {#if match.result}
          {#if match.result.pens}<small class="muted">{L.pens}</small>{/if}
          {#if match.status === 'won'}
            <div class="st-result-stars" data-tour-result-stars={match.result.stars}>
              {#each [L.starWin, L.starFirst, L.starMargin] as label, i (label)}
                <div class:on={i === 0 || (i === 1 && match.tryNo === 1) || (i === 2 && !match.result.pens && match.goalsFor - match.goalsAgainst >= 2)}><span class="st-star" style:--d={`${0.2 + i * 0.25}s`}>★</span><small>{label}</small></div>
              {/each}
            </div>
            <div class="st-stats st-gain">
              <div><small>{L.feeGot}</small><b class="st-num st-gold" data-tour-fee>+{fmtValue(match.result.fee)}</b></div>
              <div><small>{L.scoreGot}</small><b class="st-num">+{match.result.score}</b></div>
            </div>
          {:else}
            <p class="muted">{L.loseHint}</p>
          {/if}
        {/if}
        <div class="st-actions">
          <button class="btn" data-act="tour-map" onclick={() => (view = 'map')}>{L.toMap}</button>
          {#if nextStage && tour.triesLeft > 0}
            <button class="btn btn-primary" data-act="tour-next" onclick={() => openStage(nextStage)}>{match.status === 'won' ? L.nextStage : L.again}</button>
          {/if}
        </div>
      {/if}
    {:else if view === 'rank'}
      <small class="muted">{L.rankingLead}</small>
      {#if rankFailed}
        <p class="muted">{L.rankingFail}</p>
      {:else if !ranking}
        <p class="muted">{L.loading}</p>
      {:else if !ranking.rows.length}
        <p class="muted" data-tour-rank-empty>{L.rankingEmpty}</p>
      {:else}
        <ol class="st-rank" data-tour-ranking>
          {#each ranking.rows as r (r.rank)}
            <li><span class="st-num">{r.rank}</span><b>{r.name}</b><small class="muted">{L.rankingCleared({ n: r.cleared })} · ★ {r.stars}</small><span class="st-num">{r.score}</span></li>
          {/each}
        </ol>
      {/if}
    {/if}
  </div>
</PopSheet>

<style>
  .st {gap:12px;padding:4px 16px 20px;}
  .st-head {display:flex;align-items:center;gap:8px;}
  .st-head h2 {flex:1;margin:0;font-size:1.1rem;}
  .st-icon {min-width:44px;min-height:44px;font-weight:700;}
  .st-num {font-family:var(--display);font-weight:700;}
  .st-gold {color:var(--pitch-accent);}
  .st-good {color:var(--good);}
  .st-bad {color:var(--bad);}
  .st-band {gap:10px;padding:16px;border-radius:var(--radius-md);background:var(--pitch);color:var(--on-pitch);}
  .st-band-top {display:flex;justify-content:space-between;align-items:center;gap:12px;font-size:13px;}
  .st-ghost {background:transparent;border-color:var(--chalk);color:var(--on-pitch);min-height:44px;}
  .st-stats {display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;}
  .st-stats div {display:flex;flex-direction:column;gap:2px;}
  .st-stats small {font-size:11px;opacity:.75;}
  .st-stats b {font-size:1.4rem;line-height:1.1;}
  .st-gain {grid-template-columns:repeat(2,minmax(0,1fr));padding:14px;border-radius:var(--radius-md);background:var(--pitch);color:var(--on-pitch);}
  .st-lead {margin:0;font-size:13px;}
  .st-map {list-style:none;margin:0;padding:0;display:flex;flex-direction:column;}
  .st-node {display:grid;grid-template-columns:44px 1fr;gap:12px;padding:0 0 16px;position:relative;}
  .st-node:not(:last-child)::before {content:'';position:absolute;left:21px;top:44px;bottom:0;width:2px;background:var(--line);}
  .st-node.done:not(:last-child)::before {background:var(--good);}
  .st-badge {width:44px;height:44px;border-radius:50%;border:2px solid var(--line);display:flex;align-items:center;justify-content:center;font-size:1.2rem;background:var(--surface);color:var(--muted);box-sizing:border-box;}
  .st-node.done .st-badge {background:var(--good);border-color:var(--good);color:var(--surface);}
  .st-node.next .st-badge {border-color:var(--accent-text);color:var(--accent-text);}
  .st-node-body {gap:6px;padding:12px;border-radius:var(--radius-md);border:1px solid var(--line);background:var(--surface);min-width:0;}
  .st-node.next .st-node-body {border-color:var(--accent-text);}
  .st-node.locked .st-node-body {opacity:.6;}
  .st-node-top {display:flex;justify-content:space-between;align-items:center;gap:8px;}
  .st-stars {color:var(--warn);letter-spacing:2px;}
  .st-stars i {font-style:normal;color:var(--line);}
  .st-rule {display:inline-flex;align-self:flex-start;align-items:center;min-height:26px;padding:0 10px;border-radius:999px;border:1px solid var(--line);background:var(--surface-2);font-size:12px;font-weight:700;}
  .st-fee {color:var(--accent-text);font-weight:700;}
  .st-info {margin:0;padding-left:18px;font-size:12px;display:flex;flex-direction:column;gap:4px;}
  .st-card {gap:6px;padding:14px;border-radius:var(--radius-md);border:1px solid var(--line);background:var(--surface);}
  .st-tools {display:flex;justify-content:space-between;align-items:center;gap:8px;}
  .st-row {display:flex;gap:8px;}
  .st-row .btn,.st-tools .btn {min-height:44px;}
  .st-picker {display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;}
  .st-picker:empty {display:none;}
  .st-opt {flex:none;display:flex;flex-direction:column;align-items:center;gap:4px;min-width:76px;min-height:44px;padding:6px;border-radius:12px;border:1px solid var(--line);background:var(--surface);color:inherit;font:inherit;cursor:pointer;}
  .st-opt.on {border-color:var(--accent-text);}
  .st-opt.off,.st-opt:disabled {opacity:.5;cursor:default;}
  .st-opt small {font-size:11px;}
  .st-tactics {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;}
  .st-tactic {display:flex;flex-direction:column;align-items:flex-start;gap:2px;min-height:56px;padding:8px 12px;border-radius:12px;border:1px solid var(--line);background:var(--surface);color:inherit;font:inherit;text-align:left;cursor:pointer;}
  .st-tactic.on {border:2px solid var(--accent-text);}
  .st-tactic small {font-size:12px;}
  .st-cta {min-height:52px;position:sticky;bottom:0;}
  .st-score {font-size:3rem;line-height:1;text-align:center;}
  .st-segs {display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;}
  .st-segs i {height:6px;border-radius:999px;background:var(--chalk);opacity:.35;}
  .st-segs i.on {background:var(--pitch-accent);opacity:1;}
  .st-events,.st-stamina,.st-rank {list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px;font-size:13px;}
  .st-events li {display:flex;gap:10px;}
  .st-events li.mine {color:var(--accent-text);font-weight:700;}
  .st-events .st-num {width:32px;flex:none;}
  .st-stamina li,.st-sub {display:flex;justify-content:space-between;align-items:center;gap:8px;}
  .st-sub {padding:8px 12px;border-radius:12px;border:1px solid var(--line);font-size:13px;}
  .st-result-stars {display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;text-align:center;}
  .st-result-stars div {display:flex;flex-direction:column;align-items:center;gap:2px;color:var(--line);}
  .st-result-stars div.on {color:var(--warn);}
  .st-result-stars small {font-size:11px;color:var(--muted);}
  .st-star {font-size:3rem;line-height:1;}
  .st-result-stars .on .st-star {animation:st-pop .6s cubic-bezier(.2,.9,.3,1.3) both;animation-delay:var(--d);}
  @keyframes st-pop {0% {transform:scale(0) rotate(-30deg);opacity:0;} 70% {transform:scale(1.25) rotate(6deg);opacity:1;} 100% {transform:scale(1) rotate(0);}}
  @media (prefers-reduced-motion: reduce) {.st-result-stars .on .st-star {animation:none;}}
  .st-actions {display:flex;gap:8px;}
  .st-actions .btn {flex:1;min-height:48px;}
  .st-rank li {display:grid;grid-template-columns:32px 1fr auto;column-gap:10px;align-items:center;padding:10px 0;border-top:1px solid var(--line);}
  .st-rank small {grid-column:2;}
  .st-rank li > .st-num:last-child {grid-row:1 / span 2;grid-column:3;font-size:1.2rem;}
</style>
