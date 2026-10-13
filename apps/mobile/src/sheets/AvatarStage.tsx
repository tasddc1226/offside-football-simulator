// Run and kick poses selected by the shared popup choreography.
import { memo, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
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
import { prefs } from '../store';

export const AvatarStage = memo(function AvatarStage({
  spec,
  active = true,
  onReady,
  motion = 'run',
  frame = 0,
}: {
  spec: AvatarSpec;
  active?: boolean;
  onReady?: (ready: boolean) => void;
  motion?: MotionId;
  frame?: number;
}) {
  const still = !canRun(spec, active && prefs.motionOK);
  const [poses, setPoses] = useState<MiniPoses | null>(null);
  useEffect(() => {
    setPoses(null);
    if (still) return;
    let live = true;
    void loadMotionPoses(spec.hairStyle)
      .then((p) => {
        if (live) setPoses(p);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [spec.hairStyle, still]);
  const cache = useMemo(() => new Map<MotionId, ReturnType<typeof avatarRects>[]>(), [spec, poses]);
  const rectsOf = (id: MotionId) => {
    let r = cache.get(id);
    if (!r)
      cache.set(
        id,
        (r = MOTIONS[id].frames.map((f) => {
          const body: MotionFrame = { ...f };
          delete body.ball;
          return avatarRects(motionFrame(spec, body, poses));
        })),
      );
    return r;
  };
  useEffect(() => onReady?.(!still && !!poses), [still, poses, onReady]);
  const frames = rectsOf(still || !poses ? 'idle' : motion);
  const rects = frames[frame] ?? frames[0]!;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: '100%', height: '100%' }}
    >
      <Svg width="100%" height="100%" viewBox={`0 0 ${MOTION_W} ${MOTION_H}`}>
        {rects.map((r, i) => (
          <Rect
            key={i}
            x={r.x}
            y={r.y}
            width={r.w}
            height={r.h}
            fill={r.fill}
            {...(r.opacity ? { fillOpacity: r.opacity } : {})}
          />
        ))}
      </Svg>
    </View>
  );
});
