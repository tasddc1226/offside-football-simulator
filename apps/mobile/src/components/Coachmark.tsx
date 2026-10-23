// T-11-473 첫 커리어 따라가기 안내(웹 Coachmark.svelte · 단계 · 저장은 app-core tutorial). 비출 자리는 CoachTarget으로 감싸
// 등록하고, 지금 단계의 자리가 보이면 그 둘레만 남기고 어둡게 덮은 뒤 말풍선을 띄운다. 덮개는 누름을 그대로 아래로 넘기므로
// (pointerEvents none) 화면은 평소처럼 쓰고, 'tap' 단계는 비춘 자리를 누르면 넘어간다. 시트(Modal)는 다른 창이라 루트와 시트에
// 덮개를 하나씩 두고(CoachLayer), 시트가 열려 있으면 시트 안의 자리만 비춘다.
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { proxy, useSnapshot } from 'valtio';
import { RADIUS } from '@offside/app-core/design-tokens';
import {
  COACH_STEPS,
  bubbleAt,
  coachAt,
  coachDone,
  coachPick,
  coachReplay,
  coachResume,
  type CoachId,
} from '@offside/app-core/tutorial';
import { tutorialText as T } from '@offside/app-core/i18n/ko/tutorial';
import { FOCUS_PICK } from '@offside/game/data';
import { prefs, sheetState } from '../store';
import { useColors } from '../theme/useColors';
import { scrollToView } from '../ui/scroll';
import { Btn } from '../ui/Btn';
import { Press } from '../ui/Press';
import { Txt } from '../ui/Txt';

export const coachState = proxy<{ i: number | null }>({ i: null });
let started = false;
/** 앱을 연 뒤 한 번(저장소가 준비된 뒤) 이어 볼 단계를 읽는다. */
export function startCoach() {
  if (started) return;
  started = true;
  coachState.i = coachResume();
}
/** 설정의 다시 보기 — 첫 단계(홈의 새 커리어 버튼)부터. */
export function replayCoach() {
  started = true;
  coachState.i = coachReplay();
}

type Layer = 'root' | 'sheet';
const LayerCtx = createContext<Layer>('root');
/** 시트 본문을 감싸 그 안의 CoachTarget이 시트 덮개에 등록되게 한다. */
export const CoachLayer = LayerCtx.Provider;

const targets = new Map<CoachId, { view: View; layer: Layer; enabled: () => boolean }>();

function next(i: number) {
  if (i + 1 >= COACH_STEPS.length) return skip();
  coachState.i = i + 1;
  coachAt(i + 1);
}
function skip() {
  coachDone();
  coachState.i = null;
}

