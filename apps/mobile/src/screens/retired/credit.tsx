// 은퇴 리포트의 '스크롤 크레딧' 바탕(웹 LegendReport의 IntersectionObserver reveal + 화면 .wrap).
// 웹은 장면(data-credit)이 화면 아래쪽 15%를 넘어 들어오면 한 번 올라온다. 앱은 ScrollView의 onScroll·onLayout으로
// '들어왔는가'를 재서 Animated로 올린다 — 스크롤이 움직이거나 장면의 배치가 바뀔 때만(묶어서) 아직 안 나온 장면들의
// 화면 위치를 재고, 나온 장면은 관찰을 멈춘다. 동작 줄이기(prefs.motionOK 꺼짐)면 처음부터 다 보인다.
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { Animated, Easing, ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSnapshot } from 'valtio';
import { prefs } from '../../store';
import { useColors } from '../../theme/useColors';
import { BarBelow } from '../../ui/Screen';
import { noteScrollY, registerScroll } from '../../ui/scroll';

type Rect = { x: number; y: number; w: number; h: number };
const measureWin = (ref: RefObject<View | null>): Promise<Rect | null> =>
  new Promise((resolve) => {
    const v = ref.current;
    if (!v) return resolve(null);
    v.measureInWindow((x, y, w, h) => resolve({ x, y, w, h }));
  });

interface Watch {
  ref: RefObject<View | null>;
  fire: () => void;
}

/** 스크롤 크레딧 계측기 — CreditScreen이 하나 만들어 Context로 나눠 준다. */
export interface CreditCtl {
  /** 장면을 등록한다(들어오면 fire가 한 번 불리고 관찰이 멈춘다). 해제 함수를 돌려준다. */
  watch(w: Watch): () => void;
  /** 아직 안 나온 장면이 화면에 들어왔는지 다시 잰다(묶어서). */
  check(): void;
  /** 이름 붙인 장면(마지막 휘슬 'finale')의 자리를 등록한다. */
  mark(id: string, ref: RefObject<View | null>): () => void;
  /** 이름 붙인 장면의 스크롤 내용 안 위치(위 끝, 높이). 없으면 null. */
  rectOf(id: string): Promise<{ top: number; height: number } | null>;
  /** 화면(ScrollView)에 손이 닿으면 불린다 — 커리어 재생이 멈춘다. */
  onTouch(cb: () => void): () => void;
  viewH(): number;
  contentH(): number;
}

const Ctx = createContext<CreditCtl | null>(null);
export const useCredit = () => useContext(Ctx);
/** 장면이 화면에 들어와 올라왔는가 — Reveal 안쪽 연출(줄 하나씩·막대 그리기)이 이걸 본다. 밖에서는 늘 true. */
const RevealedCtx = createContext(true);
export const useRevealed = () => useContext(RevealedCtx);

function createCtl(root: RefObject<View | null>): CreditCtl & {
  setSize(viewH: number, contentH: number): void;
  setY(y: number): void;
  touch(): void;
} {
  const watched = new Set<Watch>();
  const marks = new Map<string, RefObject<View | null>>();
  const touchCbs = new Set<() => void>();
  let viewH = 0;
  let contentH = 0;
  let y = 0;
  let busy = false;
  let again = false;
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function run() {
    if (busy) {
      again = true;
      return;
    }
    busy = true;
    try {
      do {
        again = false;
        if (!watched.size) break;
        const r = await measureWin(root);
        if (!r || r.h <= 0) break;
        // 웹 rootMargin '0px 0px -15% 0px' — 화면 아래쪽 15%를 넘어 들어와야 한다.
        const line = r.y + r.h * 0.85;
        const list = [...watched];
        const rects = await Promise.all(list.map((w) => measureWin(w.ref)));
        list.forEach((w, i) => {
          const m = rects[i];
          if (m && m.y < line && m.y + m.h > r.y && watched.delete(w)) w.fire();
        });
      } while (again);
    } finally {
      busy = false;
    }
  }

  return {
    watch(w) {
      watched.add(w);
      return () => void watched.delete(w);
    },
    // 스크롤 중엔 80ms에 한 번만, 마지막 위치는 꼭 잰다.
    check() {
      const now = Date.now();
      clearTimeout(timer);
      if (now - last >= 80) {
        last = now;
        void run();
      } else timer = setTimeout(() => ((last = Date.now()), void run()), 80 - (now - last));
    },
    mark(id, ref) {
      marks.set(id, ref);
      return () => void (marks.get(id) === ref && marks.delete(id));
    },
    async rectOf(id) {
      const ref = marks.get(id);
      const [r, m] = await Promise.all([measureWin(root), ref ? measureWin(ref) : null]);
      return r && m ? { top: m.y - r.y + y, height: m.h } : null;
    },
    onTouch(cb) {
      touchCbs.add(cb);
      return () => void touchCbs.delete(cb);
    },
    viewH: () => viewH,
    contentH: () => contentH,
    setSize(v, c) {
      viewH = v;
      contentH = c;
    },
    setY(next) {
      y = next;
    },
    touch() {
      for (const cb of [...touchCbs]) cb();
    },
  };
}

/**
 * 크레딧 화면(웹 .wrap + 아래 고정 바): 세로 스크롤 + 좌우 16 여백 + 줄 간격 14. 키트 Screen과 같은 모양이지만 스크롤
 * 위치·손 닿음을 알아야 해서 ScrollView를 직접 둔다(scroll.ts에는 그대로 등록해 뒤로 가기·맨 위로가 옮긴다).
 * overlay는 아래 고정 바 바로 위에 뜨는 것(커리어 재생 버튼).
 */
