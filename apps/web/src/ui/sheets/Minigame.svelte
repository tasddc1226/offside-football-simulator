<script lang="ts">
  // T-10-089 원터치 미니게임. 게이지 위를 왕복하는 바늘을 한 번 탭해 멈춘다(장면 전체가 버튼 하나).
  // 탭한 순간의 바늘 위치는 마지막으로 그린 프레임이 아니라 입력 시각(event.timeStamp)으로 계산한다 — 프레임
  // 간격만큼 판정이 밀리지 않게. 판정이 나면(v.ok) 공이 날아가는 결과 장면을 두 단계로 그린다.
  import { onMount } from 'svelte';
  import { markerAt, MG_TAP } from '../../game/minigame.js';
  import type { SheetView } from './types.js';

  let { v }: { v: Extract<SheetView, { kind: 'minigame' }> } = $props();

  let pos = $state(0);
  let tapped = $state(false);
  /** 결과 장면 단계: 0 겨냥 · 1 공이 날아가는 중 · 2 마무리. */
  let stage = $state(0);
  let t0 = 0;
  /** 공이 향할 쪽(-1 왼쪽 · 1 오른쪽). 선택지가 정하지 않았으면 무작위(화면 연출이라 게임 RNG를 쓰지 않는다). */
  const rs = Math.random() < 0.5 ? -1 : 1;
  /** 제자리에서 버티는 선택(끝까지 기다린다). */
  const hold = $derived(v.side === 0);
  const side = $derived(v.side || rs);

  onMount(() => {
    t0 = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      if (tapped) return;
      pos = markerAt(now - t0);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  });

  $effect(() => {
    if (v.ok === null) return;
    stage = 1;
    const t = setTimeout(() => (stage = 2), 380);
    return () => clearTimeout(t);
  });

  function tap(at: number) {
    if (tapped) return;
    tapped = true;
    pos = markerAt(at - t0);
    v.onTap(pos);
  }

  type Pose = { x: number; y: number; s: number };
  const SPOT: Pose = { x: 150, y: 150, s: 1 };
  /** 단계별 공 위치(골문 앞 시점, viewBox 300×170). */
  const ball = $derived.by((): Pose => {
    if (stage === 0 || v.ok === null) return SPOT;
    const s = side;
    const two = (a: Pose, b: Pose) => (stage === 1 ? a : b);
    switch (v.mg) {
      case 'shot':
        return v.ok
          ? two({ x: 150 + s * 50, y: 70, s: 0.7 }, { x: 150 + s * 62, y: 48, s: 0.6 })
          : two({ x: 150 + s * 34, y: 30, s: 0.62 }, { x: 150 + s * 58, y: 4, s: 0.5 });
      case 'chip':
        return v.ok
          ? two({ x: 150 + s * 6, y: 26, s: 0.75 }, { x: 150 + s * 16, y: 62, s: 0.55 })
          : two({ x: 150, y: 44, s: 0.75 }, { x: 150, y: 74, s: 0.6 });
      case 'dribble':
        return v.ok
          ? two({ x: 150 - s * 34, y: 122, s: 0.8 }, { x: 150 - s * 44, y: 98, s: 0.6 })
          : two({ x: 150 + s * 16, y: 118, s: 0.8 }, { x: 150 + s * 28, y: 104, s: 0.7 });
      case 'save':
        if (hold)
          return v.ok
            ? two({ x: 150, y: 96, s: 0.75 }, { x: 150, y: 84, s: 0.68 })
            : two({ x: 150 + s * 56, y: 56, s: 0.66 }, { x: 150 + s * 70, y: 40, s: 0.58 });
        return v.ok
          ? two({ x: 150 + s * 40, y: 80, s: 0.72 }, { x: 150 + s * 50, y: 76, s: 0.66 })
          : two({ x: 150 + s * 56, y: 56, s: 0.66 }, { x: 150 + s * 68, y: 40, s: 0.58 });
    }
  });
  /** 골키퍼 자세. 슈팅 계열에선 상대 키퍼, save에선 나. */
  const keeper = $derived.by(() => {
    if (stage === 0 || v.ok === null) return 'translate(0px,0px) rotate(0deg)';
    const s = side;
    if (v.mg === 'chip') return `translate(0px,${v.ok ? -4 : -12}px) rotate(0deg)`;
    if (hold) return v.ok ? 'translate(0px,-4px) rotate(0deg)' : `translate(${s * 14}px,-4px) rotate(${s * 25}deg)`;
    // 페널티킥이 들어가면 키퍼는 반대로 속고, 나머지는 공 쪽으로 몸을 던진다(드리블 성공은 그 반대로 제친다).
    const toward = v.mg !== 'shot' || !v.ok;
    const d = toward ? s : -s;
    const reach = v.mg === 'save' && !v.ok ? 30 : 38;
    return `translate(${d * reach}px,-6px) rotate(${d * 68}deg)`;
  });
  /** 골이 들어갔는가(그물 흔들기). */
  const goal = $derived(stage === 2 && v.ok !== null && (v.mg === 'save' ? !v.ok : v.ok));
  const caption = $derived.by(() => {
    if (v.ok === null) return '';
    if (v.mg === 'save') return v.ok ? '선방!' : '실점…';
    if (v.ok) return '골!';
    return v.mg === 'shot' ? '크로스바!' : '막혔다!';
  });
  const me = $derived(v.mg === 'save');
</script>

<div class="eyebrow">원터치 · 초록 구간에서 멈추세요</div>
<h2>{v.label}</h2>
<button
  class="mg-stage"
  class:done={tapped}
  data-sheet="mg"
  data-mg-tap
  aria-label="{MG_TAP[v.mg]} — 바늘이 초록 구간에 올 때 누르세요"
  onpointerdown={(e) => tap(e.timeStamp)}
  onclick={() => tap(performance.now())}
>
  <svg viewBox="0 0 300 170" aria-hidden="true">
    <rect class="mg-grass" x="0" y="0" width="300" height="170" />
    <g class="mg-net" class:hit={goal}>
      {#each [85, 100, 115, 130, 145, 160, 175, 190, 205, 220] as x (x)}<line x1={x} y1="28" x2={x} y2="112" />{/each}
      {#each [43, 58, 73, 88, 103] as y (y)}<line x1="70" y1={y} x2="230" y2={y} />{/each}
    </g>
    <path class="mg-goal" d="M70 112 V28 H230 V112" />
    <line class="mg-line" x1="0" y1="112" x2="300" y2="112" />
    <circle class="mg-line-dot" cx="150" cy="150" r="2" />
    <g class="mg-keeper" class:me style="transform:{keeper}">
      <rect x="128" y="78" width="44" height="7" rx="3.5" />
      <rect x="141" y="76" width="18" height="30" rx="5" />
      <rect x="143" y="104" width="14" height="8" rx="2" />
      <circle cx="150" cy="68" r="7" />
    </g>
    <g class="mg-ball" style="transform:translate({ball.x}px,{ball.y}px) scale({ball.s})">
      <circle r="6" />
    </g>
  </svg>
  {#if caption}<span class="mg-caption pop" class:ok={v.ok}>{caption}</span>{/if}
  <span class="mg-gauge" aria-hidden="true">
    <span class="mg-zone" style="left:{(v.center - v.w / 2) * 100}%;width:{v.w * 100}%"></span>
    <i class="needle" style="left:calc({pos * 100}% - 1px)"></i>
  </span>
  <span class="mg-tap">{tapped ? ' ' : MG_TAP[v.mg]}</span>
</button>
