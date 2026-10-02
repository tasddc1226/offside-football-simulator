// 드래그 슛(웹 sheets/DragShot.svelte, T-10-089 프로토타입). 장면 위에서 골문 쪽으로 끌어 올렸다가 떼면 찬다. 경로는 장면
// 좌표(viewBox 300×170)로 모은다 — 화면 크기와 상관없이 같은 손짓이 같은 슛이 되게(웹처럼 readout 줄까지 포함한
// 장면 전체 크기 기준). 판정은 game/dragShot.ts, 결과는 sheet-controller가 v.shot에 채운다.
// 끄는 동안 손가락이 장면을 벗어나도 끝까지 받도록, 장면 위에 덮은 투명 View 하나가 PanResponder로 터치를 잡는다
// (터치 대상이 늘 그 View라 locationX/Y가 장면 기준으로 일정하다).
import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import { useSnapshot } from 'valtio';
import { isShot, type DragPoint } from '@offside/game/dragShot';
import { MG_TIME_MS } from '@offside/game/minigame';
import type { SheetView } from '@offside/app-core/sheets';
import { useColors } from '../theme/useColors';
import { DISPLAY, rem } from '../theme/type';
import { Txt } from '../ui/Txt';
import { Pop } from './anim';
import { MgTimer } from './MgTimer';
import { PitchScene, REST, SPOT_POSE, type BallPose, type KeeperPose } from './PitchScene';

const CAPTION: Record<string, string> = {
  goal: '골!',
  saved: '선방에 막혔다!',
  post: '골대를 때렸다!',
  over: '하늘로 떴다…',
  wide: '빗나갔다!',
  late: '시간 초과!',
};

export function DragShot({ v }: { v: Extract<SheetView, { kind: 'dragShot' }> }) {
  const s = useSnapshot(v);
  const c = useColors();
  // 경로는 판정에만 쓰고 화면엔 trail 문자열로만 그린다 — 움직일 때마다 한 점씩 덧붙인다.
  const path = useRef<DragPoint[]>([]);
  const dragging = useRef(false);
  const over = useRef(false);
  const size = useRef({ w: 300, h: 170 });
  const [trail, setTrail] = useState('');
  const [stopped, setStopped] = useState(false);
  const [hint, setHint] = useState('');
  /** 결과 장면 단계: 0 겨냥 · 1 공이 닿는 자리까지 · 2 마무리(튕기거나 그물로). */
  const [stage, setStage] = useState(0);
  const shotDone = !!s.shot;

  useEffect(() => {
    if (!shotDone) return;
    setStage(1);
    const t = setTimeout(() => setStage(2), 400);
    return () => clearTimeout(t);
  }, [shotDone]);

  const pan = useMemo(() => {
    const stop = () => {
      dragging.current = false;
      path.current = [];
      setTrail('');
    };
    const add = (e: GestureResponderEvent) => {
      const { locationX, locationY, timestamp } = e.nativeEvent;
      const p = {
        x: (locationX / size.current.w) * 300,
        y: (locationY / size.current.h) * 170,
        t: timestamp,
      };
      path.current.push(p);
      setTrail((t) => `${t} ${p.x.toFixed(1)},${p.y.toFixed(1)}`);
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => !over.current,
      // 끄는 동안 바깥 스크롤(시트)이 터치를 가져가지 않게 한다.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        stop();
        dragging.current = true;
        setHint('');
        add(e);
      },
      onPanResponderMove: (e) => {
        if (dragging.current) add(e);
      },
      onPanResponderRelease: (e) => {
        if (!dragging.current) return;
        add(e);
        const shot = path.current;
        stop();
        if (!isShot(shot)) {
          setHint('골문 쪽(위)으로 더 길게 끌었다가 떼세요');
          return;
        }
        over.current = true;
        setStopped(true);
        v.onShot(shot);
      },
      onPanResponderTerminate: stop,
    });
  }, [v]);

  /** 찼거나 시간이 지났다(더 받지 않는다). */
  function expire() {
    if (over.current) return;
    over.current = true;
    setStopped(true);
    dragging.current = false;
    path.current = [];
    setTrail('');
    v.onShot(null);
  }

  const ball = ((): BallPose => {
    const sh = s.shot;
    if (!sh || stage === 0 || sh.outcome === 'late') return SPOT_POSE;
    const at = { x: sh.x, y: sh.y, s: 0.6 };
    if (stage === 1) return at;
    const out = sh.x < 150 ? -1 : 1;
    switch (sh.outcome) {
      case 'goal':
        return { x: sh.x + (150 - sh.x) * 0.08, y: sh.y + 4, s: 0.5 };
      case 'saved':
        return { x: sh.x + out * 16, y: Math.min(135, sh.y + 34), s: 0.75 };
      case 'post':
        return { x: sh.x + out * 24, y: sh.y - 14, s: 0.5 };
      case 'over':
        return { x: sh.x + out * 8, y: -12, s: 0.45 };
      case 'wide':
        return { x: sh.x + out * 30, y: sh.y - 6, s: 0.5 };
    }
  })();
  const kp = ((): KeeperPose => {
    const sh = s.shot;
    if (!sh || stage === 0 || sh.outcome === 'late') return REST;
    if (sh.keeper === 0) return { dx: 0, dy: -8, rot: 0 };
    return { dx: sh.keeper * 38, dy: -6, rot: sh.keeper * 68 };
  })();
  const caption = s.shot && stage > 0 ? CAPTION[s.shot.outcome] : '';
  const readout = ((): string => {
    const sh = s.shot;
    if (!sh) return '';
    if (sh.outcome === 'late') return `${MG_TIME_MS / 1000}초 안에 차지 않았어요`;
    const pw = sh.power < 0.6 ? '약함' : sh.power > 1.3 ? '과함' : '좋음';
    return `세기 ${Math.round(sh.power * 100)}% (${pw}) · 곧게 차기 ${Math.round(sh.straight * 100)}%`;
  })();

  return (
    <>
      <Txt v="eyebrow">드래그 슛 · 골문 쪽으로 끌어 올리세요</Txt>
      <Txt v="h2" accessibilityRole="header">
        {s.label}
      </Txt>
      <View
        testID="drag-shot"
        accessible
        accessibilityLabel="드래그 슛. 공에서 골문 쪽으로 끌었다가 떼면 찹니다"
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          size.current = { w: width, h: height };
        }}
        style={{ backgroundColor: c.pitch, paddingBottom: 12, overflow: 'hidden' }}
      >
        <MgTimer stopped={stopped} onexpire={expire} />
        <PitchScene
          ball={ball}
          spin={stage * 300}
          kp={kp}
          goal={stage === 2 && s.shot?.outcome === 'goal'}
          trail={trail}
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
        <Txt
          center
          style={{
            minHeight: rem(0.8125) * 1.4,
            marginTop: 10,
            fontSize: rem(0.8125),
            fontWeight: '700',
            color: c.onPitch,
            opacity: 0.9,
          }}
        >
          {readout || hint || '↑ 위로 끌었다 떼기'}
        </Txt>
        <View style={StyleSheet.absoluteFill} {...pan.panHandlers} />
      </View>
    </>
  );
}
