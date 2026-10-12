<script lang="ts">
  // T-11-191 진행 시트 위 무대에서 내 도트 선수가 돌아다닌다(박자는 app-core avatarStage.ts, 앱 sheets/AvatarStage.tsx).
  // '동작 줄이기'면 가운데에 서 있기만 한다. 장식이라 화면 읽기에서는 숨긴다.
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
  import { firstBeat, nextBeat } from '@offside/app-core/avatarStage';

  const { spec }: { spec: AvatarSpec } = $props();
  const still = $derived(
    (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) ||
    spec.acc.some((a) => a === 'crutch' || a === 'suit' || a === 'bouquet'),
  );

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
    beat = firstBeat();
    frame = 0;
    if (still) return;
    let b = firstBeat();
    let f = 0;
    let end = performance.now() + b.ms;
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      const now = performance.now();
      if (now >= end) {
        b = nextBeat(b);
        f = 0;
        end = now + b.ms;
        beat = b;
      } else f = (f + 1) % MOTIONS[b.motion].frames.length;
      frame = f;
      t = setTimeout(tick, MOTIONS[b.motion].frames[f]!.ms);
    };
    t = setTimeout(tick, MOTIONS[b.motion].frames[0]!.ms);
    return () => clearTimeout(t);
  });
</script>

<div class="avatar-stage" aria-hidden="true">
  <div class="avatar-walker" style:left="{beat.x * 100}%" style:transition-duration="{beat.ms}ms">
    <svg class:flip={beat.flip} viewBox="0 0 {MOTION_W} {MOTION_H}" shape-rendering="crispEdges">{#each rects as r, i (i)}<rect x={r.x} y={r.y} width={r.w} height={r.h} fill={r.fill} fill-opacity={r.opacity} />{/each}</svg>
  </div>
</div>
