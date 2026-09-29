// 등장 모션(웹 @keyframes pop · pop-in · slide-in · rp-in). opacity는 건드리지 않고 transform만 움직인다 —
// 웹이 전환 중에도 글자 명도 대비를 그대로 두려고 정한 규칙이다. 동작 줄이기면 처음부터 끝 모양이다.
import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';
import { useSnapshot } from 'valtio';
import { prefs } from '../store';

/** 웹 cubic-bezier(0.3, 1.6, 0.5, 1) — 살짝 넘쳤다 돌아오는 팝. */
const POP_EASE = Easing.bezier(0.3, 1.6, 0.5, 1);

type Axis = 'scale' | 'translateX' | 'translateY';

/**
 * kind에 따라 from → 0(또는 1)로 delay 뒤에 움직인다.
 * scale: from → 1 · translateX/Y: from(px) → 0.
 */
export function Enter({
  children,
  kind = 'scale',
  from,
  ms = 320,
  delay = 0,
  ease,
  style,
}: {
  children: ReactNode;
  kind?: Axis;
  from: number;
  ms?: number;
  delay?: number;
  ease?: (t: number) => number;
  style?: StyleProp<ViewStyle>;
}) {
  const { motionOK } = useSnapshot(prefs);
  const to = kind === 'scale' ? 1 : 0;
  const v = useRef(new Animated.Value(motionOK ? from : to)).current;
  useEffect(() => {
    if (!motionOK) return;
    const a = Animated.timing(v, {
      toValue: to,
      duration: ms,
      delay,
      easing: ease ?? (kind === 'scale' ? POP_EASE : Easing.out(Easing.quad)),
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [motionOK, v, to, ms, delay, ease, kind]);
  return (
    <Animated.View style={[style, { transform: [{ [kind]: v } as never] }]}>
      {children}
    </Animated.View>
  );
}

/** 웹 .pop — 0.6배에서 튀어 오른다. */
export const Pop = (p: {
  children: ReactNode;
  delay?: number;
  from?: number;
  ms?: number;
  style?: StyleProp<ViewStyle>;
}) => (
  <Enter kind="scale" from={p.from ?? 0.6} ms={p.ms ?? 320} delay={p.delay ?? 0} style={p.style}>
    {p.children}
  </Enter>
);
