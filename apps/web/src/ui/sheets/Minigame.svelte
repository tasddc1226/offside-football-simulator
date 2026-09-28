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
  const SPOT: Pose = { x: 150, y: 148, s: 1.35 };
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
  type KPose = { dx: number; dy: number; rot: number };
  /** 골키퍼 자세. 슈팅 계열에선 상대 키퍼, save에선 나. */
  const kp = $derived.by((): KPose => {
    if (stage === 0 || v.ok === null) return { dx: 0, dy: 0, rot: 0 };
    const s = side;
    if (v.mg === 'chip') return { dx: 0, dy: v.ok ? -4 : -12, rot: 0 };
    if (hold) return v.ok ? { dx: 0, dy: -4, rot: 0 } : { dx: s * 14, dy: -4, rot: s * 25 };
    // 페널티킥이 들어가면 키퍼는 반대로 속고, 나머지는 공 쪽으로 몸을 던진다(드리블 성공은 그 반대로 제친다).
    const toward = v.mg !== 'shot' || !v.ok;
    const d = toward ? s : -s;
    return { dx: d * (v.mg === 'save' && !v.ok ? 30 : 38), dy: -6, rot: d * 68 };
  });
  /** 공이 땅에 닿은 높이(그림자 자리). 골라인 뒤로 날아간 공은 골라인에 그림자를 둔다. */
  const shadowY = $derived(ball.y + 6 >= 112 ? ball.y + 6 : 112);
  /** 축구공 무늬 — 가운데 오각형과 가장자리 다섯 조각(원 밖은 잘린다), 조각을 잇는 솔기. */
  const penta = (cx: number, cy: number, r: number, rot: number) =>
    Array.from({ length: 5 }, (_, k) => {
      const a = ((rot + 72 * k) * Math.PI) / 180;
      return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
    }).join(' ');
  const rad = (a: number) => (a * Math.PI) / 180;
  const PATCHES = [
    penta(0, 0, 2.2, -90),
    ...[90, 162, 234, 306, 18].map((a) => penta(7.2 * Math.cos(rad(a)), 7.2 * Math.sin(rad(a)), 2.5, a + 180)),
  ];
  const SEAMS = [-90, -18, 54, 126, 198].map((a) => ({
    x1: 2.2 * Math.cos(rad(a)),
    y1: 2.2 * Math.sin(rad(a)),
    x2: 4.9 * Math.cos(rad(a)),
    y2: 4.9 * Math.sin(rad(a)),
  }));
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
    <defs>
      <radialGradient id="mg-ball-shade" cx="36%" cy="30%" r="80%">
        <stop offset="0" stop-color="#ffffff" />
        <stop offset="0.65" stop-color="#eef0f3" />
        <stop offset="1" stop-color="#b9bfc8" />
      </radialGradient>
      <clipPath id="mg-ball-clip"><circle r="6.5" /></clipPath>
    </defs>
    <rect class="mg-grass" x="0" y="0" width="300" height="170" />
    {#each [112, 138] as y (y)}<rect class="mg-stripe" x="0" {y} width="300" height="13" />{/each}
    <!-- 골대: 뒤 그물 틀 → 그물 → 앞 골대 순서로 그려 깊이를 준다. -->
    <path class="mg-goal-back" d="M70 28 L82 40 H218 L230 28 M82 40 V104 M218 40 V104 M70 112 L82 104 H218 L230 112" />
    <g class="mg-net" class:hit={goal}>
      {#each [94, 106, 118, 130, 142, 154, 166, 178, 190, 202] as x (x)}<line x1={x} y1="40" x2={x} y2="104" />{/each}
      {#each [52, 64, 76, 88] as y (y)}<line x1="82" y1={y} x2="218" y2={y} />{/each}
      <path d="M70 40 L82 52 M70 56 L82 64 M70 72 L82 76 M70 88 L82 88 M70 104 L82 100 M230 40 L218 52 M230 56 L218 64 M230 72 L218 76 M230 88 L218 88 M230 104 L218 100" />
    </g>
    <line class="mg-line" x1="0" y1="112" x2="300" y2="112" />
    <path class="mg-goal" d="M70 112 V28 H230 V112" />
    <circle class="mg-line-dot" cx="150" cy="150" r="2" />
    <ellipse
      class="mg-shadow"
      cx="150"
      cy="113"
      rx={kp.rot ? 22 : 14}
      ry="2.6"
      style="transform:translateX({kp.dx}px)"
    />
    <g class="mg-keeper" class:me style="transform:translate({kp.dx}px,{kp.dy}px) rotate({kp.rot}deg)">
      <path class="kp-sock" d="M145.5 95 L142 108.5 M154.5 95 L158 108.5" />
      <path class="kp-boot" d="M138.5 110.5 h6 M155.5 110.5 h6" />
      <path class="kp-shorts" d="M140.5 86 h19 l1.8 10 h-9 l-1.3 -3.5 -1.3 3.5 h-9 z" />
      <path class="kp-arm" d="M140.5 72.5 L128.5 80 L123.5 70 M159.5 72.5 L171.5 80 L176.5 70" />
      <path class="kp-shirt" d="M138.5 71.5 Q150 66.5 161.5 71.5 L160 88 H140 Z" />
      <text class="kp-num" x="150" y="83.5">1</text>
      <circle class="kp-glove" cx="122.8" cy="66.8" r="4.3" />
      <circle class="kp-glove" cx="177.2" cy="66.8" r="4.3" />
      <rect class="kp-skin" x="147.6" y="65" width="4.8" height="4" rx="1" />
      <circle class="kp-skin" cx="150" cy="61" r="6" />
      <path class="kp-hair" d="M144 61 A6 6 0 0 1 156 61 Q153 57.6 150 58.2 Q147 57.6 144 61 Z" />
    </g>
    <ellipse
      class="mg-shadow mg-ball-shadow"
      rx="6"
      ry="1.9"
      style="transform:translate({ball.x}px,{shadowY}px) scale({ball.s});opacity:{ball.y + 6 >= 112 ? 0.4 : 0.18}"
    />
    <g
      class="mg-ball"
      style="transform:translate({ball.x}px,{ball.y}px) scale({ball.s}) rotate({stage * 280 * side}deg)"
    >
      <circle r="6.5" fill="url(#mg-ball-shade)" />
      <g clip-path="url(#mg-ball-clip)">
        {#each PATCHES as pts, i (i)}<polygon class="ball-patch" points={pts} />{/each}
        {#each SEAMS as l, i (i)}<line class="ball-seam" {...l} />{/each}
      </g>
      <circle class="ball-edge" r="6.5" />
    </g>
  </svg>
  {#if caption}<span class="mg-caption pop" class:ok={v.ok}>{caption}</span>{/if}
  <span class="mg-gauge" aria-hidden="true">
    <span class="mg-zone" style="left:{(v.center - v.w / 2) * 100}%;width:{v.w * 100}%"></span>
    <i class="needle" style="left:calc({pos * 100}% - 1px)"></i>
  </span>
  <span class="mg-tap">{tapped ? ' ' : MG_TAP[v.mg]}</span>
</button>