/** 비출 자리. enabled가 false면(누를 수 없는 버튼) 눌러도 다음 단계로 넘어가지 않는다. */
export function CoachTarget({
  id,
  enabled = true,
  style,
  children,
}: {
  id: CoachId;
  enabled?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const layer = useContext(LayerCtx);
  const ref = useRef<View>(null);
  const on = useRef(enabled);
  on.current = enabled;
  useEffect(() => {
    const view = ref.current;
    if (!view) return;
    targets.set(id, { view, layer, enabled: () => on.current });
    return () => {
      if (targets.get(id)?.view === view) targets.delete(id);
    };
  }, [id, layer]);
  const onTouchEnd = () => {
    const i = coachState.i;
    const step = i === null ? null : COACH_STEPS[i];
    if (i !== null && step?.advance === 'tap' && step.target === id && on.current) next(i);
  };
  return (
    <View ref={ref} collapsable={false} style={style} onTouchEnd={onTouchEnd}>
      {children}
    </View>
  );
}

type Rect = { x: number; y: number; w: number; h: number };
const PAD = 6;
const TICK_MS = 200;

function copyOf(id: CoachId): [string, string] {
  switch (id) {
    case 'new':
      return [T.newTitle, T.newBody];
    case 'pos':
      return [T.posTitle, T.posBody];
    case 'focus':
      return [T.focusTitle({ n: FOCUS_PICK }), T.focusBody];
    case 'candidates':
      return [T.candidatesTitle, T.candidatesBody];
    case 'cands':
      return [T.candsTitle, T.candsBody];
    case 'start':
      return [T.startTitle, T.startBody];
    case 'go':
      return [T.goTitle, T.goBody];
    case 'choice':
      return [T.choiceTitle, T.choiceBody];
    case 'season':
      return [T.seasonTitle, T.seasonBody];
    case 'retire':
      return [T.retireTitle, T.retireBody];
  }
}

const measure = (v: View) =>
  new Promise<Rect>((r) => v.measureInWindow((x, y, w, h) => r({ x, y, w, h })));

export function Coachmark({ layer }: { layer: Layer }) {
  const { i } = useSnapshot(coachState);
  const { open } = useSnapshot(sheetState);
  const active = i !== null && (layer === 'sheet') === open;
  const c = useColors();
  const win = useWindowDimensions();
  const box = useRef<View>(null);
  const [at, setAt] = useState<{ idx: number; rect: Rect } | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const scrolledFor = useRef(-1);

  useEffect(() => {
    if (!active) return void setAt(null);
    let alive = true;
    const tick = async () => {
      const from = coachState.i;
      const self = box.current;
      if (from === null || !self) return;
      const origin = await measure(self);
      const rects = new Map<CoachId, Rect>();
      await Promise.all(
        [...targets].map(async ([id, t]) => {
          if (t.layer !== layer) return;
          const r = await measure(t.view);
          if (r.w > 0 && r.h > 0) rects.set(id, { ...r, x: r.x - origin.x, y: r.y - origin.y });
        }),
      );
      if (!alive || coachState.i !== from) return;
      const idx = coachPick(from, (id) => rects.has(id));
      if (idx === null) return setAt(null);
      if (idx > from) {
        coachState.i = idx;
        coachAt(idx);
      }
      const rect = rects.get(COACH_STEPS[idx]!.target)!;
      // 처음 비출 때 화면 밖이면 그 자리로 내린다(한 단계에 한 번 — 사용자가 스크롤하면 따라간다).
      if (scrolledFor.current !== idx) {
        scrolledFor.current = idx;
        if (layer === 'root' && (rect.y < 0 || rect.y + rect.h > win.height - 80))
          scrollToView(targets.get(COACH_STEPS[idx]!.target)?.view ?? null, prefs.motionOK);
      }
      setAt((p) =>
        p &&
        p.idx === idx &&
        p.rect.x === rect.x &&
        p.rect.y === rect.y &&
        p.rect.w === rect.w &&
        p.rect.h === rect.h
          ? p
          : { idx, rect },
      );
    };
    void tick();
    const t = setInterval(() => void tick(), TICK_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [active, i, layer, win.height]);

  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!at || !prefs.motionOK) return;
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1600, useNativeDriver: true }),
    );
    loop.start();
    return () => {
      loop.stop();
      pulse.setValue(0);
    };
  }, [!!at, pulse]);

  const step = at ? COACH_STEPS[at.idx]! : null;
  const hole = at
    ? {
        l: at.rect.x - PAD,
        t: at.rect.y - PAD,
        r: at.rect.x + at.rect.w + PAD,
        b: at.rect.y + at.rect.h + PAD,
      }
    : null;
  const pos =
    hole && size.w
      ? bubbleAt(
          { x: hole.l, y: hole.t, w: hole.r - hole.l, h: hole.b - hole.t },
          { w: win.width, h: win.height },
          size,
        )
      : null;
  const last = at?.idx === COACH_STEPS.length - 1;
  const dim = { position: 'absolute', backgroundColor: 'rgba(8,14,11,0.55)' } as const;
  const [title, body] = step ? copyOf(step.id) : ['', ''];

  return (
    <View
      ref={box}
      collapsable={false}
      pointerEvents="box-none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
    >
      {step && hole ? (
        <>
          <View
            pointerEvents="none"
            style={{ ...dim, top: 0, left: 0, right: 0, height: Math.max(0, hole.t) }}
          />
          <View
            pointerEvents="none"
            style={{ ...dim, top: hole.b, left: 0, right: 0, bottom: 0 }}
          />
          <View
            pointerEvents="none"
            style={{
              ...dim,
              top: hole.t,
              left: 0,
              width: Math.max(0, hole.l),
              height: hole.b - hole.t,
            }}
          />
          <View
            pointerEvents="none"
            style={{ ...dim, top: hole.t, left: hole.r, right: 0, height: hole.b - hole.t }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: hole.l,
              top: hole.t,
              width: hole.r - hole.l,
              height: hole.b - hole.t,
              borderRadius: 14,
              borderWidth: 3,
              borderColor: c.accent,
            }}
          />
          {prefs.motionOK ? (
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: hole.l - 3,
                top: hole.t - 3,
                width: hole.r - hole.l + 6,
                height: hole.b - hole.t + 6,
                borderRadius: 16,
                borderWidth: 3,
                borderColor: c.accent,
                opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] }),
                transform: [
                  { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) },
                ],
              }}
            />
          ) : null}
          <View
            testID={`coach-${step.id}`}
            accessibilityLabel={T.label}
            accessibilityLiveRegion="polite"
            onLayout={(e) => {
              const { width: w, height: h } = e.nativeEvent.layout;
              if (w !== size.w || h !== size.h) setSize({ w, h });
            }}
            style={{
              position: 'absolute',
              left: pos?.x ?? 0,
              top: pos?.y ?? 0,
              opacity: pos ? 1 : 0,
              width: Math.min(320, win.width - 32),
              gap: 6,
              paddingTop: 14,
              paddingHorizontal: 16,
              paddingBottom: 12,
              borderRadius: RADIUS.lg,
              backgroundColor: c.surface,
              shadowColor: '#000',
              shadowOpacity: 0.28,
              shadowRadius: 15,
              shadowOffset: { width: 0, height: 10 },
              elevation: 12,
            }}
          >
            <Txt v="sm" num tone="accent">
              {T.step({ n: at!.idx + 1, total: COACH_STEPS.length })}
            </Txt>
            <Txt bold>{title}</Txt>
            <Txt v="sm">{body}</Txt>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: last ? 'flex-end' : 'space-between',
                gap: 12,
                marginTop: 4,
              }}
            >
              {last ? null : (
                <Press testID="coach-skip" accessibilityRole="button" onPress={skip} hitSlop={8}>
                  <Txt v="sm" tone="muted" style={{ textDecorationLine: 'underline' }}>
                    {T.skip}
                  </Txt>
                </Press>
              )}
              {step.advance === 'next' ? (
                <Btn sm kind="primary" testID="coach-next" onPress={() => next(at!.idx)}>
                  {last ? T.done : T.next}
                </Btn>
              ) : (
                <Txt v="sm" bold tone="accent">
                  {T.tapHint}
                </Txt>
              )}
            </View>
          </View>
        </>
      ) : null}
    </View>
  );
}
