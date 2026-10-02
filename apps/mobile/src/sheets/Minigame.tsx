// 원터치 미니게임(웹 sheets/Minigame.svelte, T-10-089). 게이지 위를 왕복하는 바늘을 한 번 탭해 멈춘다(장면 전체가 버튼 하나).
// 탭한 순간의 바늘 위치는 마지막으로 그린 프레임이 아니라 입력 시각으로 계산한다 — 프레임 간격만큼 판정이 밀리지
// 않게. 손가락이 닿는 순간(onPressIn)을 입력으로 보고, 스크린 리더 활성화(onPress)는 같은 함수를 부른다.
// 판정이 나면(v.ok, sheet-controller가 채운다) 공이 날아가는 결과 장면을 두 단계로 그린다.
import { useEffect, useRef, useState, type RefObject } from 'react';
import { Pressable, View } from 'react-native';
import { useSnapshot } from 'valtio';
import { markerAt, MG_TAP } from '@offside/game/minigame';
import type { SheetView } from '@offside/app-core/sheets';
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

/** 게이지 위를 왕복하는 바늘. 멈추면(frozen) 그 자리에 선다 — 안 그릴 때는 자기 프레임 루프만 돈다. */
function Needle({ t0, frozen }: { t0: RefObject<number>; frozen: number | null }) {
  const c = useColors();
  const [pos, setPos] = useState(0);
  useEffect(() => {
    if (frozen !== null) return;
    let raf = 0;
    const frame = (now: number) => {
      setPos(markerAt(now - t0.current));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [frozen, t0]);
  const p = frozen ?? pos;
  return (
    <View
      style={{
        position: 'absolute',
        top: -5,
        bottom: -5,
        left: `${p * 100}%`,
        marginLeft: -3,
        width: 8,
        borderWidth: 2,
        borderColor: c.pitch,
        borderRadius: 4,
        backgroundColor: c.chalk,
      }}
    />
  );
}

export function Minigame({ v }: { v: Extract<SheetView, { kind: 'minigame' }> }) {
  const s = useSnapshot(v);
  const c = useColors();
  const [tapped, setTapped] = useState(false);
  const [frozen, setFrozen] = useState<number | null>(null);
  /** 결과 장면 단계: 0 겨냥 · 1 공이 날아가는 중 · 2 마무리. */
  const [stage, setStage] = useState(0);
  /** 제한 시간이 지나도록 누르지 않았다 — 공은 그대로, 실패. */
  const [late, setLate] = useState(false);
  const t0 = useRef(0);
  const done = useRef(false);
  /** 공이 향할 쪽(-1 왼쪽 · 1 오른쪽). 선택지가 정하지 않았으면 무작위(화면 연출이라 게임 RNG를 쓰지 않는다). */
  const [rs] = useState<-1 | 1>(() => (Math.random() < 0.5 ? -1 : 1));
  /** 제자리에서 버티는 선택(끝까지 기다린다). */
  const hold = s.side === 0;
  const side = s.side || rs;

  useEffect(() => {
    t0.current = performance.now();
  }, []);

  useEffect(() => {
    if (s.ok === null) return;
    setStage(1);
    const t = setTimeout(() => setStage(2), 380);
    return () => clearTimeout(t);
  }, [s.ok]);

  function tap(at: number) {
    if (done.current) return;
    done.current = true;
    setTapped(true);
    const pos = markerAt(at - t0.current);
    setFrozen(pos);
    v.onTap(pos);
  }
  function expire() {
    if (done.current) return;
    done.current = true;
    setTapped(true);
    setLate(true);
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
    if (late) return '시간 초과!';
    if (s.mg === 'save') return s.ok ? '선방!' : '실점…';
    if (s.ok) return '골!';
    return s.mg === 'shot' ? '크로스바!' : s.mg === 'dribble' ? '너무 길었다!' : '막혔다!';
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

  const label = `${MG_TAP[s.mg]}. 바늘이 초록 구간에 올 때 누르세요`;
  return (
    <>
      <Txt v="eyebrow">원터치 · 초록 구간에서 멈추세요</Txt>
      <Txt v="h2" accessibilityRole="header">
        {s.label}
      </Txt>
      <Pressable
        testID="mg-tap"
        accessibilityRole="button"
        accessibilityLabel={label}
        onPressIn={() => tap(performance.now())}
        onPress={() => tap(performance.now())}
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
          <Needle t0={t0} frozen={frozen} />
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
