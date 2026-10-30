// T-11-371 팩 오픈식 결과 공개 연출(웹 RevealFx.svelte). 결과는 이미 정해져 저장된 뒤에 보여 주기만 한다.
// 등급 공개(후보 잠재력 범위 · 시즌 스카우트 평가 · 은퇴 때 실제 잠재력): 뒷면(?) → 단서(등급 글자가 아래부터 훑고 올라가며
// 끝으로 갈수록 느려진다) → 결과(강도별 색 · 진동). 눌러서 건너뛴다. 동작 줄이기 · "연출 짧게"면 결과만 보인다.
// 대박은 화면 가장자리가 잠깐 빛난다(RevealEdgeHost, 루트에 하나). 새 npm 패키지 없이 Animated · expo-haptics만 쓴다.
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, type TextStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { proxy, useSnapshot } from 'valtio';
import {
  gradeSweep,
  revealTiming,
  revealTotal,
  sweepAt,
  type RevealTier,
} from '@offside/app-core/reveal';
import { revealText as R } from '@offside/app-core/i18n/ko/reveal';
import { hapticsOn } from '../game/host';
import { prefs } from '../store';
import { useColors } from '../theme/useColors';
import { Txt } from '../ui/Txt';

/** 강도별 진동 — 보통은 없음. */
export function revealBuzz(tier: RevealTier) {
  if (tier === 'normal' || !hapticsOn()) return;
  void (
    tier === 'jackpot'
      ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
  ).catch(() => {});
}

const edge = proxy({ n: 0 });
/** 대박 결과 — 화면 가장자리를 잠깐 빛낸다. */
export const flashEdge = () => {
  if (prefs.motionOK) edge.n++;
};

/** 화면 가장자리 빛(루트 레이아웃에 하나). 눌림을 막지 않는다. iOS에서 느린 SVG 필터 대신 테두리 View의 투명도만 움직인다. */
export function RevealEdgeHost() {
  const c = useColors();
  const { n } = useSnapshot(edge);
  const [o] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!n) return;
    o.setValue(1);
    const a = Animated.timing(o, {
      toValue: 0,
      duration: 1400,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [n, o]);
  if (!n) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { opacity: o, borderWidth: 5, borderColor: c.accent }]}
    />
  );
}

type Phase = 'back' | 'hint' | 'hold' | 'done';

/** 연출 단계 시계. run이 false인 동안은 뒷면에서 기다린다(스크롤로 장면이 들어올 때 시작). */
export function useRevealPhase(tier: RevealTier, { run = true, repeat = false } = {}) {
  const { motionOK, revealShort } = useSnapshot(prefs);
  const [timing] = useState(() =>
    revealTiming(tier, { off: !motionOK, short: revealShort, repeat }),
  );
  const instant = revealTotal(timing) === 0;
  const [phase, setPhase] = useState<Phase>(instant ? 'done' : 'back');
  const [x, setX] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const raf = useRef(0);
  const landed = useRef(false);
  const land = () => {
    if (landed.current) return;
    landed.current = true;
    timers.current.forEach(clearTimeout);
    cancelAnimationFrame(raf.current);
    setPhase('done');
    revealBuzz(tier);
    if (tier === 'jackpot' && !instant) flashEdge();
  };
  useEffect(() => {
    if (instant) {
      if (!landed.current) {
        landed.current = true;
        revealBuzz(tier);
      }
      return;
    }
    if (!run || landed.current) return;
    timers.current.push(
      setTimeout(() => {
        setPhase('hint');
        const t0 = Date.now();
        const step = () => {
          const v = Math.min(1, (Date.now() - t0) / timing.hint);
          setX(v);
          if (v < 1) raf.current = requestAnimationFrame(step);
          else if (timing.hold) {
            setPhase('hold');
            timers.current.push(setTimeout(land, timing.hold));
          } else land();
        };
        raf.current = requestAnimationFrame(step);
      }, timing.back),
    );
    const list = timers.current;
    return () => {
      list.forEach(clearTimeout);
      cancelAnimationFrame(raf.current);
    };
  }, [run, instant, timing, tier]);
  return { phase, x, land, timing, instant };
}

/**
 * 글자 안에 넣는 등급 공개(<Txt>{...}<RevealGrade/></Txt>도 된다). grade는 'C~B'처럼 범위여도 되고 높은 쪽까지 훑는다.
 * 결과 단계의 글자는 text. 좋음 · 대박이면 금색 굵게.
 */
export function RevealGrade({
  grade,
  text,
  tier,
  run = true,
  testID,
  style,
  hotColor,
}: {
  grade: string;
  text: string;
  tier: RevealTier;
  run?: boolean;
  testID?: string;
  style?: TextStyle;
  /** 좋음 · 대박 글자색(어두운 크레딧 배경은 금색). 기본은 강조 글자색. */
  hotColor?: string;
}) {
  const c = useColors();
  const { phase, x, land } = useRevealPhase(tier, { run });
  const [steps] = useState(() => gradeSweep(grade));
  const hot = tier !== 'normal';
  const hc = hotColor ?? c.accentText;
  if (phase === 'done')
    return (
      <Txt
        testID={testID}
        accessibilityLiveRegion="polite"
        accessibilityLabel={R.gradeLive({
          text,
          tier: tier === 'jackpot' ? R.jackpot : tier === 'good' ? R.good : '',
        })}
        style={[style, hot ? { color: hc, fontWeight: '700' } : null]}
      >
        {text}
      </Txt>
    );
  const letter = phase === 'back' ? '?' : phase === 'hold' ? steps.at(-1)! : sweepAt(steps, x);
  return (
    <Txt
      testID={testID ? `${testID}-rolling` : undefined}
      accessibilityRole="button"
      accessibilityLabel={R.skip}
      onPress={land}
      style={[style, hot ? { color: hc } : null]}
    >
      {letter}
      <Txt tone="muted" style={{ fontSize: 11, fontWeight: '400' }}>{`  ${R.skip}`}</Txt>
    </Txt>
  );
}
