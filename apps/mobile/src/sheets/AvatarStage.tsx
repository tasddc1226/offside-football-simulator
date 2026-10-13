// T-11-191 진행 시트 위 무대에서 내 도트 선수가 돌아다닌다(웹 ui/sheets/AvatarStage.svelte, 박자는 app-core avatarStage.ts).
// '동작 줄이기'면 가운데에 서 있기만 한다. 장식이라 화면 읽기에서는 숨긴다.
import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Rect, Path, Circle } from 'react-native-svg';
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
import {
  firstBeat,
  nextBeat,
  fieldBeat,
  fieldGeometry,
  type StageBeat,
} from '@offside/app-core/avatarStage';
import { prefs } from '../store';
import { useColors } from '../theme/useColors';

const SCALE = 2;
const W = MOTION_W * SCALE;
const H = MOTION_H * SCALE;

export function AvatarStage({
  spec,
  immersive = false,
  active = true,
}: {
  spec: AvatarSpec;
  immersive?: boolean;
  active?: boolean;
}) {
  const c = useColors();
  const still =
    !active ||
    !prefs.motionOK ||
    spec.acc.some((a) => a === 'crutch' || a === 'suit' || a === 'bouquet');
  const [stageW, setStageW] = useState(0);
  const [stageH, setStageH] = useState(0);
  const [y] = useState(() => new Animated.Value(0.66));
  const [beat, setBeat] = useState<StageBeat>(firstBeat);
  const [frame, setFrame] = useState(0);
  const [x] = useState(() => new Animated.Value(0.5));
  // 자세 그림은 그 선수 머리 모양 것만 무대가 열릴 때 불러온다. 오기 전에는 서 있는 그림으로 움직인다.
  const [poses, setPoses] = useState<MiniPoses | null>(null);
  useEffect(() => {
    setPoses(null);
    if (still) return;
    let live = true;
    void loadMotionPoses(spec.hairStyle)
      .then((p) => {
        if (live) setPoses(p);
      })
      .catch(() => {}); // 실패하면 정지 그림을 유지한다. 다음 열기에서 재시도한다.
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
    setBeat(immersive ? fieldBeat() : firstBeat());
    setFrame(0);
    x.setValue(immersive && !still ? 0.32 : 0.5);
    y.setValue(0.66);
    if (still) return;
    let b = immersive ? fieldBeat() : firstBeat();
    let f = 0;
    let end = Date.now() + b.ms;
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      const now = Date.now();
      if (now >= end) {
        b = immersive ? fieldBeat((b.step ?? 0) + 1) : nextBeat(b);
        f = 0;
        end = now + b.ms;
        setBeat(b);
        if (immersive)
          Animated.timing(y, {
            toValue: b.y ?? 0.66,
            duration: b.ms,
            easing: Easing.linear,
            useNativeDriver: true,
          }).start();
        Animated.timing(x, {
          toValue: b.x,
          duration: b.ms,
          easing: Easing.linear,
          useNativeDriver: true,
        }).start();
      } else f = (f + 1) % MOTIONS[b.motion].frames.length;
      setFrame(f);
      t = setTimeout(tick, MOTIONS[b.motion].frames[f]!.ms);
    };
    t = setTimeout(tick, Math.min(b.ms, MOTIONS[b.motion].frames[0]!.ms));
    return () => {
      clearTimeout(t);
      x.stopAnimation();
      y.stopAnimation();
    };
  }, [still, x, y, immersive]);

  const pitch = fieldGeometry(stageW, stageH);
  const frames = rectsOf(still ? 'idle' : beat.motion);
  const rects = frames[frame] ?? frames[0]!;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={(e) => {
        setStageW(e.nativeEvent.layout.width);
        setStageH(e.nativeEvent.layout.height);
      }}
      style={{
        height: immersive ? '100%' : H,
        minHeight: immersive ? 150 : H,
        borderBottomWidth: immersive ? 0 : 2,
        borderColor: c.line,
        backgroundColor: immersive ? c.pitch : undefined,
        overflow: 'hidden',
      }}
    >
      {immersive ? (
        <Svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${pitch.w} ${pitch.h}`}
          style={{ position: 'absolute' }}
        >
          <Rect
            x={pitch.p}
            y={pitch.p}
            width={pitch.w - pitch.p * 2}
            height={pitch.h - pitch.p * 2}
            rx={2}
            fill="none"
            stroke={c.onPitch}
            strokeOpacity={0.28}
            strokeWidth={2}
          />
          <Path
            d={pitch.halfway}
            fill="none"
            stroke={c.onPitch}
            strokeOpacity={0.28}
            strokeWidth={2}
          />
          <Circle
            cx={pitch.w / 2}
            cy={pitch.h / 2}
            r={pitch.radius}
            fill="none"
            stroke={c.onPitch}
            strokeOpacity={0.28}
            strokeWidth={2}
          />
          {pitch.boxes.map((b, i) => (
            <Rect
              key={i}
              x={b.x}
              y={b.y}
              width={b.w}
              height={b.h}
              fill="none"
              stroke={c.onPitch}
              strokeOpacity={0.28}
              strokeWidth={2}
            />
          ))}
        </Svg>
      ) : null}
      {stageW ? (
        <Animated.View
          style={{
            position: 'absolute',
            top: immersive ? 0 : undefined,
            bottom: immersive ? undefined : 0,
            left: -W / 2,
            width: W,
            height: H,
            transform: [
              { translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, stageW] }) },
              ...(immersive
                ? [
                    {
                      translateY: y.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-H * 0.75, stageH - H * 0.75],
                      }),
                    },
                    { scale: 1.4 },
                  ]
                : []),
              { scaleX: beat.flip ? -1 : 1 },
            ],
          }}
        >
          <Svg width={W} height={H} viewBox={`0 0 ${MOTION_W} ${MOTION_H}`}>
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
        </Animated.View>
      ) : null}
    </View>
  );
}
