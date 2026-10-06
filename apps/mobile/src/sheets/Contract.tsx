// 계약서 사인 시트(웹 sheets/Contract.svelte, T-11-039): 이적시장에서 고른 구단과의 계약. 손가락으로 사인하거나
// '이름 사인 사용'으로 선수 이름을 흘려 쓴 사인을 넣으면 확정 버튼이 켜진다. 누르면 도장이 찍히고 onSign. 사인은 화면
// 연출이라 저장하지 않는다.
// 웹은 canvas에 그렸지만 앱은 획마다 점을 모아 react-native-svg Path로 그린다. 터치는 패드 위에 덮은 투명 View 하나가
// PanResponder로 잡는다(DragShot과 같다 — 터치 대상이 늘 그 View라 locationX/Y가 패드 기준으로 일정하고, 바깥 스크롤이
// 제스처를 가져가지 못한다).
import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Easing, PanResponder, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import Svg, { ClipPath, Defs, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import { useSnapshot } from 'valtio';
import type { SheetView } from '@offside/app-core/sheets';
import { sheetContractText as L } from '@offside/app-core/i18n/ko/sheetContract';
import {
  MIN_INK,
  REVEAL_MS,
  SKEW_X,
  SKEW_Y,
  STAMP_MS,
  signFlourish,
} from '@offside/app-core/signature';
import { prefs } from '../store';
import { useColors } from '../theme/useColors';
import { DISPLAY, rem } from '../theme/type';
import { Btn } from '../ui/Btn';
import { ClubBadge } from '../ui/ClubBadge';
import { Press } from '../ui/Press';
import { Txt } from '../ui/Txt';
import { Enter } from './anim';
import { tn } from '@offside/game/i18n/names';

/** 웹 stamp 키프레임의 cubic-bezier(0.2, 1.6, 0.4, 1). */
const STAMP_EASE = Easing.bezier(0.2, 1.6, 0.4, 1);

interface Pt {
  x: number;
  y: number;
}

/** 굵은 이탤릭 글자 폭 어림(RN엔 measureText가 없다) — 한글·한자는 글자 크기만큼, 그 밖은 0.58배. */
function textWidth(text: string, size: number): number {
  let w = 0;
  for (const ch of text) w += ch === ' ' ? 0.3 : ch.charCodeAt(0) >= 0x2e80 ? 1 : 0.58;
  return w * size;
}

type ContractView = Extract<SheetView, { kind: 'contract' }>;

/** 구단 배지 + 계약 조건 — 사인하는 동안(획마다 다시 그려진다) 함께 다시 그리지 않는다. */
const Terms = memo(function Terms({
  club,
  terms,
}: {
  club: ContractView['club'];
  terms: readonly { label: string; value: string }[];
}) {
  const c = useColors();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 12,
        backgroundColor: c.surface2,
      }}
    >
      <ClubBadge club={club} size={34} />
      <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', rowGap: 4, columnGap: 16 }}>
        {terms.map((t) => (
          <View key={t.label}>
            <Txt tone="muted" style={{ fontSize: rem(0.6875), lineHeight: rem(0.6875) * 1.4 }}>
              {t.label}
            </Txt>
            <Txt bold style={{ fontSize: rem(0.875), lineHeight: rem(0.875) * 1.4 }}>
              {t.value}
            </Txt>
          </View>
        ))}
      </View>
    </View>
  );
});

