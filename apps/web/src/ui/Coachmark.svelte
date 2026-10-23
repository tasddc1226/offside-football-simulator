<script lang="ts">
  // T-11-473 첫 커리어 따라가기 안내(단계 · 저장은 app-core tutorial). 지금 단계가 비출 자리([data-coach])가 화면에 보이면 그 둘레만
  // 밝게 남기고 나머지를 어둡게 덮은 뒤 말풍선을 띄운다. 덮개는 누름을 그대로 아래로 넘기므로(pointer-events: none) 사용자는 평소처럼
  // 화면을 쓰고, 'tap' 단계는 비춘 자리를 누르면 넘어간다. 시트가 열려 있으면 시트 안의 자리만 비춘다.
  import { onDestroy } from 'svelte';
  import { COACH_STEPS, bubbleAt, coachAt, coachDone, coachPick, type CoachId } from '@offside/app-core/tutorial';
  import { FOCUS_PICK } from '@offside/game/data';
  import { tutorialText as T } from '@offside/app-core/i18n/ko/tutorial';
  import { coach } from './coach.svelte.js';
  import { sheetState } from './sheetState.svelte.js';
  import { motionOK } from './motion.js';

  const PAD = 6;
  let idx = $state<number | null>(null);
  let rect = $state<{ x: number; y: number; w: number; h: number } | null>(null);
  let bw = $state(0);
  let bh = $state(0);
  let vw = $state(innerWidth);
  let vh = $state(innerHeight);
  let scrolledFor = -1;
  let raf = 0;

  const step = $derived(idx === null ? null : COACH_STEPS[idx]!);
  const copy = $derived.by(() => {
    switch (step?.id) {
      case 'new':
        return [T.newTitle, T.newBody];
      case 'pos':
        return [T.posTitle, T.posBody];
      case 'focus':
        return [T.focusTitle({ n: FOCUS_PICK }), T.focusBody];
      case 'candidates':
        return [T.candidatesTitle, T.candidatesBody];
      case 'cands':
        return [T.candsTitle, T.candsBody];
      case 'start':
        return [T.startTitle, T.startBody];
      case 'go':
        return [T.goTitle, T.goBody];
      case 'choice':
        return [T.choiceTitle, T.choiceBody];
      case 'season':
        return [T.seasonTitle, T.seasonBody];
      case 'retire':
        return [T.retireTitle, T.retireBody];
      default:
        return ['', ''];
    }
  });
  const last = $derived(idx === COACH_STEPS.length - 1);
  const pos = $derived(rect && bw ? bubbleAt({ x: rect.x - PAD, y: rect.y - PAD, w: rect.w + PAD * 2, h: rect.h + PAD * 2 }, { w: vw, h: vh }, { w: bw, h: bh }) : null);

  /** 비출 자리. 크기가 있고, 시트가 열려 있으면 시트 안에 있어야 한다. */
  function targetOf(id: CoachId): HTMLElement | null {
    for (const el of document.querySelectorAll<HTMLElement>(`[data-coach="${id}"]`)) {
      if (!el.offsetWidth && !el.offsetHeight) continue;
      if (sheetState.open !== !!el.closest('.modal')) continue;
      return el;
    }
    return null;
  }

  function frame() {
    raf = requestAnimationFrame(frame);
    const from = coach.i;
    if (from === null) return;
    const i = coachPick(from, (id) => !!targetOf(id));
    if (i !== null && i > from) {
      coach.i = i;
      coachAt(i);
    }
    idx = i;
    const el = i === null ? null : targetOf(COACH_STEPS[i]!.target);
    if (i === null || !el) return void (rect = null);
    const r = el.getBoundingClientRect();
    // 처음 비출 때 화면 밖이면 가운데로 데려온다(한 단계에 한 번 — 사용자가 스크롤하면 따라간다).
    if (scrolledFor !== i) {
      scrolledFor = i;
      if (r.bottom < 0 || r.top > innerHeight || r.bottom > innerHeight - 40) el.scrollIntoView({ block: 'center', behavior: motionOK ? 'smooth' : 'auto' });
    }
    vw = innerWidth;
    vh = innerHeight;
    if (!rect || rect.x !== r.x || rect.y !== r.y || rect.w !== r.width || rect.h !== r.height) rect = { x: r.x, y: r.y, w: r.width, h: r.height };
  }
  raf = requestAnimationFrame(frame);

  function next() {
    if (idx === null) return;
    if (idx + 1 >= COACH_STEPS.length) return skip();
    coach.i = idx + 1;
    coachAt(idx + 1);
  }
  function skip() {
    coachDone();
    coach.i = null;
  }

  // 'tap' 단계: 비춘 자리 안의 버튼을 누르면 넘어간다. 화면의 원래 동작은 막지 않는다(캡처 단계에서 보기만 한다).
  function onClick(e: MouseEvent) {
    if (!step || step.advance !== 'tap') return;
    const el = targetOf(step.target);
    const btn = (e.target as Element | null)?.closest('button, a');
    if (el && btn && el.contains(btn)) next();
  }
  addEventListener('click', onClick, true);
  onDestroy(() => {
    cancelAnimationFrame(raf);
    removeEventListener('click', onClick, true);
  });
