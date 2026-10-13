// Decorative running poses; ProgressRunner handles travel along the popup edge.
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
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
import { canRun } from '@offside/app-core/avatarStage';
import { prefs } from '../store';

export function AvatarStage({
  spec,
  active = true,
  onReady,
}: {
  spec: AvatarSpec;
  active?: boolean;
  onReady?: (ready: boolean) => void;
}) {
  const still = !canRun(spec, active && prefs.motionOK);
  const [frame, setFrame] = useState(0);
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
    if (!r) cache.set(id, (r = motionFrames(spec, id, poses).map(avatarRects)));
    return r;
  };
  useEffect(() => onReady?.(!still && !!poses), [still, poses, onReady]);
  useEffect(() => {
    setFrame(0);
    if (still || !poses) return;
    let f = 0;
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      f = (f + 1) % MOTIONS.run.frames.length;
      setFrame(f);
      t = setTimeout(tick, MOTIONS.run.frames[f]!.ms);
    };
    t = setTimeout(tick, MOTIONS.run.frames[0]!.ms);
    return () => clearTimeout(t);
  }, [still, poses]);
  const frames = rectsOf(still || !poses ? 'idle' : 'run');
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
}
