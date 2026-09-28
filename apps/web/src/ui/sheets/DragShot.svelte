<script lang="ts">
  // T-10-089 드래그 슛(프로토타입). 장면 위에서 골문 쪽으로 끌어 올렸다가 떼면 찬다. 경로는 장면 좌표(viewBox
  // 300×170)로 모은다 — 화면 크기와 상관없이 같은 손짓이 같은 슛이 되게. 판정은 game/dragShot.ts.
  import { isShot, type DragPoint } from '../../game/dragShot.js';
  import MgTimer from './MgTimer.svelte';
  import PitchScene, { type BallPose, type KeeperPose } from './PitchScene.svelte';
  import type { SheetView } from './types.js';

  let { v }: { v: Extract<SheetView, { kind: 'dragShot' }> } = $props();

  let path = $state<DragPoint[]>([]);
  let dragging = $state(false);
  let hint = $state('');
  /** 결과 장면 단계: 0 겨냥 · 1 공이 닿는 자리까지 · 2 마무리(튕기거나 그물로). */
  let stage = $state(0);
  let area: HTMLDivElement | undefined = $state();

  $effect(() => {
    if (!v.shot) return;
    stage = 1;
    const t = setTimeout(() => (stage = 2), 400);
    return () => clearTimeout(t);
  });

  /** 찼거나 시간이 지났다(더 받지 않는다). */
  let over = $state(false);
  function expire() {
    if (over) return;
    over = true;
    dragging = false;
    path = [];
    v.onShot(null);
  }
  function toScene(e: PointerEvent): DragPoint {
    const r = area!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 300, y: ((e.clientY - r.top) / r.height) * 170, t: e.timeStamp };
  }
  function down(e: PointerEvent) {
    if (over) return;
    // 장면 밖으로 끌어도 끝까지 받는다(합성 이벤트 등으로 캡처가 안 되면 그냥 넘어간다).
    try {
      area!.setPointerCapture(e.pointerId);
    } catch {
      /* no-op */
    }
    dragging = true;
    hint = '';
    path = [toScene(e)];
  }
  function move(e: PointerEvent) {
    if (!dragging) return;
    path.push(toScene(e));
  }
  function up(e: PointerEvent) {
    if (!dragging) return;
    dragging = false;
    path.push(toScene(e));
    if (!isShot(path)) {
      hint = '골문 쪽(위)으로 더 길게 끌었다가 떼세요';
      path = [];
      return;
    }
    over = true;
    v.onShot($state.snapshot(path));
  }

  const SPOT: BallPose = { x: 150, y: 148, s: 1.35 };
  const ball = $derived.by((): BallPose => {
    const sh = v.shot;
    if (!sh || stage === 0 || sh.outcome === 'late') return SPOT;
    const at = { x: sh.x, y: sh.y, s: 0.6 };
    if (stage === 1) return at;
    const out = sh.x < 150 ? -1 : 1;
    switch (sh.outcome) {
      case 'goal':
        return { x: sh.x + (150 - sh.x) * 0.08, y: sh.y + 4, s: 0.5 };
      case 'saved':
        return { x: sh.x + out * 16, y: Math.min(135, sh.y + 34), s: 0.75 };
      case 'post':
        return { x: sh.x + out * 24, y: sh.y - 14, s: 0.5 };
      case 'over':
        return { x: sh.x + out * 8, y: -12, s: 0.45 };
      case 'wide':
        return { x: sh.x + out * 30, y: sh.y - 6, s: 0.5 };
    }
  });
  const kp = $derived.by((): KeeperPose => {
    const sh = v.shot;
    if (!sh || stage === 0 || sh.outcome === 'late') return { dx: 0, dy: 0, rot: 0 };
    if (sh.keeper === 0) return { dx: 0, dy: -8, rot: 0 };
    return { dx: sh.keeper * 38, dy: -6, rot: sh.keeper * 68 };
  });
  const CAPTION: Record<string, string> = {
    goal: '골!',
    saved: '선방에 막혔다!',
    post: '골대를 때렸다!',
    over: '하늘로 떴다…',
    wide: '빗나갔다!',
    late: '시간 초과!',
  };
  const caption = $derived(v.shot && stage > 0 ? CAPTION[v.shot.outcome] : '');
  const trail = $derived(dragging ? path.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') : '');
  const readout = $derived.by(() => {
    const sh = v.shot;
    if (!sh) return '';
    if (sh.outcome === 'late') return '3초 안에 차지 않았어요';
    const pw = sh.power < 0.6 ? '약함' : sh.power > 1.3 ? '과함' : '좋음';
    return `세기 ${Math.round(sh.power * 100)}% (${pw}) · 곧게 차기 ${Math.round(sh.straight * 100)}%`;
  });
</script>

<div class="eyebrow">드래그 슛 · 골문 쪽으로 튕기듯 끌어 올리세요</div>
<h2>{v.label}</h2>
<div
  class="mg-stage mg-drag"
  class:dragging
  bind:this={area}
  role="application"
  aria-label="드래그 슛 — 공에서 골문 쪽으로 끌었다가 떼면 찹니다"
  data-drag-shot
  onpointerdown={down}
  onpointermove={move}
  onpointerup={up}
  onpointercancel={() => ((dragging = false), (path = []))}
>
  <MgTimer stopped={over} onexpire={expire} />
  <PitchScene {ball} spin={stage * 300} {kp} goal={stage === 2 && v.shot?.outcome === 'goal'} {trail} />
  {#if caption}<span class="mg-caption pop" class:ok={v.shot?.ok}>{caption}</span>{/if}
  <span class="mg-tap mg-readout">{readout || hint || '↑ 위로 끌었다 떼기'}</span>
</div>
