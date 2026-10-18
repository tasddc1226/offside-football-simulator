<script lang="ts">
  // T-11-371 등급 공개 연출 — 후보 잠재력 범위 · 시즌 스카우트 평가 · 은퇴 때 실제 잠재력. 결과는 이미 저장된 뒤에 보여 주기만 한다.
  // 뒷면(숨 고르기) → 단서(등급 글자가 아래부터 훑고 올라가며 끝으로 갈수록 느려진다) → 결과(강도별 빛 · 진동 · 소리).
  // 화면에 들어온 뒤 시작하고, 누르거나 Esc면 바로 결과로 간다. 감속 모션 · 업무 모드 · "연출 짧게"면 결과만 보인다.
  import { onMount } from 'svelte';
  import { gradeSweep, revealTiming, sweepAt, REVEAL_BUZZ, type RevealTier } from '@offside/app-core/reveal';
  import { revealText as R } from '@offside/app-core/i18n/ko/reveal';
  import { buzz, motionOK } from './motion.js';
  import { sheetOn } from './skin.svelte.js';
  import { flashEdge, revealShort, revealTone } from './revealPrefs.js';

  let { grade, text, tier, id }: { grade: string; text: string; tier: RevealTier; id?: string } = $props();

  // svelte-ignore state_referenced_locally
  const timing = revealTiming(tier, { off: !motionOK || sheetOn(), short: revealShort() });
  // svelte-ignore state_referenced_locally
  const steps = gradeSweep(grade);
  const instant = timing.back + timing.hint + timing.hold === 0;
  let phase = $state<'wait' | 'back' | 'hint' | 'hold' | 'done'>(instant ? 'done' : 'wait');
  let x = $state(0);
  let el = $state<HTMLElement>();
  let raf = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const letter = $derived(phase === 'hold' ? steps.at(-1)! : sweepAt(steps, x));

  function finish() {
    if (phase === 'done') return;
    cancelAnimationFrame(raf);
    clearTimeout(timer);
    phase = 'done';
    buzz(REVEAL_BUZZ[tier]);
    revealTone(tier);
    if (tier === 'jackpot') flashEdge();
  }
  function run() {
    phase = 'back';
    timer = setTimeout(() => {
      phase = 'hint';
      revealTone('hint');
      const t0 = performance.now();
      const tick = (now: number) => {
        x = Math.min(1, (now - t0) / timing.hint);
        if (x < 1) raf = requestAnimationFrame(tick);
        else if (timing.hold) {
          phase = 'hold';
          timer = setTimeout(finish, timing.hold);
        } else finish();
      };
      raf = requestAnimationFrame(tick);
    }, timing.back);
  }
  onMount(() => {
    if (instant) {
      buzz(REVEAL_BUZZ[tier]);
      return;
    }
    // 화면에 들어온 뒤 시작한다(은퇴 리포트는 스크롤로 내려와야 보인다).
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting) && phase === 'wait') {
        io.disconnect();
        run();
      }
    });
    io.observe(el!);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  });
  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && phase !== 'done' && phase !== 'wait') finish();
  }
  const tierWord = $derived(tier === 'jackpot' ? R.jackpot : tier === 'good' ? R.good : '');
</script>

<svelte:window {onkeydown} />

<!-- 연출 중에는 눌러서 건너뛴다(결과 단계에서는 보통 글자). -->
<!-- 결과 글자가 들어오면 화면 읽기가 한 번 읽는다(연출 중 단서는 읽지 않는다). -->
<span bind:this={el} class="rv rv-{tier}" class:rv-on={phase !== 'done'} data-reveal={phase} data-reveal-tier={tier} aria-live={instant ? undefined : 'polite'} {id}>
  {#if phase === 'done'}
    <span class="rv-text" class:rv-pop={!instant} aria-hidden={instant ? undefined : 'true'}>{text}</span>
    {#if !instant}<span class="sr-only">{R.gradeLive({ text, tier: tierWord })}</span>{/if}
  {:else}
    <button type="button" class="rv-stage" data-act="reveal-skip" aria-label={R.skip} onclick={finish}>
      <b class="rv-letter" class:rv-hold={phase === 'hold'} aria-hidden="true">{phase === 'back' || phase === 'wait' ? '?' : letter}</b>
      <small class="muted" aria-hidden="true">{R.skip}</small>
    </button>
  {/if}
</span>

<style>
  .rv {
    display: inline-block;
  }
  .rv-stage {
    display: inline-flex;
    align-items: baseline;
    gap: 8px;
    padding: 2px 10px;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: transparent;
    font: inherit;
    color: inherit;
    cursor: pointer;
  }
  .rv-letter {
    display: inline-block;
    min-width: 1.4em;
    text-align: center;
    /* 글줄 안(선수 탭)에서는 조금 크게, 큰 글자(은퇴 리포트) 안에서는 그 크기 그대로. */
    font-size: max(1.375rem, 1em);
    font-variant-numeric: tabular-nums;
  }
  .rv-stage small {
    font-size: 0.75rem;
    font-weight: 400;
    font-family: var(--body);
    white-space: nowrap;
  }
  .rv-good .rv-stage,
  .rv-jackpot .rv-stage {
    border-color: var(--accent);
  }
  .rv-jackpot .rv-stage {
    animation: rv-glow 0.5s ease-in-out infinite alternate;
  }
  .rv-hold {
    animation: rv-throb 0.26s ease-in-out infinite alternate;
  }
  .rv-pop {
    display: inline-block;
    animation: rv-pop 0.45s ease-out;
  }
  .rv-good .rv-text,
  .rv-jackpot .rv-text {
    font-weight: 700;
    color: var(--accent-text);
  }
  @keyframes rv-glow {
    to {
      box-shadow: 0 0 14px 2px color-mix(in srgb, var(--accent) 60%, transparent);
    }
  }
  @keyframes rv-throb {
    to {
      transform: scale(1.18);
    }
  }
  @keyframes rv-pop {
    0% {
      transform: scale(0.6);
    }
    60% {
      transform: scale(1.12);
    }
    100% {
      transform: scale(1);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .rv-jackpot .rv-stage,
    .rv-hold,
    .rv-pop {
      animation: none;
    }
  }
</style>
