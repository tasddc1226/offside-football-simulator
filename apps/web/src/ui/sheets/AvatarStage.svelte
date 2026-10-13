<script lang="ts">
  // Run and kick poses selected by the shared popup choreography.
  import { avatarRects, type AvatarSpec } from '@offside/game/avatar';
  import {
    loadMotionPoses,
    MOTION_H,
    MOTION_W,
    MOTIONS,
    motionFrame,
    type MiniPoses,
    type MotionId,
    type MotionFrame,
  } from '@offside/game/avatar-motion';
  import { canRun } from '@offside/app-core/avatarStage';

  const { spec, active = true, motion = 'run', frame = 0, onReady }: { spec: AvatarSpec; active?: boolean; motion?: MotionId; frame?: number; onReady?: (ready: boolean) => void } = $props();
  const still = $derived(!canRun(spec, active));

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
  const rectsOf = (id: MotionId): Rects[] => (cache[id] ??= MOTIONS[id].frames.map(f => {
    const body: MotionFrame = { ...f };
    delete body.ball;
    return avatarRects(motionFrame(spec, body, poses));
  }));

  const shownMotion = $derived(still || !poses ? 'idle' : motion);
  const rects = $derived(rectsOf(shownMotion)[frame] ?? rectsOf(shownMotion)[0]!);
  $effect(() => onReady?.(!still && !!poses));

</script>

<div class="avatar-stage" aria-hidden="true" data-motion={shownMotion} data-frame={still || !poses ? 0 : frame}>
  <div class="avatar-walker">
    <svg viewBox="0 0 {MOTION_W} {MOTION_H}" shape-rendering="crispEdges">{#each rects as r, i (i)}<rect x={r.x} y={r.y} width={r.w} height={r.h} fill={r.fill} fill-opacity={r.opacity} />{/each}</svg>
  </div>
</div>

<style>
  .avatar-stage { width: 100%; height: 100%; background: transparent; }
  .avatar-walker, svg { display: block; width: 100%; height: 100%; }
</style>