function Stroke({ d, color }: { d: string; color: string }) {
  return (
    <Path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}
/** 다 그은 획들 — 긋는 중인 획만 바뀌므로 따로 둔다. */
const Strokes = memo(function Strokes({ paths, color }: { paths: string[]; color: string }) {
  return paths.map((d, i) => <Stroke key={i} d={d} color={color} />);
});

export function Contract({ v }: { v: ContractView }) {
  const s = useSnapshot(v);
  const c = useColors();
  const { motionOK } = useSnapshot(prefs);
  const clip = useId();

  const [done, setDone] = useState<string[]>([]);
  const [cur, setCur] = useState('');
  const [inked, setInked] = useState(false);
  const [enough, setEnough] = useState(false);
  const [named, setNamed] = useState(false);
  const [reveal, setReveal] = useState(1);
  const [sealed, setSealed] = useState(false);
  const [size, setSize] = useState({ w: 0, h: 150 });
  const ready = named || enough;

  // 터치 핸들러는 한 번만 만들어 쓰므로 최신 값은 ref로 읽는다.
  // 긋는 중인 획: 지금까지의 곡선(body)과 마지막 점. 움직일 때마다 새 구간만 덧붙인다(웹처럼 두 점의 가운데를
  // 끝점으로, 앞 점을 제어점으로 하는 2차 곡선). 그은 길이(ink)는 확정 버튼을 켤 만큼인지만 화면에 알린다.
  const body = useRef('');
  const lastPt = useRef<Pt | null>(null);
  const ink = useRef(0);
  const sealedRef = useRef(false);
  const namedRef = useRef(false);
  const raf = useRef(0);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const clear = useCallback(() => {
    cancelAnimationFrame(raf.current);
    body.current = '';
    lastPt.current = null;
    ink.current = 0;
    namedRef.current = false;
    setDone([]);
    setCur('');
    setInked(false);
    setEnough(false);
    setNamed(false);
    setReveal(1);
  }, []);

  const pan = useMemo(() => {
    const at = (e: GestureResponderEvent): Pt => ({
      x: Math.round(e.nativeEvent.locationX * 10) / 10,
      y: Math.round(e.nativeEvent.locationY * 10) / 10,
    });
    const end = () => {
      const l = lastPt.current;
      if (!l) return;
      const d = `${body.current}L${l.x},${l.y}`;
      lastPt.current = null;
      setDone((a) => [...a, d]);
      setCur('');
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => !sealedRef.current,
      // 그리는 동안 바깥 스크롤(시트)이 터치를 가져가지 않게 한다.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        if (namedRef.current) clear();
        const p = at(e);
        lastPt.current = p;
        body.current = `M${p.x},${p.y}`;
        setCur(`${body.current}l0.01,0`);
        setInked(true);
      },
      onPanResponderMove: (e) => {
        const p = at(e);
        const a = lastPt.current;
        if (!a) return;
        const d = Math.hypot(p.x - a.x, p.y - a.y);
        if (d < 1) return;
        body.current += `Q${a.x},${a.y} ${(a.x + p.x) / 2},${(a.y + p.y) / 2}`;
        lastPt.current = p;
        setCur(`${body.current}L${p.x},${p.y}`);
        ink.current += d;
        if (ink.current >= MIN_INK) setEnough(true);
      },
      onPanResponderRelease: end,
      onPanResponderTerminate: end,
    });
  }, [clear]);

  const { w: W, h: H } = size;
  // 이름 사인 글자 크기: 높이의 42%에서 시작해 폭 70%를 넘으면 줄인다.
  const sign = useMemo(() => {
    let fs = H * 0.42;
    const tw = textWidth(s.name, fs);
    if (tw > W * 0.7) fs *= (W * 0.7) / tw;
    const half = Math.min(W * 0.42, textWidth(s.name, fs) / 2 + fs * 0.9);
    return { fs, flourish: signFlourish(half, fs) };
  }, [s.name, W, H]);

  /** 선수 이름을 기울여 흘려 쓰고 밑줄 꼬리를 붙인다. 동작 줄이기가 아니면 왼쪽부터 써 나간다. */
  function nameSign() {
    if (sealedRef.current || W === 0) return;
    clear();
    namedRef.current = true;
    setNamed(true);
    if (!motionOK) return;
    setReveal(0);
    const t0 = performance.now();
    const step = () => {
      const t = Math.min(1, (performance.now() - t0) / REVEAL_MS);
      setReveal(1 - Math.pow(1 - t, 2));
      if (t < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  }

  function seal() {
    if (!ready || sealedRef.current) return;
    sealedRef.current = true;
    cancelAnimationFrame(raf.current);
    setReveal(1);
    setSealed(true);
    setTimeout(() => v.onSign(), motionOK ? STAMP_MS : 0);
  }

  return (
    <View style={{ gap: 12 }}>
      <Txt v="eyebrow">{s.eyebrow}</Txt>
      <Txt v="h2" accessibilityRole="header" style={{ paddingRight: 40 }}>
        {s.title}
      </Txt>
      {/* 제목 줄 오른쪽 위 × — 이적시장으로 돌아간다. */}
      <Press
        testID="sign-close"
        accessibilityLabel={L.close}
        disabled={sealed}
        onPress={() => v.onClose()}
        style={{
          position: 'absolute',
          top: -6,
          right: -4,
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: c.surface2,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: sealed ? 0.45 : 1,
        }}
      >
        <Txt tone="muted" style={{ fontSize: rem(1.375), lineHeight: rem(1.375) }}>
          ×
        </Txt>
      </Press>
      <Txt tone="muted" style={{ marginTop: -4, fontSize: rem(0.9375) }}>
        {s.text}
      </Txt>
      <Terms club={s.club} terms={s.terms} />
      <View
        accessibilityLabel={L.padLabel}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          // 폭이 바뀌면(회전 등) 그린 사인이 어긋나므로 처음부터 다시 받는다(웹 ResizeObserver).
          if (size.w && Math.round(size.w) !== Math.round(width)) clear();
          setSize({ w: width, h: height });
        }}
        style={{
          height: 150,
          borderWidth: 1.5,
          borderStyle: 'dashed',
          borderColor: c.line,
          borderRadius: 14,
          backgroundColor: c.surface,
          overflow: 'hidden',
        }}
      >
        <Svg width="100%" height="100%" pointerEvents="none">
          <Strokes paths={done} color={c.ink} />
          {cur ? <Stroke d={cur} color={c.ink} /> : null}
          {named && W > 0 ? (
            <>
              <Defs>
                <ClipPath id={clip}>
                  <Rect x={0} y={0} width={W * reveal} height={H} />
                </ClipPath>
              </Defs>
              <G clipPath={`url(#${clip})`}>
                <G
                  transform={`translate(${W / 2} ${H * 0.56}) matrix(1 ${SKEW_Y} ${SKEW_X} 1 0 0)`}
                >
                  <SvgText
                    x={0}
                    y={0}
                    textAnchor="middle"
                    fontSize={sign.fs}
                    fontWeight="500"
                    fontStyle="italic"
                    fill={c.ink}
                  >
                    {s.name}
                  </SvgText>
                  <Path
                    d={sign.flourish}
                    fill="none"
                    stroke={c.ink}
                    strokeWidth={2.2}
                    strokeLinecap="round"
                  />
                </G>
              </G>
            </>
          ) : null}
        </Svg>
        {inked || named ? null : (
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}
          >
            <Txt tone="muted" style={{ fontSize: rem(0.9375) }}>
              {L.signHint}
            </Txt>
          </View>
        )}
        {/* 서명란 밑줄과 × 표시(종이 계약서처럼). */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 18,
            right: 18,
            bottom: 30,
            borderBottomWidth: 1,
            borderBottomColor: c.line,
          }}
        >
          <Txt
            tone="muted"
            style={{
              position: 'absolute',
              left: 0,
              bottom: 2,
              fontSize: rem(0.875),
              lineHeight: rem(0.875),
            }}
          >
            ×
          </Txt>
        </View>
        {sealed ? (
          <View
            pointerEvents="none"
            style={{ position: 'absolute', right: 14, top: 12, transform: [{ rotate: '-14deg' }] }}
          >
            <Enter kind="scale" from={1.8} ms={280} ease={STAMP_EASE}>
              <Stamp name={s.club.name} />
            </Enter>
          </View>
        ) : null}
        <View style={StyleSheet.absoluteFill} {...pan.panHandlers} />
      </View>
      <Txt
        tone="muted"
        center
        style={{ marginTop: -6, fontSize: rem(0.75), lineHeight: rem(0.75) * 1.5 }}
      >
        {L.signNote}
      </Txt>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Btn sm testID="sign-clear" disabled={sealed} onPress={clear} style={{ flex: 1 }}>
          {L.clear}
        </Btn>
        <Btn sm testID="sign-name" disabled={sealed} onPress={nameSign} style={{ flex: 1 }}>
          {L.nameSign}
        </Btn>
      </View>
      <Btn kind="primary" block testID="sign-ok" disabled={!ready || sealed} onPress={seal}>
        {`${s.cta} →`}
      </Btn>
    </View>
  );
}

/** 'SIGNED' 도장 — 웹 .stamp의 이중 테두리 원(double border)을 안팎 두 겹 원으로 그린다. */
function Stamp({ name }: { name: string }) {
  const c = useColors();
  return (
    <View
      style={{
        width: 86,
        height: 86,
        borderRadius: 43,
        borderWidth: 1.5,
        borderColor: c.bad,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: 78,
          height: 78,
          borderRadius: 39,
          borderWidth: 1.5,
          borderColor: c.bad,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Txt
          style={{
            fontFamily: DISPLAY[700],
            fontSize: rem(1.25),
            lineHeight: rem(1.25),
            letterSpacing: rem(1.25) * 0.06,
            color: c.bad,
          }}
        >
          SIGNED
        </Txt>
        <Txt
          numberOfLines={1}
          style={{
            maxWidth: 62,
            marginTop: 3,
            fontSize: rem(0.5625),
            lineHeight: rem(0.5625) * 1.3,
            fontWeight: '700',
            color: c.bad,
          }}
        >
          {tn(name)}
        </Txt>
      </View>
    </View>
  );
}
