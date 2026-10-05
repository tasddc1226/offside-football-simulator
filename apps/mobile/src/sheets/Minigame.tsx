// 원터치 미니게임(웹 sheets/Minigame.svelte, T-10-089). 게이지 위를 왕복하는 바늘을 한 번 탭해 멈춘다(장면 전체가 버튼 하나).
// T-11-047 바늘은 UI 스레드(네이티브 드라이버)에서 움직이고, 판정은 탭할 때 멈춘 바늘의 실제 값으로 한다 — 보이는 자리가
// 곧 판정 자리다. 예전엔 JS가 프레임마다 위치를 고쳐 그리고 판정은 입력 시각으로 따로 계산했는데, 안드로이드(새 구조의
// requestAnimationFrame은 vsync가 아니라 setTimeout 0)에선 그려진 바늘이 실제 시각보다 뒤처져 탭하는 순간 판정 위치로
// 튀었다. 손가락이 닿는 순간(onPressIn)을 입력으로 보고, 스크린 리더 활성화(onPress)는 같은 함수를 부른다.
// 판정이 나면(v.ok, sheet-controller가 채운다) 공이 날아가는 결과 장면을 두 단계로 그린다.
import { memo, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import { useSnapshot } from 'valtio';
import { markerAt, MG_TAP, SWEEP_MS } from '@offside/game/minigame';
import type { SheetView } from '@offside/app-core/sheets';
import { sheetMinigameText as L } from '@offside/app-core/i18n/ko/sheetMinigame';
import { alpha } from '../theme/colors';
import { useColors } from '../theme/useColors';
import { DISPLAY, rem } from '../theme/type';
import { Txt } from '../ui/Txt';
import { Pop } from './anim';
import { MgTimer } from './MgTimer';
import { mixColor } from './parts';
import {
  PitchScene,
  REST,
  SPOT_POSE,
  type BallPose,
  type DefenderPose,
  type KeeperPose,
} from './PitchScene';

/** 바늘 진행값 k의 꺾이는 점. markerAt은 이 점들 사이에서 곧은 삼각파라, 이 점에서 잰 값으로 화면 모양을 만든다. */
const SWEEP_K = [0, 1, 2];

/**
 * 게이지 위를 왕복하는 바늘. k는 0→2를 한 번 왕복(SWEEP_MS × 2) 동안 고르게 오르고, 화면엔 markerAt(k × SWEEP_MS)
 * 위치로 그린다(0→1→0). 폭(width)은 게이지를 잰 값이다.
 */
const Needle = memo(function Needle({ k, width }: { k: Animated.Value; width: Animated.Value }) {
  const c = useColors();
  const [x] = useState(() =>
    Animated.multiply(
      k.interpolate({
        inputRange: SWEEP_K,
        outputRange: SWEEP_K.map((at) => markerAt(at * SWEEP_MS)),
      }),
      width,
    ),
  );
  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: -5,
        bottom: -5,
        left: 0,
        marginLeft: -3,
        width: 8,
        borderWidth: 2,
        borderColor: c.pitch,
        borderRadius: 4,
        backgroundColor: c.chalk,
        transform: [{ translateX: x }],
      }}
    />
  );
});

