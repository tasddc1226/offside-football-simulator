<script lang="ts">
  import TeamLogo from './TeamLogo.svelte';
  import { teamLiveText as L } from '@offside/app-core/i18n/ko/teamLive';
  // T-10-097 팀 경기 문자중계 — 한 화면에서 시계가 0'부터 90'+까지 흐르며 중계 줄이 하나씩 올라온다. 골이 가까우면
  // 시계가 느려지고, 골이 들어가면 전광판이 번쩍인다. 결과는 이미 서버가 정했고 여기서는 보여 주기만 한다.
  // 감속 모션이어도 진행 템포는 그대로 두고(읽는 시간) 움직임 효과만 뺀다. '결과 바로 보기'로 언제든 끝낼 수 있다.
  import { onDestroy, onMount } from 'svelte';
  import type { TeamMatch } from '@offside/app-core/api/team';
  import {
    FLASH_MS,
    MOMENTUM_START,
    PHASE_LABEL,
    clockText,
    liveScript,
    momentumAfter,
    momentumDecay,
    playbackPlan,
    waitMs,
    type LiveLine,
    type LivePhase,
  } from '@offside/app-core/teamLive';

  let {
    match,
    name,
    onend,
  }: {
    match: TeamMatch;
    name: (id: string | null, fallback: string) => string;
    onend: () => void;
  } = $props();

  // 경기 하나에 한 번 만든다(부모가 경기마다 {#key}로 새로 그린다).
  // svelte-ignore state_referenced_locally
  const script = liveScript(match, name);
  const plan = playbackPlan(script);

  let shown = $state<number[]>([]);
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

  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, waitMs(ms, fast)));

  const scored = $derived(
    shown.map((i) => script[i]!).filter((l): l is LiveLine & { side: 'home' | 'away' } => l.kind === 'goal' && !!l.side),
  );
  const clockLabel = $derived(extra ? `${clock}+${extra}'` : `${clock}'`);
  const phaseLabel = $derived(PHASE_LABEL[phase]);

  function show(i: number) {
    const l = script[i]!;
    shown = [i, ...shown];
    momentum = momentumAfter(momentum, l);
    if (l.kind === 'goal' && l.score) {
      score = l.score;
      flash = l.side ?? null;
      clearTimeout(flashTimer);
      flashTimer = setTimeout(() => (flash = null), FLASH_MS);
    }
  }

  // 순서·대기 시간은 app-core playbackPlan이 정한다. 여기서는 단계마다 상태를 반영하고 기다린다.
  async function run() {
    for (const step of plan) {
      if (!alive) return;
      if (step.clock !== undefined) clock = step.clock;
      if (step.extra !== undefined) extra = step.extra;
      if (step.show !== undefined) show(step.show);
      if (step.phase) phase = step.phase;
      if (step.decay) momentum = momentumDecay(momentum);
      if (step.wait > 0) await sleep(step.wait);
    }
    finish();
  }

  function finish() {
    if (!alive) return;
    alive = false;
    onend();
  }

  onMount(() => void run());
  onDestroy(() => {
    alive = false;
    clearTimeout(flashTimer);
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
      <div class="tl-team" class:mine={match.mine === 'home'} class:hit={flash === 'home'}>
        <TeamLogo logo={match.home.logo} name={match.home.name} size={40} decorative /><b>{match.home.name}</b><small>{match.home.owner}</small>
      </div>
      <div class="tl-goals" aria-live="polite" data-live-score>
        <b>{score[0]}</b><span aria-hidden="true">:</span><b>{score[1]}</b>
      </div>
      <div class="tl-team away" class:mine={match.mine === 'away'} class:hit={flash === 'away'}>
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

  <ol class="tl-feed">
    {#each shown as i (i)}
      {@const l = script[i]!}
      <li class="k-{l.kind}" class:away={l.side === 'away'} class:home={l.side === 'home'} data-live-line={l.kind}>
        <span class="tl-min">{clockText(l)}</span>
        <span>{l.text}</span>
      </li>
    {/each}
  </ol>

  <div class="tm-actions">
    <button class="btn" aria-pressed={fast} onclick={() => (fast = !fast)} data-act="live-fast">{fast ? L.speedNormal : L.speedFast}</button>
    <button class="btn btn-primary" onclick={finish} data-act="live-skip">{L.skip}</button>
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
    border-radius: 14px;
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
    border-radius: 999px;
    background: var(--bad);
    color: #fff;
    font-weight: 700;
    font-size: 0.8125rem;
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
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--pitch-accent);
    font-variant-numeric: tabular-nums;
    min-width: 3.4em;
  }
  .tl-phase {
    margin-left: auto;
    font-size: 0.875rem;
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
    font-size: 0.75rem;
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
    font-size: 0.75rem;
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
    border-radius: 10px;
    background: var(--surface-2);
    font-size: 0.875rem;
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
    .tl-mom-fill {
      transition: none;
    }
    .tl-team.hit {
      transform: none;
    }
  }
</style>
