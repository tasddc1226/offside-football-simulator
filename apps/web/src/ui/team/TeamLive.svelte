<script lang="ts">
  import TeamLogo from './TeamLogo.svelte';
  import PopSheet from '../PopSheet.svelte';
  import { teamLiveText as L } from '@offside/app-core/i18n/ko/teamLive';
  import { teamMomentsText as M } from '@offside/app-core/i18n/ko/teamMoments';
  // T-10-097 팀 경기 문자중계 — 한 화면에서 시계가 0'부터 90'+까지 흐르며 중계 줄이 하나씩 올라온다. 골이 가까우면
  // 시계가 느려지고, 골이 들어가면 전광판이 번쩍인다. 결과는 이미 서버가 정했고 여기서는 보여 주기만 한다.
  // 감속 모션이어도 진행 템포는 그대로 두고(읽는 시간) 움직임 효과만 뺀다. '결과 바로 보기'로 언제든 끝낼 수 있다.
  // T-11-387 장면 경기(live)면 장면 분에 시계를 멈추고 선택지 카드를 띄운다. 고르면 서버가 결과를 정하고, 그 골이 중계에
  // 끼어든다. 제한 시간이 지나거나 '결과 바로 보기'를 누르면 남은 장면은 감독에게 맡긴다.
  import { onDestroy, onMount } from 'svelte';
  import {
    chooseMoment,
    finishLiveMatch,
    type PlayTeamMatchResponse,
    type TeamLive,
    type TeamMatch,
    type TeamMoment,
  } from '@offside/app-core/api/team';
  import {
    FLASH_MS,
    MOMENTUM_START,
    PHASE_LABEL,
    clockText,
    lineWaitMs,
    liveScript,
    momentumAfter,
    momentumDecay,
    playbackPlan,
    waitMs,
    type LiveLine,
    type LivePhase,
  } from '@offside/app-core/teamLive';
  import {
    LiveScore,
    liveSkipLabel,
    momentChoices,
    momentLines,
    momentScene,
    momentTimerSpoken,
    momentTitle,
  } from '@offside/app-core/teamMoments';

  let {
    match,
    name,
    onend,
    neutral = false,
    live,
    onfinal,
  }: {
    match: TeamMatch;
    name: (id: string | null, fallback: string) => string;
    onend: () => void;
    /** 내 팀이 없는 경기(컵 공개 경기) — 내 팀 강조 없이 그린다. */
    neutral?: boolean;
    /** T-11-387 고를 장면(장면 경기를 막 시작했을 때만). */
    live?: TeamLive | undefined;
    /** 장면 경기가 끝났을 때의 결과(스코어 · 기록 · 레이팅). */
    onfinal?: ((r: PlayTeamMatchResponse) => void) | undefined;
  } = $props();

  // 경기 하나에 한 번 만든다(부모가 경기마다 {#key}로 새로 그린다).
  // svelte-ignore state_referenced_locally
  const script = liveScript(match, name, { neutral });
  // svelte-ignore state_referenced_locally
  const moments: TeamMoment[] = live?.moments ?? [];
  // svelte-ignore state_referenced_locally
  const choiceSec = live?.choiceSec ?? 15;
  const plan = playbackPlan(
    script,
    moments.map((m) => m.minute),
  );
  // svelte-ignore state_referenced_locally
  const tally = live ? new LiveScore(match, neutral) : null;

  let shown = $state<{ k: number; l: LiveLine }[]>([]);
  let seq = 0;
  let clock = $state(0);
  let extra = $state(0);
  let phase = $state<LivePhase>('1st');
  let score = $state<[number, number]>([0, 0]);
  let flash = $state<'home' | 'away' | null>(null);
  /** 경기 흐름(0 = 원정 쪽이 몰아침, 1 = 홈 쪽이 몰아침). */
  let momentum = $state(MOMENTUM_START);
  let fast = $state(false);
  let alive = true;
  let flashTimer: ReturnType<typeof setTimeout> | undefined;

  /** 지금 고르는 장면과 남은 초. */
  let active = $state<{ m: TeamMoment; left: number } | null>(null);
  let sending = $state(false);
  let pick: ((choice: string | null) => void) | null = null;
  let countdown: ReturnType<typeof setInterval> | undefined;
  let final: PlayTeamMatchResponse | null = null;
  /** 판정을 받지 못하면 남은 장면은 건너뛰고 끝에서 마감한다. */
  let broken = false;
  /** T-11-443 아직 고르지 않은 장면 수('결과 바로 보기'가 감독에게 맡긴다는 걸 버튼에 적는다). */
  let pendingMoments = $state(moments.length);

  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, waitMs(ms, fast)));

  const scored = $derived(
    shown.map((x) => x.l).filter((l): l is LiveLine & { side: 'home' | 'away' } => l.kind === 'goal' && !!l.side),
  );
  const clockLabel = $derived(extra ? `${clock}+${extra}'` : `${clock}'`);
  const phaseLabel = $derived(PHASE_LABEL[phase]);
  const choices = $derived(active ? momentChoices(active.m, name) : []);

  function push(l: LiveLine) {
    shown = [{ k: seq++, l }, ...shown];
    momentum = momentumAfter(momentum, l);
    if (l.kind === 'goal' && l.score) {
      score = l.score;
      flash = l.side ?? null;
      clearTimeout(flashTimer);
      flashTimer = setTimeout(() => (flash = null), FLASH_MS);
    }
  }

  function show(i: number) {
    const l = script[i]!;
    push(tally ? tally.line(l) : l);
  }

  /** 장면 카드를 띄우고 고른 선택지(시간이 지나면 'auto', 경기를 끝내면 null)를 기다린다. */
  function ask(m: TeamMoment): Promise<string | null> {
    return new Promise((resolve) => {
      active = { m, left: choiceSec };
      pick = (choice) => {
        pick = null;
        clearInterval(countdown);
        resolve(choice);
      };
      countdown = setInterval(() => {
        if (!active) return;
        active = { ...active, left: active.left - 1 };
        if (active.left <= 0) pick?.('auto');
      }, 1000);
    });
  }

  async function moment(k: number) {
    const m = moments[k];
    if (!m || broken || !alive) return;
    const choice = await ask(m);
    pendingMoments = moments.length - k - 1;
    if (choice === null || !alive) return;
    sending = true;
    const r = await chooseMoment(match.id, m.index, choice);
    sending = false;
    active = null;
    if (!r.ok) {
      broken = true;
      pendingMoments = 0;
      push({ minute: m.minute, kind: 'moment', text: M.failed });
      return;
    }
    if (r.data.final) final = r.data.final;
    for (const l of momentLines(r.data.moment, r.data.goals, name, tally!)) {
      if (!alive) return;
      push(l);
      await sleep(lineWaitMs(l.kind));
    }
  }

  // 순서·대기 시간은 app-core playbackPlan이 정한다. 여기서는 단계마다 상태를 반영하고 기다린다.
  async function run() {
    for (const step of plan) {
      if (!alive) return;
      if (step.clock !== undefined) clock = step.clock;
      if (step.extra !== undefined) extra = step.extra;
      if (step.moment !== undefined) await moment(step.moment);
      if (step.show !== undefined) show(step.show);
      if (step.phase) phase = step.phase;
      if (step.decay) momentum = momentumDecay(momentum);
      if (step.wait > 0) await sleep(step.wait);
    }
    void finish();
  }

  async function finish() {
    if (!alive) return;
    alive = false;
    pick?.(null);
    active = null;
    if (live && !final) {
      sending = true;
      const r = await finishLiveMatch(match.id);
      sending = false;
      if (r.ok) final = r.data;
    }
    if (final) onfinal?.(final);
    onend();
  }

  onMount(() => void run());
  onDestroy(() => {
    alive = false;
    clearTimeout(flashTimer);
    clearInterval(countdown);
  });
