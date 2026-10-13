<script lang="ts">
  // T-11-191 진행 시트 위 무대에서 내 도트 선수가 돌아다닌다(박자는 app-core avatarStage.ts, 앱 sheets/AvatarStage.tsx).
  // '동작 줄이기'면 가운데에 서 있기만 한다. 장식이라 화면 읽기에서는 숨긴다.
  import { onMount } from 'svelte';
  import { avatarRects, type AvatarSpec } from '@offside/game/avatar';
  import {
    loadMotionPoses,
    MOTION_H,
    MOTION_W,
    MOTIONS,
    motionFrames,
    type MiniPoses,
    type MotionId,
  } from '@offside/game/avatar-motion';
  import { firstBeat, nextBeat, fieldBeat, fieldGeometry } from '@offside/app-core/avatarStage';

  const { spec, immersive = false, active = true }: { spec: AvatarSpec; immersive?: boolean; active?: boolean } = $props();
  const still = $derived(
    !active || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) ||
    spec.acc.some((a) => a === 'crutch' || a === 'suit' || a === 'bouquet'),
  );

  let stage: HTMLDivElement;
  let size = $state({ w: 0, h: 0 });
  let placed = $state(false);
  const pitch = $derived(fieldGeometry(size.w, size.h));
  onMount(() => {
    size = { w: stage.clientWidth, h: stage.clientHeight };
    let ready = requestAnimationFrame(() => { placed = true; });
    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        cancelAnimationFrame(ready);
        placed = false;
        size = { w: entry.contentRect.width, h: entry.contentRect.height };
        ready = requestAnimationFrame(() => { placed = true; });
      }
    });
    observer.observe(stage);
    return () => { cancelAnimationFrame(ready); observer.disconnect(); };
  });
  type Rects = ReturnType<typeof avatarRects>;
  // 자세 그림은 그 선수 머리 모양 것만 무대가 열릴 때 불러온다. 오기 전에는 서 있는 그림으로 움직인다.
  let poses = $state<MiniPoses | null>(null);
  $effect(() => {
    poses = null;
    if (still) return;
    let live = true;
    void loadMotionPoses(spec.hairStyle).then((p) => {
      if (live) poses = p;
    }).catch(() => {}); // 실패하면 같은 선수의 정지 그림을 유지한다. 다음 열기에서 재시도한다.
    return () => {
      live = false;
    };
  });
  // 모션마다 한 번만 칠한다(자세 그림이 오면 새로 칠한다).
  const cache = $derived.by(() => {
    void poses;
    void spec;
    return {} as Partial<Record<MotionId, Rects[]>>;
  });
  const rectsOf = (id: MotionId): Rects[] => (cache[id] ??= motionFrames(spec, id, poses).map(avatarRects));

  let beat = $state(firstBeat());
  let frame = $state(0);
  const rects = $derived(rectsOf(beat.motion)[frame] ?? rectsOf(beat.motion)[0]!);

  $effect(() => {
    beat = immersive ? fieldBeat() : firstBeat();
    frame = 0;
    if (still) return;
    let b = immersive ? fieldBeat() : firstBeat();
    let f = 0;
    let end = performance.now() + b.ms;
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      const now = performance.now();
      if (now >= end) {
        b = immersive ? fieldBeat((b.step ?? 0) + 1) : nextBeat(b);
        f = 0;
        end = now + b.ms;
        beat = b;
      } else f = (f + 1) % MOTIONS[b.motion].frames.length;
      frame = f;
      t = setTimeout(tick, MOTIONS[b.motion].frames[f]!.ms);
    };
    t = setTimeout(tick, Math.min(b.ms, MOTIONS[b.motion].frames[0]!.ms));
    return () => clearTimeout(t);
  });
</script>

<div bind:this={stage} class="avatar-stage" class:field={immersive} class:still aria-hidden="true" data-motion={still ? 'idle' : beat.motion}>
  {#if immersive}<svg class="field-lines" viewBox={`0 0 ${pitch.w} ${pitch.h}`}>
    <rect x={pitch.p} y={pitch.p} width={pitch.w-pitch.p*2} height={pitch.h-pitch.p*2} rx="2"/>
    <path d={pitch.halfway}/><circle cx={pitch.w/2} cy={pitch.h/2} r={pitch.radius}/>
    {#each pitch.boxes as box, i (i)}<rect x={box.x} y={box.y} width={box.w} height={box.h}/>{/each}
  </svg>{/if}
  <div class="avatar-walker" style:left="{(still && immersive ? 0.5 : beat.x) * 100}%" style:transform={immersive ? `translate3d(${(still ? 0.5 : beat.x) * size.w}px, ${(still ? 0.65 : beat.y ?? 0.65) * size.h}px, 0) translate(-50%, -75%)` : undefined} style:visibility={immersive && !size.w ? 'hidden' : undefined} style:transition-duration="{still || !placed ? 0 : beat.ms}ms">
    <svg class:flip={beat.flip} viewBox="0 0 {MOTION_W} {MOTION_H}" shape-rendering="crispEdges">{#each rects as r, i (i)}<rect x={r.x} y={r.y} width={r.w} height={r.h} fill={r.fill} fill-opacity={r.opacity} />{/each}</svg>
  </div>
</div>

<style>
  .avatar-stage.field { height: 100%; min-height: 160px; border: 0; background: repeating-linear-gradient(90deg, transparent 0 12.5%, rgb(0 0 0 / .07) 12.5% 25%), var(--pitch); border-radius: 0; }
  .field .avatar-walker { width: clamp(80px, 22vw, 128px); height: auto; bottom: auto; left: 0 !important; top: 0; transition-property: transform; }
  .field .avatar-walker svg { width: 100%; height: auto; }
  .field-lines { position: absolute; inset: 0; width: 100%; height: 100%; fill: none; stroke: var(--on-pitch); stroke-opacity: .28; stroke-width: 2; }
  .still .avatar-walker { transition: none; }
</style>
