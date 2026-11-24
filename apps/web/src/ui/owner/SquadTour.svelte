<script lang="ts">
  // T-11-825 원정 투어(내 구단 화면 '원정 투어' 칸으로 연다, T-11-826부터 전용 화면). 열 때 투어 홈과 내 팀(선수 목록, 1분 메모)만 받는다. 사다리 · 제한 ·
  // 자동 편성은 contracts 계산이라 따로 부르지 않는다. 여정 지도 → 편성(상대 분석 · 선발 · 교체 명단 · 전술) → 작전 경기(30분 ·
  // 60분 작전 타임) → 결과. 주간 순위는 탭을 열 때만 받는다. 그라운드 · 선수 카드는 팀 화면의 것을 그대로 쓴다.
  // 경기는 서버가 30분씩 계산해 돌려주고, 화면은 그 30분을 시계와 함께 다시 보여 준다(골 순간에 멈춘다). 감속 모션이면 바로 결과를 보여 준다.
  import { onDestroy, tick } from 'svelte';
  import CountUp from '../CountUp.svelte';
  import { go } from '../nav.js';
  import { goBack } from '../history.svelte.js';
  import { buzz, motionOK } from '../motion.js';
  import TeamPitch from '../team/TeamPitch.svelte';
  import MatchGround from '../team/MatchGround.svelte';
  import TourLineup from './TourLineup.svelte';
  import PlayerCard from '../team/PlayerCard.svelte';
  import ClubBadge from '../ClubBadge.svelte';
  import type { TeamPlayer } from '@offside/app-core/api/team';
  import { fetchOwnerTeam } from '@offside/app-core/api/team';
  import { fetchTour, fetchTourHistory, fetchTourRanking, orderTourMatch, startTourMatch } from '@offside/app-core/api/tour';
  import type { TourHistoryResponse, TourMatchView, TourRankingResponse, TourStage, TourStateResponse } from '@offside/contracts';
  import { FORMATIONS, FORMATION_IDS, type FormationId } from '@offside/contracts/owner-team';
  import { TOUR_TRIES_PER_DAY } from '@offside/contracts/squad-tour';
  import {
    TOUR_LIVE,
    TOUR_MAIN_STAGES,
    TOUR_TACTICS,
    tourAutoDraft,
    tourCells,
    tourChances,
    tourEdge,
    tourOppClub,
    tourPicks,
    tourRuleText,
    tourSpan,
    tourStageName,
    tourStageState,
    tourTacticDesc,
    tourTacticName,
    tourTired,
    tourWeekLabel,
    tourWeekLeft,
    type TourDraft,
    type TourTactic,
  } from '@offside/app-core/tour';
  import { tourGroundNames, tourGroundPlay, tourOppShare, tourSegmentLines } from '@offside/app-core/tourGround';
  import { groundBall, groundLineWaitMs, groundSpots, type GroundPlay, type GroundPlayer, type GroundPose, type Pt } from '@offside/app-core/matchGround';
  import { MOMENTUM_START, momentumAfter, momentumDecay, type LiveLine } from '@offside/app-core/teamLive';
  import { marketName } from '@offside/app-core/market';
  import { fmtValue } from '@offside/contracts/market-value';
  import { localCareerNames } from '@offside/game/hof-store';
  import { tourText as L } from '@offside/app-core/i18n/ko/tour';
  import { playSfx } from '../sfx.js';

  const local = localCareerNames();

  type View = 'map' | 'prep' | 'live' | 'result' | 'rank' | 'history';
  let view = $state<View>('map');
  let tour = $state<TourStateResponse | null>(null);
  let players = $state<TeamPlayer[]>([]);
  let myName = $state<string>(L.mySide);
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
    if (team.data.team?.name) myName = team.data.team.name;
    if (!draftFormation && team.data.team) draftFormation = team.data.team.formation;
    if (t.data.live) {
      match = t.data.live;
      clock = t.data.live.done * SEG;
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
  function openStage(s: TourStage) {
    if (!tour) return;
    stage = s;
    justWon = null;
    draft = tourAutoDraft(s, picks, tour.season, draftFormation ?? '4-3-3');
    error = '';
    view = 'prep';
  }
  function setFormation(f: FormationId) {
    if (!tour || !stage || !draft) return;
    draftFormation = f;
    draft = { ...tourAutoDraft(stage, picks, tour.season, f), tactic: draft.tactic };
  }
  function auto() {
    if (!tour || !stage || !draft) return;
    draft = { ...tourAutoDraft(stage, picks, tour.season, draft.formation), tactic: draft.tactic };
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
    match = r.data.match;
    if (tour) tour = { ...tour, triesLeft: r.data.triesLeft };
    resetOrder();
    view = 'live';
    void playSegment();
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
  const liveOpp = $derived(tourOppClub(liveStage));
  const oppName = $derived(liveOpp?.name ?? L.oppSide);
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
    // 끝난 경기면 진행 · 순위 · 별이 바뀌었다(지시 요청이 메모를 비웠다). 재생하는 동안 받아 둔다.
    if (match.status !== 'live') void fetchTour().then((t) => t.ok && (tour = t.data));
    void playSegment();
  }

  // ── 경기 재생 ── 방금 계산된 30분을 시계와 말판으로 다시 보여 준다(랭크 경기 문자중계와 같은 2D 그라운드). 서버는 골만 주므로
  // 그 사이 기회 · 선방 줄은 화면이 채운다. 골이 난 분에는 빌드업부터 골까지 움직임을 보여 주고 그 사이 점수를 올린다.
  type Goal = TourMatchView['events'][number];
  const SEG = 90 / TOUR_LIVE.segments;
  const MIN_MS = 210;
  let playing = $state(false);
  let kickoff = $state(false);
  let clock = $state(0);
  let banner = $state<Goal | null>(null);
  // 골 장면 도중에 점수가 올라간다.
  let scored = $state(false);
  let run = 0;
  /** 그라운드: 22명의 기본 자리, 지금 자세 · 전환 시간 · 골까지 공이 지난 길, 흐름, 지금 중계 줄. */
  let gPlayers = $state.raw<readonly GroundPlayer[]>([]);
  let gPose = $state.raw<GroundPose | null>(null);
  let gDur = $state(700);
  let gTrail = $state.raw<readonly Pt[]>([]);
  let momentum = $state(MOMENTUM_START);
  let line = $state<LiveLine | null>(null);
  let gTimers: ReturnType<typeof setTimeout>[] = [];
  const spots = $derived(groundSpots(gPlayers, gPose, momentum));
  const ball = $derived(groundBall(gPose, momentum));
  const groundNames = $derived(match ? tourGroundNames(match.slotIds, nameOf, liveStage?.players) : null);
  function stopGround() {
    for (const t of gTimers) clearTimeout(t);
    gTimers = [];
  }
  const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  onDestroy(() => {
    run++;
    stopGround();
  });
  function endSegment() {
    stopGround();
    playing = false;
    kickoff = false;
    banner = null;
    line = null;
    gPose = null;
    gTrail = [];
    if (!match) return;
    clock = match.done * SEG;
    if (match.status === 'live') return playSfx('whistle');
    if (match.status === 'won') justWon = match.stage;
    playSfx(match.status === 'won' ? 'trophy' : 'fulltime');
    view = 'result';
  }
  /** 줄 하나의 움직임을 total(ms) 안에 차례로 보여 준다. */
  function playLine(g: GroundPlay, l: LiveLine, total: number, id: number) {
    stopGround();
    const steps = g.line(l, total);
    const trail = g.trail;
    for (const st of steps) {
      gTimers.push(
        setTimeout(() => {
          if (id !== run) return;
          gPose = st.pose;
          gDur = Math.min(900, st.dur);
          gTrail = st.pose.goal ? trail : [];
        }, st.at),
      );
    }
  }
  async function playSegment() {
    if (!match) return;
    const id = ++run;
    const to = match.done * SEG;
    const from = to - SEG;
    const stg = tour?.stages.find((s) => s.stage === match!.stage);
    if (!motionOK || !stg) return endSegment();
    const g = tourGroundPlay(match, stg.formation);
    const mine = liveCells.length ? liveCells.reduce((a, c) => a + c.rating, 0) / liveCells.length : stg.opp;
    const lines = tourSegmentLines(match, { opp: oppName, mine: myName }, (pid, fallback) => (pid ? nameOf(pid) : fallback), tourOppShare(stg.opp, mine));
    const goals = match.events.filter((e) => e.minute > from && e.minute <= to);
    let goalNo = 0;
    gPlayers = g.players;
    gPose = null;
    gTrail = [];
    momentum = MOMENTUM_START;
    line = null;
    playing = true;
    clock = from;
    if (from === 0) {
      kickoff = true;
      playSfx('found');
      await wait(1500);
      if (id !== run) return;
      kickoff = false;
    }
    for (let m = from + 1; m <= to; m++) {
      await wait(MIN_MS);
      if (id !== run) return;
      clock = m;
      if (g.settle()) {
        gPose = null;
        gTrail = [];
      }
      momentum = momentumDecay(momentum);
      for (const l of lines.filter((x) => x.minute === m)) {
        const total = groundLineWaitMs(l.kind);
        line = l;
        momentum = momentumAfter(momentum, l);
        playLine(g, l, total, id);
        const goal = l.kind === 'goal' ? goals[goalNo++] : undefined;
        if (goal) {
          scored = false;
          banner = goal;
          playSfx(goal.side === 'away' ? 'good' : 'bad');
          buzz(goal.side === 'away' ? 30 : 10);
          await wait(700);
          if (id !== run) return;
          scored = true;
          await wait(total - 700);
        } else await wait(total);
        if (id !== run) return;
        banner = null;
      }
    }
    await wait(400);
    if (id === run) endSegment();
  }
  function skip() {
    run++;
    endSegment();
  }
  // 재생 중에는 시계까지 난 골만 센다. home이 상대(AI), away가 나다.
  const shown = $derived.by(() => {
    if (!match) return { mine: 0, opp: 0, events: [] as Goal[] };
    if (!playing) return { mine: match.goalsFor, opp: match.goalsAgainst, events: match.events };
    const events = match.events.filter((e) => e.minute < clock || (e.minute === clock && (banner !== e || scored)));
    return { mine: events.filter((e) => e.side === 'away').length, opp: events.filter((e) => e.side === 'home').length, events };
  });
  // ── 여정 지도 ── 방금 이긴 경기에는 도장이 찍히고 다음 경기가 열린다(한 번). 지도에 들어오면 다음 경기로 내려간다.
  let justWon = $state<number | null>(null);
  let mapEl = $state<HTMLElement>();
  async function toMap() {
    view = 'map';
    await tick();
    mapEl?.querySelector('[data-state="next"]')?.scrollIntoView({ block: 'center', behavior: motionOK ? 'smooth' : 'auto' });
  }
  function back() {
    if (view === 'map') return goBack(() => go('owner'));
    void toMap();
  }
  const goalText = (e: TourMatchView['events'][number]) =>
    e.side === 'away' ? (e.scorerId ? nameOf(e.scorerId) : e.scorer) : liveOpp ? e.scorer : L.oppGoal;

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
  // 주간 참여 기록도 열 때만 받는다.
  let history = $state<TourHistoryResponse | null>(null);
  let historyFailed = $state(false);
  async function openHistory() {
    view = 'history';
    historyFailed = false;
    const r = await fetchTourHistory();
    if (r.ok) history = r.data;
    else historyFailed = true;
  }
  const nextStage = $derived(tour ? (tour.stages.find((s) => s.stage === tour!.cleared + 1) ?? null) : null);
</script>

<div class="wrap">
  <div class="stack st" class:st-dark={view === 'live' || view === 'result'} data-squad-tour data-view={view} aria-busy={busy}>
    <div class="st-head">
      {#if !playing}<button class="btn btn-sm st-icon" data-act="tour-back" aria-label={L.back} onclick={back}>‹</button>{/if}
      <h1>{view === 'rank' ? L.rankingTitle : view === 'history' ? L.historyTitle : stage && view === 'prep' ? tourStageName(stage.stage) : match && (view === 'live' || view === 'result') ? tourStageName(match.stage) : L.title}</h1>
      {#if playing}<button class="btn btn-sm st-ghost" data-act="tour-skip" onclick={skip}>{L.skip}</button>{/if}
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
          <span class="st-band-acts">
            <button class="btn btn-sm st-ghost" data-act="tour-history" onclick={() => void openHistory()}>{L.historyTitle}</button>
            <button class="btn btn-sm st-ghost" data-act="tour-rank" onclick={() => void openRank()}>{L.rankingTitle}</button>
          </span>
        </div>
        <div class="st-stats">
          <div><small>{L.score}</small><b class="st-num">{tour.score}</b></div>
          <div><small>{L.rankingTitle}</small><b class="st-num">{tour.rank ? L.rank({ n: tour.rank }) : L.rankNone}</b></div>
          <div><small>{L.starsOf({ n: totalStars, max: TOUR_MAIN_STAGES * 3 })}</small><b class="st-num st-gold">★ {totalStars}</b></div>
        </div>
        <span data-tour-tries>{L.triesLeft({ n: tour.triesLeft, max: TOUR_TRIES_PER_DAY })}</span>
      </div>
      <p class="muted st-lead">{L.lead}</p>
      <ol class="st-map" data-tour-map bind:this={mapEl}>
        {#each tour.stages as s, k (s.stage)}
          {@const state = tourStageState(s, tour.cleared)}
          <li class="st-node {state}" class:fresh={justWon === s.stage} class:unlock={justWon !== null && justWon + 1 === s.stage} style:--i={k} data-tour-stage={s.stage} data-state={state}>
            <div class="st-badge st-num">{state === 'done' ? '✓' : s.stage}</div>
            <div class="stack st-node-body">
              <div class="st-node-top">
                <b>{tourStageName(s.stage)}</b>
                <span class="st-stars" aria-label={L.starsOf({ n: s.stars, max: 3 })}>{'★'.repeat(s.stars)}<i>{'★'.repeat(3 - s.stars)}</i></span>
              </div>
              {#if tourOppClub(s)}{@const o = tourOppClub(s)!}<span class="st-club" data-tour-club><ClubBadge club={o.club} size={20} />{o.name}</span>{/if}
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
              {#if justWon !== null && justWon + 1 === s.stage}<small class="st-fee st-unlocked" data-tour-unlocked>{L.unlocked}</small>{/if}
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
        {#if tourOppClub(stage)}{@const o = tourOppClub(stage)!}<span class="st-club" data-tour-club><ClubBadge club={o.club} size={24} />{o.name}</span>{/if}
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
      <TourLineup bind:draft {stage} {picks} season={tour.season} {byId} {nameOf} />
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
      {@const over = match.status !== 'live' && !playing}
      <div class="stack st-stage" class:goal={banner?.side === 'away'} class:conceded={banner?.side === 'home'} data-tour-match data-status={match.status} data-done={match.done} data-tour-playing={playing ? '' : undefined}>
        <div class="st-band-top">
          <span>{liveStage ? L.fee({ v: fmtValue(liveStage.fee) }) : ''}</span>
          <span class="st-gold st-live" class:on={playing} data-tour-clock>{over ? (match.status === 'won' ? L.winTitle : L.loseTitle) : playing ? L.minute({ n: clock }) : `${L.minute({ n: span.from })} · ${L.timeout}`}</span>
        </div>
        <div class="st-board">
          <div class="st-side">{#if liveOpp}<b class="st-club" data-tour-club><ClubBadge club={liveOpp.club} size={20} />{liveOpp.name}</b>{/if}<small>{liveStage ? `${L.oppOvr({ n: liveStage.opp })} · ${liveStage.formation}` : ''}</small></div>
          <div class="st-score st-num" data-tour-score>{#key shown.opp}<span class="st-digit">{shown.opp}</span>{/key} : {#key shown.mine}<span class="st-digit mine">{shown.mine}</span>{/key}</div>
          <div class="st-side right"><b>{myName}</b><small>{L.vsAway} · {match.formation}</small></div>
        </div>
        <div class="st-clock" aria-hidden="true"><i style:width="{Math.min(100, ((playing ? clock : match.done * SEG) / 90) * 100)}%"></i>{#each [1, 2] as n (n)}<u style:left="{(n * 100) / TOUR_LIVE.segments}%"></u>{/each}</div>
        <div class="st-call">
          {#if kickoff}
            <div class="st-flash" data-tour-kickoff><b>{L.kickoff}</b></div>
          {:else if banner}
            <div class="st-flash" class:bad={banner.side === 'home'} role="status" data-tour-goal>
              <b>{banner.side === 'away' ? L.goalMine : L.goalOpp}</b>
              <span>{banner.minute}' {goalText(banner)}{#if banner.side === 'away' && banner.assist} · {L.assist({ name: banner.assistId ? nameOf(banner.assistId) : banner.assist })}{/if}</span>
            </div>
          {:else if playing && line}
            {#key line}<small class="st-line" data-tour-line>{line.minute}' {line.text}</small>{/key}
          {:else}
            <small>{L.oppNow({ name: tourTacticName(match.oppTactic) })} · {tourTacticName(match.tactic)}</small>
          {/if}
        </div>
      </div>
      {#if playing}
        <div class="st-ground" data-tour-ground>
          <MatchGround {spots} {ball} dur={gDur} goal={gPose?.goal ?? null} trail={gTrail} names={groundNames} gold="away" home={oppName} away={myName} />
        </div>
      {/if}
      <ul class="st-events" data-tour-events>
        {#each shown.events as e, k (k)}
          <li class:mine={e.side === 'away'}><span class="st-num">{e.minute}'</span><span>{goalText(e)}{#if e.side === 'away' && e.assist} · {L.assist({ name: e.assistId ? nameOf(e.assistId) : e.assist })}{/if}</span></li>
        {:else}
          {#if !playing}<li class="muted">{L.noGoals}</li>{/if}
        {/each}
      </ul>
      {#if playing}
        <span></span>
      {:else if !over}
        <div class="stack st-talk" data-tour-talk>
        <b>{L.timeout}</b>
        <small class="muted">{L.timeoutLead}</small>
        <div class="st-tactics" role="radiogroup" aria-label={L.timeout}>
          {#each chances as c (c.tactic)}
            <button class="st-tactic" class:on={orderTactic === c.tactic} role="radio" aria-checked={orderTactic === c.tactic} data-tour-tactic={c.tactic} onclick={() => (orderTactic = c.tactic)}>
              <b>{tourTacticName(c.tactic)}{#if c.tactic === match.tactic}<small class="st-now">{L.now}</small>{/if}</b>
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
        <div class="st-bench-row" data-tour-live-bench>
          {#each benchLeft as id (id)}
            {@const p = byId.get(id)}
            {#if p}
              <button class="st-opt" class:on={outSlot !== null} aria-disabled={outSlot === null} data-tour-sub-in={id} onclick={() => pickIn(id)}>
                <PlayerCard player={p} name={marketName(p, local)} rating={p.peak} role={outSlot !== null ? FORMATIONS[match.formation][outSlot]! : (p.dpos ?? FORMATIONS[match.formation][0]!)} compact />
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
        </div>
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
              <div><small>{L.scoreGot}</small><b class="st-num">+<CountUp value={match.result.score} ms={900} /></b></div>
            </div>
            {#if nextStage}<p class="st-next st-gold" data-tour-next-open>{L.unlocked}</p>{/if}
          {:else}
            <p class="muted">{L.loseHint}</p>
          {/if}
        {/if}
        <div class="st-actions">
          <button class="btn" data-act="tour-map" onclick={() => void toMap()}>{L.toMap}</button>
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
    {:else if view === 'history'}
      <small class="muted">{L.historyLead}</small>
      {#if historyFailed}
        <p class="muted">{L.historyFail}</p>
      {:else if !history}
        <p class="muted">{L.loading}</p>
      {:else if !history.rows.length}
        <p class="muted" data-tour-history-empty>{L.historyEmpty}</p>
      {:else}
        <ol class="st-rank st-history" data-tour-history>
          {#each history.rows as r (r.week)}
            <li data-week={r.week}>
              <span class="st-num">{r.rank ?? '–'}</span>
              <b>{tourWeekLabel(r.week, history.week)}</b>
              <small class="muted">{L.rankingCleared({ n: r.cleared })} · ★ {r.stars} · {L.historyTries({ n: r.tries })}{r.fee ? ` · ${L.fee({ v: fmtValue(r.fee) })}` : ''}</small>
              <span class="st-num">{r.score}</span>
            </li>
          {/each}
        </ol>
      {/if}
    {/if}
  </div>
</div>

<style>
  .st {gap:12px;padding:8px 0 calc(24px + env(safe-area-inset-bottom));min-height:100dvh;box-sizing:border-box;}
  /* 경기 · 결과는 경기장 조명 아래처럼 어두운 무대에서 본다. */
  .st {--st-night:color-mix(in srgb, var(--pitch) 42%, #000);}
  .st-dark {margin-inline:calc(-1 * var(--pad-l)) calc(-1 * var(--pad-r));padding-inline:var(--pad-l) var(--pad-r);background:var(--st-night);color:var(--on-pitch);}
  .st.st-dark :global(.muted),.st.st-dark .st-result-stars small {color:var(--on-pitch);opacity:.88;}
  .st-dark .st-icon,.st-dark .btn:not(.btn-primary) {background:transparent;border-color:var(--chalk);color:var(--on-pitch);}
  .st-dark .st-events li.mine,.st-dark .st-good {color:var(--pitch-accent);}
  .st-dark .st-bad {color:color-mix(in srgb, var(--bad) 40%, #fff);}
  .st-dark .st-tactic,.st-dark .st-opt,.st-dark .st-sub {background:rgb(255 255 255 / .06);border-color:var(--chalk);color:var(--on-pitch);}
  .st-dark .st-tactic.on,.st-dark .st-opt.on {border-color:var(--pitch-accent);}
  .st-dark .st-cta {box-shadow:0 0 0 12px var(--st-night);}
  .st-dark .st-result-stars {padding:16px 0;background:radial-gradient(closest-side at 50% 45%, color-mix(in srgb, var(--pitch-accent) 22%, transparent), transparent);}
  .st-dark .st-result-stars div {color:rgb(255 255 255 / .22);}
  .st-dark .st-result-stars div.on {color:var(--pitch-accent);text-shadow:0 0 16px color-mix(in srgb, var(--pitch-accent) 55%, transparent);}
  .st-dark .st-result-stars small {text-shadow:none;opacity:.9;}
  :global(body:has(.st-dark)) {background:color-mix(in srgb, var(--pitch) 42%, #000);}
  .st-head {display:flex;align-items:center;gap:8px;}
  .st-head {min-height:44px;}
  .st-head h1 {flex:1;margin:0;font-size:1.2rem;}
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
  /* 잠긴 경기는 흐리게 하지 않는다(글자 대비). 점선 테두리와 옅은 배경으로 구분한다. */
  .st-node.locked .st-node-body {border-style:dashed;background:var(--surface-2);}
  .st-node.locked .st-fee {color:var(--muted);}
  .st-node-top {display:flex;justify-content:space-between;align-items:center;gap:8px;}
  .st-stars {color:var(--warn);letter-spacing:2px;}
  .st-stars i {font-style:normal;color:var(--line);}
  .st-rule {display:inline-flex;align-self:flex-start;align-items:center;min-height:26px;padding:0 10px;border-radius:999px;border:1px solid var(--line);background:var(--surface-2);font-size:12px;font-weight:700;}
  .st-fee {color:var(--accent-text);font-weight:700;}
  .st-info {margin:0;padding-left:18px;font-size:12px;display:flex;flex-direction:column;gap:4px;}
  .st-card {gap:6px;padding:14px;border-radius:var(--radius-md);border:1px solid var(--line);background:var(--surface);}
  .st-tools {display:flex;justify-content:space-between;align-items:center;gap:8px;}
  .st-row {display:flex;gap:8px;}
  .st-row .btn,.st-tools .btn {min-height:44px;white-space:nowrap;}
  /* 작전 타임 교체 명단: 편성 화면의 교체 명단과 같은 다섯 칸. */
  .st-bench-row {display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;}
  .st-bench-row:empty {display:none;}
  .st-bench-row .st-opt {min-width:0;padding:4px;}
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
  /* 아래에 붙는 버튼은 뒤 내용이 비치지 않게 창 배경색 띠를 두른다. */
  .st-cta {min-height:52px;margin-top:12px;position:sticky;bottom:calc(12px + env(safe-area-inset-bottom));box-shadow:0 0 0 12px var(--bg);}
  .st-stage {position:relative;gap:10px;padding:16px;border-radius:var(--radius-md);background:radial-gradient(120% 90% at 50% -20%, color-mix(in srgb, var(--pitch) 70%, #fff) 0%, var(--pitch) 60%);color:var(--on-pitch);overflow:hidden;}
  .st-stage.goal {animation:st-glow 1.9s ease-out both;}
  .st-stage.conceded {animation:st-shake .5s ease-out both;}
  .st-board {display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:12px;}
  .st-club {display:inline-flex;align-items:center;gap:6px;font-weight:700;min-width:0;}
  .st-side {min-width:0;display:flex;flex-direction:column;gap:2px;font-size:13px;}
  .st-side.right {align-items:flex-end;}
  .st-side small {font-size:11px;opacity:.8;}
  .st-score {font-size:3.4rem;line-height:1;text-align:center;}
  .st-digit {display:inline-block;animation:st-tick .45s cubic-bezier(.2,.9,.3,1.3) both;}
  .st-digit.mine {color:var(--pitch-accent);}
  .st-clock {position:relative;height:6px;border-radius:999px;background:rgb(255 255 255 / .2);}
  .st-clock i {position:absolute;inset:0 auto 0 0;border-radius:999px;background:var(--pitch-accent);transition:width .2s linear;}
  .st-clock u {position:absolute;top:-3px;width:2px;height:12px;background:var(--on-pitch);opacity:.7;}
  /* 점수판 아래 한 줄: 평소엔 전술, 킥오프 · 골 순간엔 장면 문구가 같은 자리에 뜬다(점수판은 그대로 보인다). */
  .st-call {min-height:76px;display:flex;align-items:center;justify-content:center;text-align:center;}
  .st-line {font-size:14px;line-height:1.45;animation:st-in .25s ease-out both;}
  /* 말판과 이름표가 겹치지 않게 랭크 경기보다 조금 높게 그린다. */
  .st-ground :global(.mg-field) {aspect-ratio:105/80;}
  .st-ground :global(.mg-dir) {color:var(--on-pitch);opacity:.75;}
  .st-flash {display:flex;flex-direction:column;align-items:center;gap:4px;animation:st-in .25s ease-out both;}
  .st-flash b {font-family:var(--display);font-size:2.8rem;font-style:italic;font-weight:900;line-height:1;color:var(--pitch-accent);text-shadow:0 0 18px color-mix(in srgb, var(--pitch-accent) 60%, transparent);animation:st-pop .6s cubic-bezier(.2,.9,.3,1.3) both;}
  .st-live.on::before {content:'';display:inline-block;width:8px;height:8px;margin-right:6px;border-radius:50%;background:#ff5a4d;animation:st-blink 1s ease-in-out infinite;}
  .st-now {margin-left:6px;padding:1px 6px;border-radius:999px;border:1px solid currentColor;font-size:11px;font-weight:700;opacity:.85;}
  .st-events .st-num {color:var(--pitch-accent);font-size:1rem;line-height:1.2;}
  @keyframes st-blink {0%,100% {opacity:1;} 50% {opacity:.25;}}
  .st-flash.bad b {color:var(--on-pitch);text-shadow:none;}
  .st-flash span {font-size:17px;font-weight:700;}
  .st-talk {gap:12px;animation:st-rise .45s ease-out both;}
  .st-next {margin:0;text-align:center;font-weight:700;animation:st-rise .5s ease-out 1.4s both;}
  .st-gain {animation:st-rise .5s ease-out 1s both;}
  @keyframes st-in {from {opacity:0;} to {opacity:1;}}
  @keyframes st-rise {from {opacity:0;transform:translateY(14px);} to {opacity:1;transform:none;}}
  @keyframes st-tick {0% {transform:scale(1.7);} 100% {transform:scale(1);}}
  @keyframes st-glow {0% {box-shadow:0 0 0 0 var(--pitch-accent);} 30% {box-shadow:0 0 0 6px var(--pitch-accent);} 100% {box-shadow:0 0 0 0 transparent;}}
  @keyframes st-shake {0%,100% {transform:none;} 25% {transform:translateX(-5px);} 75% {transform:translateX(5px);}}
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
  /* 여정 지도: 들어올 때 한 칸씩 차례로, 방금 이긴 경기에는 도장이 찍히고 다음 경기가 열린다. */
  .st-node {animation:st-rise .35s ease-out both;animation-delay:calc(var(--i, 0) * 45ms);}
  .st-node.fresh .st-badge {animation:st-pop .6s cubic-bezier(.2,.9,.3,1.3) .3s both;}
  .st-node.unlock .st-node-body {animation:st-open 1.1s ease-out .7s both;}
  .st-unlocked {animation:st-rise .4s ease-out 1s both;}
  .st-node.next .st-badge {animation:st-beat 1.6s ease-in-out 3;}
  @keyframes st-open {0% {box-shadow:0 0 0 0 var(--accent-text);} 40% {box-shadow:0 0 0 5px var(--accent-text);} 100% {box-shadow:0 0 0 0 transparent;}}
  @keyframes st-beat {0%,100% {transform:none;} 50% {transform:scale(1.12);}}
  @media (prefers-reduced-motion: reduce) {
    .st *,.st {animation:none !important;transition:none !important;}
  }
  .st-actions {display:flex;gap:8px;}
  .st-actions .btn {flex:1;min-height:48px;}
  .st-rank li {display:grid;grid-template-columns:32px 1fr auto;column-gap:10px;align-items:center;padding:10px 0;border-top:1px solid var(--line);}
  .st-rank small {grid-column:2;}
  .st-band-acts {display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;}
  .st-rank li > .st-num:last-child {grid-row:1 / span 2;grid-column:3;font-size:1.2rem;}
</style>