</script>

<section class="card tl" data-team-live aria-labelledby="tl-title">
  <h1 id="tl-title" class="sr-only">{L.title({ home: match.home.name, away: match.away.name })}</h1>
  <div class="tl-board" class:flash={!!flash}>
    <div class="tl-top">
      <span class="tl-live" class:done={phase === 'ft'}>{phase === 'ft' ? 'FT' : 'LIVE'}</span>
      <span class="tl-clock" data-live-clock>{clockLabel}</span>
      <span class="tl-phase">{phaseLabel}</span>
    </div>
    <div class="tl-score">
      <div class="tl-team" class:mine={!neutral && match.mine === 'home'} class:hit={flash === 'home'}>
        <TeamLogo logo={match.home.logo} name={match.home.name} size={40} decorative /><b>{match.home.name}</b><small>{match.home.owner}</small>
      </div>
      <div class="tl-goals" aria-live="polite" data-live-score>
        <b>{score[0]}</b><span aria-hidden="true">:</span><b>{score[1]}</b>
      </div>
      <div class="tl-team away" class:mine={!neutral && match.mine === 'away'} class:hit={flash === 'away'}>
        <TeamLogo logo={match.away.logo} name={match.away.name} size={40} decorative /><b>{match.away.name}</b><small>{match.away.owner}</small>
      </div>
    </div>
    <div class="tl-bar" aria-hidden="true">
      <div class="tl-fill" style:width="{Math.min(100, (clock / 90) * 100)}%"></div>
      <i class="tl-ht"></i>
      {#each scored as g, k (k)}
        <i class="tl-g" class:away={g.side === 'away'} style:left="{(g.minute / 90) * 100}%"></i>
      {/each}
    </div>
    <div class="tl-mom" aria-hidden="true">
      <span>{L.flow}</span>
      <div class="tl-mom-track"><div class="tl-mom-fill" style:width="{momentum * 100}%"></div></div>
    </div>
    {#if flash}
      <div class="tl-banner" aria-hidden="true">GOAL!</div>
    {/if}
  </div>

  {#if active}
    <!-- T-11-387 고를 장면은 아래에서 올라오는 시트로 띄운다. 고르거나 시간이 다 돼야 닫힌다(배경 누르기로 닫지 않는다). -->
    <PopSheet label={momentTitle(active.m)} step={`${active.m.index}`}>
      <div class="tl-moment" class:crisis={active.m.kind === 'crisis'} data-moment={active.m.situation}>
        <p class="tl-m-head">
          <b>{momentTitle(active.m)}</b>
          <span class="tl-m-score">{active.m.minute}' · {score[0]} : {score[1]}</span>
        </p>
        <p class="tl-m-scene">{momentScene(active.m, name)}</p>
        <p class="tl-m-ask">{M.ask} <small>{active.m.kind === 'chance' ? M.chancePct : M.crisisPct}</small></p>
        <div class="tl-m-choices">
          {#each choices as c (c.id)}
            <button class="tl-m-choice" disabled={sending} onclick={() => pick?.(c.id)} data-moment-choice={c.id}>
              <span class="tl-m-label">{c.label}</span>
              <b class="tl-m-pct">{M.pct({ p: c.pct })}</b>
              {#if c.tags.length}<small class="tl-m-tags">{c.tags.join(' · ')}</small>{/if}
            </button>
          {/each}
        </div>
        <div class="tl-m-timer" aria-hidden="true"><i style:width="{(active.left / choiceSec) * 100}%"></i></div>
        <!-- T-11-443 화면 글자는 매초 바뀌고, 스크린리더는 처음 안내와 마지막 몇 초만 읽는다. -->
        <p class="tl-m-hint" aria-hidden="true">{sending ? M.sending : M.timer({ s: active.left })}</p>
        <p class="sr-only" aria-live="polite" data-moment-spoken>{sending ? M.sending : momentTimerSpoken(active.left, choiceSec)}</p>
        <button class="btn tl-m-skip" disabled={sending} onclick={() => void finish()} data-act="moment-skip">{M.skipToManager}</button>
      </div>
    </PopSheet>
  {/if}

  <ol class="tl-feed">
    {#each shown as x (x.k)}
      {@const l = x.l}
      <li class="k-{l.kind}" class:away={l.side === 'away'} class:home={l.side === 'home'} data-live-line={l.kind}>
        <span class="tl-min">{clockText(l)}</span>
        <span>{l.text}</span>
      </li>
    {/each}
  </ol>

  <div class="tm-actions">
    <button class="btn" aria-pressed={fast} onclick={() => (fast = !fast)} data-act="live-fast">{fast ? L.speedNormal : L.speedFast}</button>
    <button class="btn btn-primary" disabled={sending} onclick={() => void finish()} data-act="live-skip">{liveSkipLabel(pendingMoments)}</button>
  </div>
</section>

<style>
  .tl {
    display: grid;
    gap: 12px;
  }
  .tl-board {
    position: relative;
    display: grid;
    gap: 10px;
    padding: 14px;
    border-radius: var(--radius-md);
    background: var(--pitch);
    color: var(--on-pitch);
    overflow: hidden;
  }
  .tl-board.flash {
    animation: tl-flash 0.9s ease-out;
  }
  .tl-top {
    display: flex;
    align-items: center;
    gap: 10px;
    font-family: var(--display);
    letter-spacing: 0.06em;
  }
  .tl-live {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 1px 8px;
    border-radius: var(--radius-pill);
    background: var(--bad);
    color: #fff;
    font-weight: 700;
    font-size: var(--fs-label);
  }
  .tl-live::before {
    content: '';
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: currentColor;
    animation: tl-pulse 1.2s ease-in-out infinite;
  }
  .tl-live.done {
    background: var(--chalk);
  }
  .tl-live.done::before {
    display: none;
  }
  .tl-clock {
    font-size: var(--fs-title1);
    font-weight: 700;
    color: var(--pitch-accent);
    font-variant-numeric: tabular-nums;
    min-width: 3.4em;
  }
  .tl-phase {
    margin-left: auto;
    font-size: var(--fs-body2);
    opacity: 0.85;
  }
  .tl-score {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 10px;
  }
  .tl-team {
    display: grid;
    gap: 2px;
    min-width: 0;
    transition: transform 0.3s ease;
  }
  .tl-team.away {
    text-align: right;
    justify-items: end;
  }
  .tl-team b {
    overflow-wrap: anywhere;
    line-height: 1.2;
  }
  .tl-team small {
    opacity: 0.75;
    font-size: var(--fs-caption);
  }
  .tl-team.mine b {
    color: var(--pitch-accent);
  }
  .tl-team.hit {
    transform: scale(1.06);
  }
  .tl-goals {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: var(--display);
    font-size: 2.6rem;
    font-weight: 800;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .tl-board.flash .tl-goals {
    animation: tl-bump 0.6s ease-out;
    color: var(--pitch-accent);
  }
  .tl-bar {
    position: relative;
    height: 6px;
    border-radius: 3px;
    background: var(--chalk);
  }
  .tl-fill {
    height: 100%;
    border-radius: 3px;
    background: var(--pitch-accent);
    transition: width 0.25s linear;
  }
  .tl-ht {
    position: absolute;
    left: 50%;
    top: -3px;
    width: 2px;
    height: 12px;
    background: var(--on-pitch);
    opacity: 0.6;
  }
  .tl-g {
    position: absolute;
    top: -4px;
    width: 10px;
    height: 10px;
    margin-left: -5px;
    border-radius: 50%;
    background: var(--on-pitch);
    box-shadow: 0 0 0 2px var(--pitch);
  }
  .tl-g.away {
    background: var(--pitch-accent);
  }
  .tl-mom {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--fs-caption);
    opacity: 0.85;
  }
  .tl-mom-track {
    flex: 1;
    height: 4px;
    border-radius: 2px;
    background: var(--pitch-accent);
    overflow: hidden;
  }
  .tl-mom-fill {
    height: 100%;
    background: var(--on-pitch);
    transition: width 0.6s ease;
  }
  .tl-banner {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    font-family: var(--display);
    font-size: 3.4rem;
    font-weight: 800;
    letter-spacing: 0.12em;
    color: var(--pitch-accent);
    text-shadow: 0 2px 12px rgba(0, 0, 0, 0.45);
    pointer-events: none;
    animation: tl-banner 1.8s ease-out forwards;
  }
  .tl-feed {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 6px;
    max-height: 22rem;
    overflow-y: auto;
  }
  .tl-feed li {
    display: grid;
    grid-template-columns: 3.4em 1fr;
    gap: 8px;
    padding: 6px 10px;
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    font-size: var(--fs-body2);
    line-height: 1.45;
    animation: tl-in 0.35s ease-out;
  }
  .tl-feed li.home {
    box-shadow: inset 3px 0 0 var(--pitch-2);
  }
  .tl-feed li.away {
    box-shadow: inset -3px 0 0 var(--accent);
  }
  .tl-feed li.k-goal {
    background: var(--pitch);
    color: var(--on-pitch);
    font-weight: 700;
  }
  .tl-feed li.k-goal .tl-min {
    color: var(--pitch-accent);
  }
  .tl-feed li.k-ht,
  .tl-feed li.k-ft,
  .tl-feed li.k-kickoff {
    font-weight: 700;
    background: transparent;
    border: 1px dashed var(--line);
  }
  .tl-feed li.k-moment {
    font-weight: 700;
    background: var(--surface);
    border: 1px solid var(--pitch-accent);
  }
  .tl-moment {
    display: grid;
    gap: 10px;
  }
  .tl-m-score {
    font-variant-numeric: tabular-nums;
    color: var(--muted);
  }
  .tl-m-skip {
    justify-self: center;
    min-height: 44px;
  }
  .tl-m-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin: 0;
    font-family: var(--display);
    letter-spacing: 0.04em;
  }
  .tl-m-head b {
    font-size: var(--fs-title3);
    color: var(--pitch-2);
  }
  .tl-moment.crisis .tl-m-head b {
    color: var(--bad);
  }
  .tl-m-scene,
  .tl-m-ask,
  .tl-m-hint {
    margin: 0;
    line-height: 1.5;
  }
  .tl-m-ask small,
  .tl-m-hint {
    color: var(--muted);
    font-size: var(--fs-label);
  }
  .tl-m-choices {
    display: grid;
    gap: 6px;
  }
  .tl-m-choice {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 2px 10px;
    min-height: 48px;
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    border: 1px solid transparent;
    background: var(--surface-2);
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .tl-m-choice:hover:not(:disabled),
  .tl-m-choice:focus-visible {
    border-color: var(--pitch-2);
  }
  .tl-m-choice:disabled {
    opacity: 0.6;
    cursor: default;
  }
  .tl-m-label {
    font-weight: 700;
  }
  .tl-m-pct {
    font-family: var(--display);
    font-size: var(--fs-title3);
    font-variant-numeric: tabular-nums;
  }
  .tl-m-tags {
    grid-column: 1 / -1;
    color: var(--muted);
    font-size: var(--fs-caption);
  }
  .tl-m-timer {
    height: 4px;
    border-radius: 2px;
    background: var(--line);
    overflow: hidden;
  }
  .tl-m-timer i {
    display: block;
    height: 100%;
    background: var(--pitch-2);
    transition: width 1s linear;
  }
  .tl-min {
    font-family: var(--display);
    font-weight: 700;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  @keyframes tl-pulse {
    50% {
      opacity: 0.3;
    }
  }
  @keyframes tl-flash {
    0% {
      box-shadow: inset 0 0 0 0 var(--pitch-accent);
    }
    30% {
      box-shadow: inset 0 0 0 4px var(--pitch-accent);
    }
    100% {
      box-shadow: inset 0 0 0 0 var(--pitch-accent);
    }
  }
  @keyframes tl-bump {
    40% {
      transform: scale(1.25);
    }
  }
  @keyframes tl-banner {
    0% {
      opacity: 0;
      transform: scale(0.6);
    }
    20% {
      opacity: 1;
      transform: scale(1.08);
    }
    75% {
      opacity: 1;
      transform: scale(1);
    }
    100% {
      opacity: 0;
    }
  }
  @keyframes tl-in {
    from {
      transform: translateY(-8px) scale(0.98);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .tl-board.flash,
    .tl-board.flash .tl-goals,
    .tl-feed li,
    .tl-live::before,
    .tl-banner {
      animation: none;
    }
    .tl-team,
    .tl-fill,
    .tl-m-timer i,
    .tl-mom-fill {
      transition: none;
    }
    .tl-team.hit {
      transform: none;
    }
  }
</style>