</script>

{#if step && rect}
  {@const hole = { l: rect.x - PAD, t: rect.y - PAD, r: rect.x + rect.w + PAD, b: rect.y + rect.h + PAD }}
  <!-- 덮개는 구멍 둘레의 네 조각이다(큰 box-shadow는 브라우저에 따라 어둡게 그려지지 않는다). -->
  <div class="coach-dim" aria-hidden="true" style:inset="0 0 auto 0" style:height="{Math.max(0, hole.t)}px"></div>
  <div class="coach-dim" aria-hidden="true" style:inset="{hole.b}px 0 0 0"></div>
  <div class="coach-dim" aria-hidden="true" style:top="{hole.t}px" style:left="0" style:width="{Math.max(0, hole.l)}px" style:height="{hole.b - hole.t}px"></div>
  <div class="coach-dim" aria-hidden="true" style:top="{hole.t}px" style:left="{hole.r}px" style:right="0" style:height="{hole.b - hole.t}px"></div>
  <div class="coach-ring" aria-hidden="true" style:left="{hole.l}px" style:top="{hole.t}px" style:width="{hole.r - hole.l}px" style:height="{hole.b - hole.t}px"></div>
  <div class="coach-bubble" role="dialog" aria-label={T.label} aria-live="polite" data-coach-step={step.id} bind:clientWidth={bw} bind:clientHeight={bh} style:left="{pos?.x ?? -9999}px" style:top="{pos?.y ?? -9999}px">
    <p class="coach-n num">{T.step({ n: (idx ?? 0) + 1, total: COACH_STEPS.length })}</p>
    <b class="coach-title">{copy[0]}</b>
    <p class="coach-body">{copy[1]}</p>
    <div class="coach-row">
      {#if !last}<button class="link-btn" data-act="coach-skip" onclick={skip}>{T.skip}</button>{/if}
      {#if step.advance === 'next'}
        <button class="btn btn-sm btn-primary" data-act="coach-next" onclick={next}>{last ? T.done : T.next}</button>
      {:else}
        <span class="coach-tap">{T.tapHint}</span>
      {/if}
    </div>
  </div>
{/if}

<style>
  .coach-ring {
    position: fixed;
    z-index: 40;
    border-radius: 14px;
    box-shadow: 0 0 0 3px var(--accent);
    pointer-events: none;
  }
  .coach-dim {
    position: fixed;
    z-index: 40;
    background: rgba(8, 14, 11, 0.55);
    pointer-events: none;
  }
  .coach-ring::after {
    content: '';
    position: absolute;
    inset: -3px;
    border-radius: inherit;
    border: 3px solid var(--accent);
    animation: coach-pulse 1.6s ease-out infinite;
  }
  @keyframes coach-pulse {
    from {
      opacity: 0.9;
      transform: scale(1);
    }
    to {
      opacity: 0;
      transform: scale(1.06);
    }
  }
  .coach-bubble {
    position: fixed;
    z-index: 41;
    width: min(320px, calc(100vw - 32px));
    display: grid;
    gap: 6px;
    padding: 14px 16px 12px;
    border-radius: var(--radius-lg);
    background: var(--surface);
    color: var(--ink);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.28);
    animation: coach-in 0.22s ease both;
  }
  @keyframes coach-in {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
  }
  .coach-n {
    margin: 0;
    color: var(--accent-text);
    font-size: var(--fs-label);
    font-weight: 700;
  }
  .coach-title {
    font-size: var(--fs-body1);
  }
  .coach-body {
    margin: 0;
    font-size: var(--fs-body2);
    line-height: 1.5;
  }
  .coach-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 4px;
  }
  .coach-row > :only-child {
    margin-left: auto;
  }
  .coach-tap {
    color: var(--accent-text);
    font-size: var(--fs-label);
    font-weight: 700;
  }
  @media (prefers-reduced-motion: reduce) {
    .coach-bubble {
      animation: none;
    }
    .coach-ring::after {
      animation: none;
      opacity: 0;
    }
  }
</style>
