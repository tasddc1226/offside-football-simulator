// T-11-191 배경 없이 중앙에서 내 선수의 제자리 모션을 재생한다(웹·앱 공통 박자).
// '동작 줄이기'면 가운데에 서 있기만 한다. 장식이라 화면 읽기에서는 숨긴다.
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
import { progressBeat, type StageBeat } from '@offside/app-core/avatarStage';
import { prefs } from '../store';

export function AvatarStage({ spec, active = true }: { spec: AvatarSpec; active?: boolean }) {
  const still =
    !active ||
    !prefs.motionOK ||
    spec.acc.some((a) => a === 'crutch' || a === 'suit' || a === 'bouquet');
  const [beat, setBeat] = useState<StageBeat>(progressBeat);
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
  useEffect(() => {
    setBeat(progressBeat());
    setFrame(0);
    if (still) return;
    let b = progressBeat();
    let f = 0;
    let end = Date.now() + b.ms;
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      const now = Date.now();
      if (now >= end) {
        b = progressBeat(b.step + 1);
        f = 0;
        end = now + b.ms;
        setBeat(b);
      } else f = (f + 1) % MOTIONS[b.motion].frames.length;
      setFrame(f);
      t = setTimeout(tick, MOTIONS[b.motion].frames[f]!.ms);
    };
    t = setTimeout(tick, Math.min(b.ms, MOTIONS[b.motion].frames[0]!.ms));
    return () => clearTimeout(t);
  }, [still]);
  const frames = rectsOf(still ? 'idle' : beat.motion);
  const rects = frames[frame] ?? frames[0]!;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: '100%', height: '100%' }}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${MOTION_W} ${MOTION_H}`}
        style={{ transform: [{ scaleX: beat.flip ? -1 : 1 }] }}
      >
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