export function Minigame({ v }: { v: Extract<SheetView, { kind: 'minigame' }> }) {
  const s = useSnapshot(v);
  const c = useColors();
  const [tapped, setTapped] = useState(false);
  /** 결과 장면 단계: 0 겨냥 · 1 공이 날아가는 중 · 2 마무리. */
  const [stage, setStage] = useState(0);
  /** 제한 시간이 지나도록 누르지 않았다 — 공은 그대로, 실패. */
  const [late, setLate] = useState(false);
  const k = useRef(new Animated.Value(0)).current;
  const gauge = useRef(new Animated.Value(0)).current;
  const done = useRef(false);
  /** 공이 향할 쪽(-1 왼쪽 · 1 오른쪽). 선택지가 정하지 않았으면 무작위(화면 연출이라 게임 RNG를 쓰지 않는다). */
  const [rs] = useState<-1 | 1>(() => (Math.random() < 0.5 ? -1 : 1));
  /** 제자리에서 버티는 선택(끝까지 기다린다). */
  const hold = s.side === 0;
  const side = s.side || rs;

  useEffect(() => {
    const sweep = Animated.loop(
      Animated.timing(k, {
        toValue: 2,
        duration: SWEEP_MS * 2,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    sweep.start();
    return () => sweep.stop();
  }, [k]);

  useEffect(() => {
    if (s.ok === null) return;
    setStage(1);
    const t = setTimeout(() => setStage(2), 380);
    return () => clearTimeout(t);
  }, [s.ok]);

  function tap() {
    if (done.current) return;
    done.current = true;
    setTapped(true);
    // 멈춘 바늘의 값(네이티브 값이면 UI 스레드에서 읽어 온다)으로 판정한다.
    k.stopAnimation((at) => v.onTap(markerAt(at * SWEEP_MS)));
  }
  function expire() {
    if (done.current) return;
    done.current = true;
    setTapped(true);
    setLate(true);
    k.stopAnimation();
    v.onTap(null);
  }

  /** 아직 결과 장면이 아니다(겨냥 중이거나 시간 초과 — 공·키퍼는 그대로). stage는 판정(s.ok)이 난 뒤에야 오른다. */
  const idle = stage === 0 || late;
  /** 단계별 공 위치(골문 앞 시점, viewBox 300×170). */
  const ball = ((): BallPose => {
    if (idle) return SPOT_POSE;
    const d = side;
    const two = (a: BallPose, b: BallPose) => (stage === 1 ? a : b);
    switch (s.mg) {
      case 'shot':
        return s.ok
          ? two({ x: 150 + d * 50, y: 70, s: 0.7 }, { x: 150 + d * 62, y: 48, s: 0.6 })
          : two({ x: 150 + d * 34, y: 30, s: 0.62 }, { x: 150 + d * 58, y: 4, s: 0.5 });
      case 'chip':
        return s.ok
          ? two({ x: 150 + d * 6, y: 26, s: 0.75 }, { x: 150 + d * 16, y: 62, s: 0.55 })
          : two({ x: 150, y: 44, s: 0.75 }, { x: 150, y: 74, s: 0.6 });
      case 'dribble':
        // 실패는 이벤트 문구("너무 길게 쳤습니다. 공이 엔드라인을 넘어갔습니다")처럼 골대 옆으로 흘러 나간다.
        return s.ok
          ? two({ x: 150 - d * 34, y: 122, s: 0.8 }, { x: 150 - d * 44, y: 98, s: 0.6 })
          : two({ x: 150 - d * 48, y: 120, s: 0.8 }, { x: 150 - d * 104, y: 106, s: 0.55 });
      case 'save':
        // 막으면 공이 키퍼 몸에 맞고 밖으로 튕겨 나간다 — 버티면 몸통에 맞고 크로스바 위로, 몸을 던지면 옆구리에
        // 맞고 골대 옆으로(카메라 쪽으로 커지며). 다이빙한 키퍼의 몸통은 발에서 옆으로 60쯤, 골라인 위 20쯤이다.
        if (hold)
          return s.ok
            ? two({ x: 150, y: 88, s: 0.72 }, { x: 150 + d * 42, y: 13, s: 0.55 })
            : two({ x: 150 + d * 56, y: 56, s: 0.66 }, { x: 150 + d * 70, y: 40, s: 0.58 });
        return s.ok
          ? two({ x: 150 + d * 62, y: 90, s: 0.7 }, { x: 150 + d * 112, y: 132, s: 0.85 })
          : two({ x: 150 + d * 56, y: 56, s: 0.66 }, { x: 150 + d * 68, y: 40, s: 0.58 });
    }
  })();
  /** 골키퍼 자세. 슈팅 계열에선 상대 키퍼, save에선 나. */
  const kp = ((): KeeperPose => {
    if (idle) return REST;
    const d = side;
    if (s.mg === 'chip') return { dx: 0, dy: s.ok ? -4 : -12, rot: 0 };
    if (hold) return s.ok ? { dx: 0, dy: -4, rot: 0 } : { dx: d * 14, dy: -4, rot: d * 25 };
    // 페널티킥이 들어가면 키퍼는 반대로 속고, 나머지는 공 쪽으로 몸을 던진다(드리블 성공은 그 반대로 제친다).
    const toward = s.mg !== 'shot' || !s.ok;
    const k = toward ? d : -d;
    return { dx: k * (s.mg === 'save' && !s.ok ? 30 : 38), dy: -6, rot: k * 68 };
  })();
  /** 골이 들어갔는가(그물 흔들기). */
  const goal = stage === 2 && s.ok === (s.mg !== 'save');
  const caption = ((): string => {
    if (s.ok === null) return '';
    if (late) return L.late;
    if (s.mg === 'save') return s.ok ? L.saveOk : L.saveFail;
    if (s.ok) return L.goal;
    return s.mg === 'shot' ? L.crossbar : s.mg === 'dribble' ? L.tooLong : L.blocked;
  })();
  /**
   * 제치기: 뒤쫓아 온 수비수 둘이 양옆에서 좁혀 온다. 탭하면 공 쪽으로 몸을 날리지만(슬라이딩) 이미 늦었다 —
   * 이벤트 문구대로 키퍼와는 단둘이다.
   */
  const defenders = ((): DefenderPose[] => {
    if (s.mg !== 'dribble') return [];
    // 둘 다 공이 빠져나간 쪽(키퍼 반대쪽)으로 슬라이딩한다 — 가운데로 모이면 한데 겹쳐 보인다.
    const dir = -side;
    const pose = idle ? REST : { dx: dir * 14, dy: 6, rot: dir * 75 };
    return [
      { x: 102, y: 140, num: 4, ...pose },
      { x: 200, y: 136, num: 5, ...pose },
    ];
  })();

  const label = L.mgA11y({ tap: MG_TAP[s.mg] });
  return (
    <>
      <Txt v="eyebrow">{L.mgEyebrow}</Txt>
      <Txt v="h2" accessibilityRole="header">
        {s.label}
      </Txt>
      <Pressable
        testID="mg-tap"
        accessibilityRole="button"
        accessibilityLabel={label}
        onPressIn={tap}
        onPress={tap}
        // 웹 .mg-stage: 초록 그라운드 바탕 위에 장면·게이지·문구가 전부 들어간다(--r3는 색 토큰이라 모서리는 각졌다).
        style={{ backgroundColor: c.pitch, paddingBottom: 12, overflow: 'hidden' }}
      >
        <MgTimer stopped={tapped} onexpire={expire} />
        <PitchScene
          ball={ball}
          spin={stage * 280 * side}
          kp={kp}
          me={s.mg === 'save'}
          goal={goal}
          defenders={defenders}
        />
        {caption ? (
          <View
            pointerEvents="none"
            style={{ position: 'absolute', top: 10, left: 0, right: 0, alignItems: 'center' }}
          >
            <Pop ms={350}>
              <Txt
                style={{
                  fontFamily: DISPLAY[800],
                  fontSize: rem(1.75),
                  lineHeight: rem(1.75) * 1.3,
                  color: c.chalk,
                  textShadowColor: 'rgba(0,0,0,0.45)',
                  textShadowOffset: { width: 0, height: 2 },
                  textShadowRadius: 6,
                }}
              >
                {caption}
              </Txt>
            </Pop>
          </View>
        ) : null}
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          onLayout={(e) => gauge.setValue(e.nativeEvent.layout.width)}
          style={{
            height: 16,
            marginTop: 10,
            marginHorizontal: 14,
            borderRadius: 8,
            backgroundColor: mixColor(c.bad, c.pitch, 55),
          }}
        >
          <View
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `${(s.center - s.w / 2) * 100}%`,
              width: `${s.w * 100}%`,
              borderRadius: 8,
              backgroundColor: c.good,
              borderWidth: 2,
              borderColor: alpha('#ffffff', 0.13),
            }}
          />
          <Needle k={k} width={gauge} />
        </View>
        <Txt
          center
          style={{
            minHeight: rem(1.125) * 1.4,
            marginTop: 10,
            fontSize: rem(1.125),
            fontWeight: '800',
            letterSpacing: rem(1.125) * 0.02,
            color: c.onPitch,
          }}
        >
          {tapped ? ' ' : MG_TAP[s.mg]}
        </Txt>
      </Pressable>
    </>
  );
}
