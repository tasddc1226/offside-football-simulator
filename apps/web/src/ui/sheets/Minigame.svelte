<script lang="ts">
  // T-10-089 원터치 미니게임. 게이지 위를 왕복하는 바늘을 한 번 탭해 멈춘다(장면 전체가 버튼 하나).
  // 탭한 순간의 바늘 위치는 마지막으로 그린 프레임이 아니라 입력 시각(event.timeStamp)으로 계산한다 — 프레임
  // 간격만큼 판정이 밀리지 않게. 판정이 나면(v.ok) 공이 날아가는 결과 장면을 두 단계로 그린다.
  import { onMount } from 'svelte';
  import { markerAt, MG_TAP } from '../../game/minigame.js';
  import MgTimer from './MgTimer.svelte';
  import PitchScene, { type BallPose, type DefenderPose, type KeeperPose } from './PitchScene.svelte';
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
  /** 제한 시간이 지나도록 누르지 않았다 — 공은 그대로, 실패. */
  let late = $state(false);
  function expire() {
    if (tapped) return;
    tapped = late = true;
    v.onTap(null);
  }

  type Pose = BallPose;
  const SPOT: Pose = { x: 150, y: 148, s: 1.35 };
  /** 단계별 공 위치(골문 앞 시점, viewBox 300×170). */
  const ball = $derived.by((): Pose => {
    if (stage === 0 || v.ok === null || late) return SPOT;
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
        // 실패는 이벤트 문구("너무 길게 쳤습니다. 공이 엔드라인을 넘어갔습니다")처럼 골대 옆으로 흘러 나간다.
        return v.ok
          ? two({ x: 150 - s * 34, y: 122, s: 0.8 }, { x: 150 - s * 44, y: 98, s: 0.6 })
          : two({ x: 150 - s * 48, y: 120, s: 0.8 }, { x: 150 - s * 104, y: 106, s: 0.55 });
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
  type KPose = KeeperPose;
  /** 골키퍼 자세. 슈팅 계열에선 상대 키퍼, save에선 나. */
  const kp = $derived.by((): KPose => {
    if (stage === 0 || v.ok === null || late) return { dx: 0, dy: 0, rot: 0 };
    const s = side;
    if (v.mg === 'chip') return { dx: 0, dy: v.ok ? -4 : -12, rot: 0 };
    if (hold) return v.ok ? { dx: 0, dy: -4, rot: 0 } : { dx: s * 14, dy: -4, rot: s * 25 };
    // 페널티킥이 들어가면 키퍼는 반대로 속고, 나머지는 공 쪽으로 몸을 던진다(드리블 성공은 그 반대로 제친다).
    const toward = v.mg !== 'shot' || !v.ok;
    const d = toward ? s : -s;
    return { dx: d * (v.mg === 'save' && !v.ok ? 30 : 38), dy: -6, rot: d * 68 };
  });
  /** 골이 들어갔는가(그물 흔들기). */
  const goal = $derived(stage === 2 && v.ok !== null && (v.mg === 'save' ? !v.ok : v.ok));
  const caption = $derived.by(() => {
    if (v.ok === null) return '';
    if (late) return '시간 초과!';
    if (v.mg === 'save') return v.ok ? '선방!' : '실점…';
    if (v.ok) return '골!';
    return v.mg === 'shot' ? '크로스바!' : v.mg === 'dribble' ? '너무 길었다!' : '막혔다!';
  });
  const me = $derived(v.mg === 'save');
  /**
   * 제치기: 뒤쫓아 온 수비수 둘이 양옆에서 좁혀 온다. 탭하면 공 쪽으로 몸을 날리지만(슬라이딩) 이미 늦었다 —
   * 이벤트 문구대로 키퍼와는 단둘이다.
   */
  const defenders = $derived.by((): DefenderPose[] => {
    if (v.mg !== 'dribble') return [];
    // 둘 다 공이 빠져나간 쪽(키퍼 반대쪽)으로 슬라이딩한다 — 가운데로 모이면 한데 겹쳐 보인다.
    const dir = -side;
    const pose = stage > 0 && v.ok !== null && !late ? { dx: dir * 14, dy: 6, rot: dir * 75 } : { dx: 0, dy: 0, rot: 0 };
    return [
      { x: 102, y: 140, num: 4, ...pose },
      { x: 200, y: 136, num: 5, ...pose },
    ];
  });
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
  <MgTimer stopped={tapped} onexpire={expire} />
  <PitchScene {ball} spin={stage * 280 * side} {kp} {me} {goal} {defenders} />
  {#if caption}<span class="mg-caption pop" class:ok={v.ok}>{caption}</span>{/if}
  <span class="mg-gauge" aria-hidden="true">
    <span class="mg-zone" style="left:{(v.center - v.w / 2) * 100}%;width:{v.w * 100}%"></span>
    <i class="needle" style="left:calc({pos * 100}% - 1px)"></i>
  </span>
  <span class="mg-tap">{tapped ? ' ' : MG_TAP[v.mg]}</span>
</button>
