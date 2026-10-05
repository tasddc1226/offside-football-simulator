// 홈 전광판(웹 HomeTicker.svelte). 헤더와 첫 카드 사이에서 이적·프로 입단·서버 최초 기록·신기록 소식이 오른쪽에서 왼쪽으로
// 천천히 흐른다(서버에 실제로 올라온 기록만 — ticker.ts). 같은 줄을 두 벌 이어 붙여 한 벌 너비만큼 밀면 끊김 없이
// 돈다. 새로 받은 소식은 한 바퀴가 끝날 때 바꿔 끼워 흐르던 글이 튀지 않게 한다. 누르고 있으면 멈춘다. 동작 줄이기면
// 흐르지 않고 한 줄씩 바꿔 보여 준다.
// 첫 화면이 밀리지 않게 응답 전·실패·빈 목록에도 같은 높이의 줄을 그린다.
import { useEffect, useRef, useState } from 'react';
import { Animated, AppState, Easing, ScrollView, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSnapshot } from 'valtio';
import { TICKER_POLL_SEC } from '@offside/contracts/polling';
import { getTicker } from '@offside/app-core/api/client';
import { clubById } from '@offside/game/clubs';
import { agoKo } from '@offside/app-core/format';
import { tickerItems, type TickerItem } from '@offside/app-core/ticker';
import { prefs } from '../../store';
import { alpha } from '../../theme/colors';
import { rem } from '../../theme/type';
import { useColors } from '../../theme/useColors';
import { ClubMark, Txt } from '../../ui';
import { homeText as L } from '@offside/app-core/i18n/ko/home';
import { tn } from '@offside/game/i18n/names';

/** 흐르는 속도(px/초). 한글 한 줄을 편히 읽을 만큼 천천히. */
const SPEED = 42;
const STILL_STEP_MS = 5_000;

const tag = (kind: TickerItem['kind']): string =>
  ({ transfer: L.tagTransfer, debut: L.tagDebut, first: L.tagFirst, record: L.tagRecord })[kind];
const club = (id: string) => tn(clubById(id)?.name ?? '');

