<script lang="ts">
  import { tn } from '@offside/game/i18n/names';
  // T-11-039 계약서 사인 — 이적시장에서 고른 구단과의 계약. 손가락·마우스로 사인하거나 '이름 사인 사용'으로 선수 이름을
  // 흘려 쓴 사인을 넣으면 확정 버튼이 켜진다. 누르면 도장이 찍히고 onSign. 사인은 화면 연출이라 저장하지 않는다.
  import { onMount } from 'svelte';
  import ClubBadge from '../ClubBadge.svelte';
  import { motionOK } from '../motion.js';
  import { MIN_INK, REVEAL_MS, SKEW_X, SKEW_Y, STAMP_MS, signFlourish } from '@offside/app-core/signature';
  import type { SheetView } from '@offside/app-core/sheets';
  import { sheetContractText as L } from '@offside/app-core/i18n/ko/sheetContract';

  let { v }: { v: Extract<SheetView, { kind: 'contract' }> } = $props();

  let canvas = $state<HTMLCanvasElement | null>(null);
  /** 그은 길이 — 매 이벤트 늘어나므로 상태가 아닌 값으로 두고, 화면은 inked·enough만 본다. */
  let ink = 0;
  let inked = $state(false);
  let enough = $state(false);
  let named = $state(false);
  let sealed = $state(false);
  const ready = $derived(named || enough);

  let ctx: CanvasRenderingContext2D | null = null;
  let dpr = 1;
  let raf = 0;
  let last: { x: number; y: number; t: number; w: number } | null = null;
  let mid: { x: number; y: number } | null = null;
  /** 획을 시작할 때 한 번 읽어 두는 패드 위치 — 긋는 동안 이벤트마다 레이아웃을 묻지 않는다. */
  let rect: DOMRect | null = null;

  const inkColor = () => getComputedStyle(canvas!).color;

  /** 캔버스 해상도를 화면 크기에 맞춘다(크기가 그대로면 지우기만 한다). */
  function fit() {
    if (!canvas) return;
    dpr = Math.min(3, devicePixelRatio || 1);
    const w = Math.round(canvas.clientWidth * dpr),
      h = Math.round(canvas.clientHeight * dpr);
    if (ctx && canvas.width === w && canvas.height === h) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.restore();
      return;
    }
    canvas.width = w;
    canvas.height = h;
    ctx = canvas.getContext('2d');
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  onMount(() => {
    fit();
    // 폭이 바뀌면(회전 등) 캔버스를 다시 맞춘다 — 그린 사인은 지워지므로 처음부터 다시 받는다.
    const ro = new ResizeObserver(() => {
      if (canvas && Math.round(canvas.clientWidth * dpr) !== canvas.width) clear();
    });
    if (canvas) ro.observe(canvas);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  });

  function clear() {
    cancelAnimationFrame(raf);
    fit();
    ink = 0;
    inked = enough = named = false;
    last = mid = null;
  }

  const at = (e: PointerEvent) => ({ x: e.clientX - rect!.left, y: e.clientY - rect!.top, t: e.timeStamp });
  function down(e: PointerEvent) {
    if (sealed || !ctx) return;
    if (named) clear();
    canvas!.setPointerCapture(e.pointerId);
    rect = canvas!.getBoundingClientRect();
    const p = at(e);
    last = { ...p, w: 2.6 };
    mid = p;
    inked = true;
    ctx.fillStyle = ctx.strokeStyle = inkColor();
    ctx.lineCap = ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
  // 빠르게 그을수록 가늘어지는 펜 — 두 점의 가운데를 이어 부드러운 곡선으로 그린다.
  function move(e: PointerEvent) {
    if (!last || !ctx || !mid) return;
    for (const ev of e.getCoalescedEvents?.() ?? [e]) {
      const p = at(ev);
      const d = Math.hypot(p.x - last.x, p.y - last.y);
      if (d < 1) continue;
      const speed = d / Math.max(1, p.t - last.t);
      const w: number = last.w * 0.7 + Math.min(3.4, Math.max(1.2, 3.6 - speed * 1.1)) * 0.3;
      const m = { x: (last.x + p.x) / 2, y: (last.y + p.y) / 2 };
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(mid.x, mid.y);
      ctx.quadraticCurveTo(last.x, last.y, m.x, m.y);
      ctx.stroke();
      ink += d;
      last = { ...p, w };
      mid = m;
    }
    if (!enough && ink >= MIN_INK) enough = true;
  }
  const up = () => (last = mid = null);

  /** 선수 이름을 기울여 흘려 쓰고 밑줄 꼬리를 붙인다. 감속 모션이 아니면 왼쪽부터 써 나간다. */
  function nameSign() {
    if (sealed || !canvas) return;
    clear();
    const c = ctx!;
    const W = canvas.clientWidth,
      H = canvas.clientHeight;
    const family = getComputedStyle(canvas).fontFamily;
    c.font = `italic 500 ${H * 0.42}px ${family}`;
    // 폭 70%를 넘으면 글자를 줄인다.
    const size = H * 0.42 * Math.min(1, (W * 0.7) / c.measureText(v.name).width);
    c.font = `italic 500 ${size}px ${family}`;
    const half = Math.min(W * 0.42, c.measureText(v.name).width / 2 + size * 0.9);
    const flourish = new Path2D(signFlourish(half, size));
    const color = inkColor();
    const draw = (reveal: number) => {
      c.save();
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, W, H);
      c.beginPath();
      c.rect(0, 0, W * reveal, H);
      c.clip();
      c.fillStyle = c.strokeStyle = color;
      c.translate(W / 2, H * 0.56);
      c.transform(1, SKEW_Y, SKEW_X, 1, 0, 0);
      c.textAlign = 'center';
      c.textBaseline = 'alphabetic';
      c.fillText(v.name, 0, 0);
      c.lineWidth = 2.2;
      c.lineCap = 'round';
      c.stroke(flourish);
      c.restore();
    };
    named = true;
    if (!motionOK) return draw(1);
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / REVEAL_MS);
      draw(1 - Math.pow(1 - t, 2));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  function sign() {
    if (!ready || sealed) return;
    sealed = true;
    setTimeout(v.onSign, motionOK ? STAMP_MS : 0);
  }
