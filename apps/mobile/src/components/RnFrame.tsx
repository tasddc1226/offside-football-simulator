// 영구결번 도트 액자(@offside/game/rnFrame, 웹 RnFrame.svelte). 은퇴 세리머니·기록실 결번 벽·결번 알림·공유 이미지가 같이 쓴다.
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSnapshot } from 'valtio';
import { RN_FRAME_H, RN_FRAME_W, rnFramePaths } from '@offside/game/rnFrame';
import { prefs } from '../store';

/** 액자 높이(px) — 폭에 맞춘 도안 비율. */
export const rnFrameHeight = (width: number) => (width * RN_FRAME_H) / RN_FRAME_W;

/** 결번 액자. width는 px(칸이 고르게 보이려면 RN_FRAME_W의 정수배가 좋다). */
export function RnFrame({
  clubId,
  number,
  width,
}: {
  clubId: string | null | undefined;
  number: number;
  width: number;
}) {
  const paths = rnFramePaths(clubId, number);
  return (
    <Svg
      width={width}
      height={rnFrameHeight(width)}
      viewBox={`0 0 ${RN_FRAME_W} ${RN_FRAME_H}`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {paths.map((p) => (
        <Path key={p.fill} d={p.d} fill={p.fill} />
      ))}
    </Svg>
  );
}

/** 커튼 주름 4색(4px씩 반복, 웹 .rn-curtain과 같은 색). 마지막 색은 둘째 색과 같아 세 path로 합친다. */
const VELVET = ['#4d0b14', '#7a1420', '#a3202f', '#7a1420'] as const;
/** 도트 커튼 한 폭: 세로 주름(4칸 계단)과 금빛 위 띠. */
function Curtain({ w, h }: { w: number; h: number }) {
  const byFill = new Map<string, string>();
  for (let i = 0; i * 4 < w; i++) {
    const f = VELVET[i % VELVET.length]!;
    byFill.set(f, `${byFill.get(f) ?? ''}M${i * 4} 0h4v${h}h-4z`);
  }
  return (
    <Svg width={w} height={h}>
      {[...byFill].map(([fill, d]) => (
        <Path key={fill} d={d} fill={fill} />
      ))}
      <Path d={`M0 0h${w}v8h-${w}z`} fill="#c9a24a" />
      <Path d={`M0 8h${w}v3h-${w}z`} fill="#6e4f12" />
    </Svg>
  );
}

/** 은퇴 세리머니: 도트 커튼이 계단식으로 걷히며 액자가 드러난다. 동작 줄이기면 바로 액자만. */
export function RnUnveil({
  clubId,
  number,
}: {
  clubId: string | null | undefined;
  number: number;
}) {
  const width = RN_FRAME_W * 3;
  const height = rnFrameHeight(width);
  const { motionOK } = useSnapshot(prefs);
  const open = useRef(new Animated.Value(motionOK ? 0 : 1)).current;
  const [done, setDone] = useState(!motionOK);
  useEffect(() => {
    if (!motionOK) return;
    // 12단계로 끊어 픽셀처럼 걷는다.
    const anim = Animated.timing(open, {
      toValue: 1,
      duration: 1600,
      delay: 300,
      easing: (t) => Math.floor(Easing.inOut(Easing.quad)(t) * 12) / 12,
      useNativeDriver: true,
    });
    anim.start(({ finished }) => finished && setDone(true));
    return () => anim.stop();
  }, [motionOK, open]);
  const half = width / 2 + 6;
  return (
    <View style={{ width, height, overflow: 'hidden' }}>
      <RnFrame clubId={clubId} number={number} width={width} />
      {done ? null : (
        <>
          <Animated.View
            style={{
              position: 'absolute',
              left: -6,
              top: 0,
              transform: [
                { translateX: open.interpolate({ inputRange: [0, 1], outputRange: [0, -half] }) },
              ],
            }}
          >
            <Curtain w={half} h={height} />
          </Animated.View>
          <Animated.View
            style={{
              position: 'absolute',
              right: -6,
              top: 0,
              transform: [
                { translateX: open.interpolate({ inputRange: [0, 1], outputRange: [0, half] }) },
              ],
            }}
          >
            <Curtain w={half} h={height} />
          </Animated.View>
        </>
      )}
    </View>
  );
}