export function HomeTicker() {
  const c = useColors();
  const { motionOK } = useSnapshot(prefs);
  const [items, setItems] = useState<TickerItem[]>([]);
  const [now, setNow] = useState(Date.now());
  const [copyW, setCopyW] = useState(0);
  const [still, setStill] = useState(0);
  const [holding, setHolding] = useState(false);
  /** 흐르는 중에 받은 새 소식 — 한 바퀴가 끝날 때 바꿔 끼운다. */
  const next = useRef<TickerItem[] | null>(null);
  /** 서버 시각 - 이 기기 시각. '몇 분 전'을 서버 기준으로 센다. */
  const [skew, setSkew] = useState(0);
  const motionRef = useRef(motionOK);
  useEffect(() => {
    motionRef.current = motionOK;
  });
  const ago = (at: string) => agoKo(now + skew - Date.parse(at));

  // 받아 오기: 처음 한 번 + 주기적으로(앱이 보일 때만).
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const r = await getTicker();
      if (!alive || !r.ok) return;
      setSkew(Date.parse(r.data.now) - Date.now());
      const fresh = tickerItems(r.data);
      // 처음이거나 흐르지 않을 때는 바로, 흐르는 중이면 한 바퀴가 끝날 때 바꾼다.
      setItems((cur) => {
        if (!cur.length || !motionRef.current) return fresh;
        next.current = fresh;
        return cur;
      });
      setNow(Date.now());
    };
    void load();
    const loadIfActive = () => {
      if (AppState.currentState === 'active') void load();
    };
    const poll = setInterval(loadIfActive, TICKER_POLL_SEC * 1000);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && void load());
    return () => {
      alive = false;
      clearInterval(poll);
      sub.remove();
    };
  }, []);

  // 흐르지 않을 때는 5초마다 한 줄씩.
  useEffect(() => {
    if (motionOK) return;
    const step = setInterval(
      () => setStill((v) => (v + 1) % Math.max(1, items.length)),
      STILL_STEP_MS,
    );
    return () => clearInterval(step);
  }, [motionOK, items.length]);

  // 흐르기: 한 벌 너비(copyW)만큼 왼쪽으로 밀고, 끝나면 소식을 바꿔 끼우고 처음부터. 누르고 있으면 그 자리에서 멈췄다 이어 간다.
  const [x] = useState(() => new Animated.Value(0));
  const pos = useRef(0);
  useEffect(() => {
    const id = x.addListener(({ value }) => {
      pos.current = value;
    });
    return () => x.removeListener(id);
  }, [x]);
  useEffect(() => {
    if (!motionOK || !copyW || holding || !items.length) return;
    let stopped = false;
    let anim: Animated.CompositeAnimation | null = null;
    const run = (from: number) => {
      x.setValue(from);
      anim = Animated.timing(x, {
        toValue: -copyW,
        duration: ((copyW + from) / SPEED) * 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      });
      anim.start(({ finished }) => {
        if (!finished || stopped) return;
        // 한 바퀴 끝 — 새로 받은 소식을 바꿔 끼운다.
        setNow(Date.now());
        if (next.current) {
          pos.current = 0;
          setItems(next.current);
          next.current = null;
          return; // 줄 길이가 바뀌면 copyW가 바뀌어 이 효과가 처음부터 다시 돈다.
        }
        run(0);
      });
    };
    run(Math.max(-copyW, Math.min(0, pos.current)));
    return () => {
      stopped = true;
      anim?.stop();
    };
  }, [motionOK, copyW, holding, items, x]);

  const line = (k: TickerItem, key: string) => (
    <View
      key={key}
      testID={`ticker-${k.kind}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingLeft: 14,
        paddingRight: 26,
      }}
    >
      <TickTag kind={k.kind} />
      {'age' in k ? (
        <>
          <Txt style={tk}>
            {k.who}
            <Txt style={[tk, { color: c.muted, marginLeft: 2 }]}>{L.tickerAge({ age: k.age })}</Txt>
          </Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <ClubMark name={club(k.from)} id={k.from} size={14} />
            <Txt style={tk}>{club(k.from)}</Txt>
          </View>
          <Txt style={[tk, { color: c.muted }]}>→</Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <ClubMark name={club(k.to)} id={k.to} size={14} />
            <Txt style={[tk, { fontWeight: '700' }]}>{club(k.to)}</Txt>
          </View>
        </>
      ) : (
        <>
          <Txt style={tk}>{k.text}</Txt>
          <Txt style={tk}>— {k.who}</Txt>
        </>
      )}
      <Txt style={{ color: c.muted, fontSize: rem(0.75) }}>{ago(k.at)}</Txt>
    </View>
  );

  return (
    <View
      testID="home-ticker"
      accessibilityLabel={L.tickerAria}
      onTouchStart={() => setHolding(true)}
      onTouchEnd={() => setHolding(false)}
      onTouchCancel={() => setHolding(false)}
      style={{
        height: 34,
        justifyContent: 'center',
        overflow: 'hidden',
        borderRadius: 12,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.line,
      }}
    >
      {!items.length ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14 }}>
          <TickTag label="Transfer" />
          <Txt numberOfLines={1} style={[tk, { color: c.muted, flexShrink: 1 }]}>
            {L.tickerIdle}
          </Txt>
        </View>
      ) : !motionOK ? (
        line(items[still % items.length]!, 'still')
      ) : (
        <>
          <ScrollView
            horizontal
            scrollEnabled={false}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ alignItems: 'center' }}
          >
            <Animated.View style={{ flexDirection: 'row', transform: [{ translateX: x }] }}>
              <View
                style={{ flexDirection: 'row' }}
                onLayout={(e) => setCopyW(e.nativeEvent.layout.width)}
              >
                {items.map((k) => line(k, k.key))}
              </View>
              <View
                style={{ flexDirection: 'row' }}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                {items.map((k) => line(k, `${k.key}#2`))}
              </View>
            </Animated.View>
          </ScrollView>
          {/* 양 끝이 흐려지며 들어오고 나간다 */}
          <Fade side="left" color={c.surface} />
          <Fade side="right" color={c.surface} />
        </>
      )}
    </View>
  );
}

const tk = { fontSize: rem(0.8125) } as const;

function Fade({ side, color }: { side: 'left' | 'right'; color: string }) {
  const clear = alpha(color, 0);
  return (
    <LinearGradient
      pointerEvents="none"
      colors={side === 'left' ? [color, clear] : [clear, color]}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      style={{ position: 'absolute', top: 0, bottom: 0, width: 18, [side]: 0 }}
    />
  );
}

/** 웹 .tk-tag — 이적·프로 입단은 금색 톤, 서버 최초·신기록은 노란 톤. */
function TickTag({ kind, label }: { kind?: TickerItem['kind']; label?: string }) {
  const c = useColors();
  const gold = kind === 'transfer' || kind === 'debut';
  const warm = kind === 'first' || kind === 'record';
  return (
    <View
      style={{
        borderRadius: 999,
        paddingVertical: 2,
        paddingHorizontal: 7,
        backgroundColor: gold
          ? alpha(c.accent, 0.16)
          : warm
            ? alpha(c.warn, 0.28)
            : alpha(c.ink, 0.08),
      }}
    >
      <Txt
        style={{
          fontSize: rem(0.6875),
          lineHeight: rem(0.6875) * 1.4,
          fontWeight: '700',
          letterSpacing: rem(0.6875) * 0.02,
          color: gold ? c.accentText : warm ? c.ink : c.muted,
        }}
      >
        {label ?? (kind ? tag(kind) : '')}
      </Txt>
    </View>
  );
}