</script>

<div class="contract">
  <button class="contract-x" aria-label={L.close} data-sign="close" disabled={sealed} onclick={v.onClose}>×</button>
  <div class="eyebrow">{v.eyebrow}</div>
  <h2>{v.title}</h2>
  <p class="contract-text">{v.text}</p>
  <div class="contract-club">
    <ClubBadge club={v.club} size={34} />
    <dl>
      {#each v.terms as t (t.label)}
        <div><dt>{t.label}</dt><dd>{tn(t.value)}</dd></div>
      {/each}
    </dl>
  </div>
  <div class="sign-pad" class:inked={inked || named}>
    <canvas
      bind:this={canvas}
      aria-label={L.padLabel}
      onpointerdown={down}
      onpointermove={move}
      onpointerup={up}
      onpointercancel={up}
    ></canvas>
    <span class="sign-hint" aria-hidden="true">{L.signHint}</span>
    <i aria-hidden="true"></i>
    {#if sealed}
      <div class="stamp" aria-hidden="true"><b>SIGNED</b><span>{tn(v.club.name)}</span></div>
    {/if}
  </div>
  <p class="sign-note">{L.signNote}</p>
  <div class="sign-tools">
    <button class="btn btn-sm" data-sign="clear" disabled={sealed} onclick={clear}>{L.clear}</button>
    <button class="btn btn-sm" data-sign="name" disabled={sealed} onclick={nameSign}>{L.nameSign}</button>
  </div>
  <button class="btn btn-primary btn-block" data-sign="ok" disabled={!ready || sealed} onclick={sign}>
    {v.cta} <span aria-hidden="true">→</span>
  </button>
</div>

<style>
  .contract {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .contract h2 {
    padding-right: 40px;
    word-break: keep-all;
  }
  .contract-x {
    position: absolute;
    top: -6px;
    right: -4px;
    width: 40px;
    height: 40px;
    border-radius: 999px;
    border: 0;
    background: var(--surface-2);
    color: var(--muted);
    font-size: 1.375rem;
    line-height: 1;
  }
  .contract-text {
    margin: -4px 0 0;
    color: var(--muted);
    font-size: 0.9375rem;
  }
  .contract-club {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 12px;
    background: var(--surface-2);
  }
  .contract-club dl {
    flex: 1;
    display: flex;
    flex-wrap: wrap;
    gap: 4px 16px;
    margin: 0;
  }
  .contract-club dt {
    font-size: 0.6875rem;
    color: var(--muted);
  }
  .contract-club dd {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 700;
  }
  .sign-pad {
    position: relative;
    height: 150px;
    border: 1.5px dashed var(--line);
    border-radius: 14px;
    background: var(--surface);
    overflow: hidden;
  }
  .sign-pad canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    touch-action: none;
    cursor: crosshair;
    color: var(--ink);
    font-family: var(--body);
  }
  .sign-hint {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    color: var(--muted);
    font-size: 0.9375rem;
    pointer-events: none;
  }
  .sign-pad.inked .sign-hint {
    display: none;
  }
  /* 서명란 밑줄과 × 표시(종이 계약서처럼). */
  .sign-pad i {
    position: absolute;
    left: 18px;
    right: 18px;
    bottom: 30px;
    border-bottom: 1px solid var(--line);
    pointer-events: none;
  }
  .sign-pad i::before {
    content: '×';
    position: absolute;
    left: 0;
    bottom: 2px;
    color: var(--muted);
    font-size: 0.875rem;
    font-style: normal;
  }
  .stamp {
    position: absolute;
    right: 14px;
    top: 12px;
    display: grid;
    place-items: center;
    width: 86px;
    height: 86px;
    border-radius: 50%;
    border: 3px double var(--bad);
    color: var(--bad);
    transform: rotate(-14deg);
    text-align: center;
    pointer-events: none;
    animation: stamp 0.28s cubic-bezier(0.2, 1.6, 0.4, 1) both;
  }
  .stamp b {
    font-family: var(--display);
    font-size: 1.25rem;
    letter-spacing: 0.06em;
    line-height: 1;
    align-self: end;
  }
  .stamp span {
    align-self: start;
    max-width: 70px;
    font-size: 0.5625rem;
    font-weight: 700;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  @keyframes stamp {
    from {
      transform: rotate(-14deg) scale(1.8);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .stamp {
      animation: none;
    }
  }
  .sign-note {
    margin: -6px 0 0;
    text-align: center;
    font-size: 0.75rem;
    color: var(--muted);
  }
  .sign-tools {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
</style>