export function CreditScreen({
  children,
  footer,
  overlay,
}: {
  children: ReactNode;
  footer?: ReactNode;
  overlay?: ReactNode;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const barBelow = useContext(BarBelow);
  const root = useRef<View>(null);
  const [ctl] = useState(() => createCtl(root));
  const [footerH, setFooterH] = useState(0);
  const size = useRef({ v: 0, c: 0 });
  const report = (v: number, ch: number) => {
    size.current = { v, c: ch };
    ctl.setSize(v, ch);
    ctl.check();
  };
  return (
    <Ctx.Provider value={ctl}>
      <View
        ref={root}
        collapsable={false}
        style={{ flex: 1, backgroundColor: c.bg }}
        onLayout={() => ctl.check()}
      >
        <ScrollView
          ref={registerScroll}
          onScroll={(e) => {
            const y = e.nativeEvent.contentOffset.y;
            noteScrollY(y);
            ctl.setY(y);
            ctl.check();
          }}
          scrollEventThrottle={16}
          onLayout={(e) => report(e.nativeEvent.layout.height, size.current.c)}
          onContentSizeChange={(_, h) => report(size.current.v, h)}
          onTouchStart={ctl.touch}
          onScrollBeginDrag={ctl.touch}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingTop: insets.top,
            paddingHorizontal: 16,
            paddingBottom: 24 + (footer || barBelow ? 0 : insets.bottom),
            gap: 14,
          }}
        >
          {children}
        </ScrollView>
        {footer ? (
          <View onLayout={(e) => setFooterH(e.nativeEvent.layout.height)}>{footer}</View>
        ) : null}
        {overlay ? (
          <View
            pointerEvents="box-none"
            style={{ position: 'absolute', right: 16, bottom: footerH + 12 }}
          >
            {overlay}
          </View>
        ) : null}
      </View>
    </Ctx.Provider>
  );
}

/** 웹 credit-rise의 곡선. */
export const RISE = Easing.bezier(0.16, 0.84, 0.24, 1);
/** 웹 credit-pop: 작은 것이 튀어 오른다(scale 0→1, 살짝 넘쳤다 돌아옴). */
export const POP = Easing.bezier(0.3, 1.6, 0.5, 1);

/**
 * 0→1로 흐르는 값(웹 CSS animation 자리). on이 되면 delay 뒤 ms 동안 흐르고, 그 전엔 0에서 기다린다.
 * 동작 줄이기면 처음부터 1.
 */
export function useProgress(
  on: boolean,
  ms: number,
  {
    delay = 0,
    easing = RISE,
    native = true,
  }: { delay?: number; easing?: (t: number) => number; native?: boolean } = {},
): Animated.Value {
  const { motionOK } = useSnapshot(prefs);
  const p = useRef(new Animated.Value(motionOK ? 0 : 1)).current;
  useEffect(() => {
    if (!motionOK) return p.setValue(1);
    if (!on) return;
    const a = Animated.timing(p, {
      toValue: 1,
      duration: ms,
      delay,
      easing,
      useNativeDriver: native,
    });
    a.start();
    return () => a.stop();
  }, [on, motionOK, ms, delay, easing, native, p]);
  return p;
}

export function Pop({
  on = true,
  delay = 0,
  ms = 450,
  style,
  children,
}: {
  on?: boolean;
  delay?: number;
  ms?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const p = useProgress(on, ms, { delay, easing: POP });
  return <Animated.View style={[style, { transform: [{ scale: p }] }]}>{children}</Animated.View>;
}

/**
 * 스크롤 크레딧 장면 한 개(웹 use:reveal + data-credit). 화면에 들어오기 전엔 자리만 차지한 채 숨어 있다가 들어오면
 * 아래에서 올라온다(credit-rise: 72px·0.97배에서 0.9초). now면 처음부터 나온다(맨 위 장면). id는 재생이 끝 위치를
 * 잴 때(finale) 쓴다.
 */
export function Reveal({
  children,
  style,
  now = false,
  id,
  onSeen,
  testID,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  now?: boolean;
  id?: string;
  onSeen?: () => void;
  testID?: string;
}) {
  const ctl = useCredit();
  const { motionOK } = useSnapshot(prefs);
  // 계측기가 없는 곳(CreditScreen 밖)에서는 들어오는 때를 알 수 없으니 처음부터 보인다.
  const [on, setOn] = useState(now || !motionOK || !ctl);
  const ref = useRef<View>(null);
  const seen = useRef(onSeen);
  useEffect(() => {
    seen.current = onSeen;
  });
  useEffect(() => {
    if (on || !ctl) return;
    const stop = ctl.watch({
      ref,
      fire: () => {
        setOn(true);
        seen.current?.();
      },
    });
    ctl.check();
    return stop;
  }, [on, ctl]);
  useEffect(() => (ctl && id ? ctl.mark(id, ref) : undefined), [ctl, id]);
  const p = useProgress(on, 900);
  return (
    <RevealedCtx.Provider value={on}>
      <Animated.View
        ref={ref}
        collapsable={false}
        testID={testID}
        onLayout={() => ctl?.check()}
        style={[
          style,
          {
            // 웹은 visibility로 숨긴다(전환 중 명도 대비) — 들어오기 전엔 안 보이고, 오르는 첫 프레임부터 보인다.
            opacity: p.interpolate({ inputRange: [0, 0.02, 1], outputRange: [0, 1, 1] }),
            transform: [
              { translateY: p.interpolate({ inputRange: [0, 1], outputRange: [72, 0] }) },
              { scale: p.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) },
            ],
          },
        ]}
      >
        {children}
      </Animated.View>
    </RevealedCtx.Provider>
  );
}
