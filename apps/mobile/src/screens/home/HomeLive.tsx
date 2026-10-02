// 홈 라이브 현황(웹 HomeLive.svelte). 서버에 실제로 올라온 시즌·은퇴 기록으로 "지금 뛰는 중" 숫자와 소식 티커를
// 보여 준다(가짜 활동 없음). 1분마다 새로 받고(앱이 보일 때만 — CLAUDE.md의 폴링은 분 단위), 그 사이 새 소식은 실시간
// 소켓으로 바로 받아 맨 위에 끼운다(다음 조회가 그 소식을 담으면 조회 결과로 넘긴다). 티커는 3.5초마다 한 줄씩 올라간다 —
// 동작 줄이기면 움직이지 않고 최신 3줄만, 누르고 있거나 일시정지를 누르면 멈춘다.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Animated, AppState, Easing, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { useSnapshot } from 'valtio';
import { LIVE_POLL_SEC } from '@offside/contracts/polling';
import { getLive } from '@offside/app-core/api/client';
import { onLive } from '@offside/app-core/api/liveSocket';
import { agoKo } from '@offside/app-core/format';
import {
  LIVE_STEP_MS,
  LIVE_VISIBLE,
  STATS,
  advanceCursor,
  applyLoad,
  applyPush,
  emptyHomeLive,
  feedOf,
  isRolling,
  keyOf,
  rowKey,
  statTiles,
  statsOf,
  tone as toneOf,
  visibleRows,
  what,
  who,
  type HomeLiveState,
} from '@offside/app-core/homeLive';
import { CountUp } from '../../components/CountUp';
import { openPublicLegendById } from '../../game/host';
import { prefs } from '../../store';
import { DISPLAY, rem } from '../../theme/type';
import { useColors } from '../../theme/useColors';
import { Btn, Card, ClubMark, Press, Txt } from '../../ui';

const POLL_MS = LIVE_POLL_SEC * 1000;
const STEP_MS = LIVE_STEP_MS;
const VISIBLE = LIVE_VISIBLE;
/** 한 줄 높이 — 세 줄 창 높이(ROW × 3)와 올라가는 거리. */
const ROW = 44;

export function HomeLive() {
  const c = useColors();
  const { motionOK } = useSnapshot(prefs);
  const [live, setLive] = useState<HomeLiveState>(emptyHomeLive);
  /** 조회가 실패한 적이 있다. 받은 데이터가 없을 때만 안내 문구를 띄우는 데 쓴다. */
  const [failed, setFailed] = useState(false);
  /** 서버 시각 - 이 기기 시각. '몇 분 전'을 서버 기준으로 센다. */
  const [skew, setSkew] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [shifting, setShifting] = useState(false);
  const [paused, setPaused] = useState(false);
  const [holding, setHolding] = useState(false);
  const [shiftY] = useState(() => new Animated.Value(0));
  const shiftAnim = useRef<Animated.CompositeAnimation | null>(null);

  const { data, cursor, fresh } = live;
  const feed = feedOf(live);
  const rolling = isRolling(motionOK, feed.length);
  // 한 줄 더 그려 두고(가려짐) 올라가는 동안 아래에서 들어오게 한다.
  const rows = visibleRows(feed, cursor, rolling);
  const stats = statTiles(statsOf(live));
  /** 첫 응답 전 — 같은 높이의 자리표시 카드를 그린다. */
  const pending = !data && !failed;
  const ago = (at: string) => agoKo(now + skew - Date.parse(at));

  // 조회 + 소켓. 앱이 보일 때만 분마다 다시 받고, 앞으로 돌아오면 바로 한 번 받는다.
  useEffect(() => {
    let alive = true;
    const interrupt = () => {
      // 올라가던 중이면 멈추고 맨 위부터 다시 보여 준다.
      shiftAnim.current?.stop();
      setShifting(false);
    };
    const load = async () => {
      const r = await getLive();
      if (!alive) return;
      if (!r.ok) {
        setFailed(true);
        return;
      }
      setSkew(Date.parse(r.data.now) - Date.now());
      interrupt();
      setLive((p) => applyLoad(p, r.data));
      setNow(Date.now());
    };
    void load();
    const poll = setInterval(() => {
      if (AppState.currentState === 'active') void load();
    }, POLL_MS);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && void load());
    const disconnect = onLive((p) => {
      if (p.type !== 'event') return;
      interrupt();
      setLive((prev) => applyPush(prev, p.event));
      setNow(Date.now());
    });
    return () => {
      alive = false;
      disconnect();
      clearInterval(poll);
      sub.remove();
    };
  }, []);

  // 3.5초마다 '몇 분 전'을 새로 세고, 한 줄씩 올린다.
  useEffect(() => {
    const step = setInterval(() => {
      setNow(Date.now());
      if (!rolling || paused || holding || AppState.currentState !== 'active') return;
      setShifting(true);
      const anim = Animated.timing(shiftY, {
        toValue: -ROW,
        duration: 550,
        easing: Easing.bezier(0.3, 0.7, 0.3, 1),
        useNativeDriver: true,
      });
      shiftAnim.current = anim;
      anim.start(({ finished }) => {
        if (!finished) return;
        setLive(advanceCursor);
        setShifting(false);
      });
    }, STEP_MS);
    return () => clearInterval(step);
  }, [rolling, paused, holding, shiftY]);
  // 새 줄이 그려지는 같은 프레임에 창 위치를 되돌린다(되돌리기가 먼저 보이면 한 줄 깜빡인다).
  useLayoutEffect(() => {
    if (!shifting) shiftY.setValue(0);
  }, [cursor, shifting, shiftY]);

  return (
    <View
      testID={pending ? 'home-live-pending' : !data && failed ? 'home-live-offline' : 'home-live'}
      accessibilityElementsHidden={pending}
      importantForAccessibility={pending ? 'no-hide-descendants' : 'auto'}
    >
      {!data || stats.length || feed.length ? (
        <Card gap={12}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <LiveDot motionOK={motionOK} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt v="eyebrow">Live</Txt>
              <Txt v="h2" accessibilityRole="header" style={{ fontSize: rem(1.0625) }}>
                지금 오프사이드에서는
              </Txt>
            </View>
            {rolling ? (
              // 아이콘만 보인다: 멈춰 있으면 재생(▶), 흐르고 있으면 일시정지(❚❚). 읽기 도구에는 '일시정지' 토글로 읽힌다.
              <Btn
                sm
                testID="live-pause"
                accessibilityLabel="소식 일시정지"
                onPress={() => setPaused((v) => !v)}
                style={{ width: 44, paddingHorizontal: 0 }}
              >
                <Svg width={18} height={18} viewBox="0 0 24 24" fill={c.ink}>
                  {paused ? (
                    <Path d="M8 5.5v13a1 1 0 0 0 1.52.85l10.4-6.5a1 1 0 0 0 0-1.7L9.52 4.65A1 1 0 0 0 8 5.5z" />
                  ) : (
                    <>
                      <Rect x={6} y={5} width={4} height={14} rx={1.2} />
                      <Rect x={14} y={5} width={4} height={14} rx={1.2} />
                    </>
                  )}
                </Svg>
              </Btn>
            ) : null}
          </View>

          {!data ? (
            <>
              {/* 자리표시·실패 안내도 숫자 칸과 티커 높이(3줄)를 그대로 잡아 둔다. */}
              <StatGrid>
                {STATS.map((s) => (
                  <StatBox key={s.key} label={s.label}>
                    <StatNum>–</StatNum>
                  </StatBox>
                ))}
              </StatGrid>
              <View
                style={{
                  height: ROW * VISIBLE,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {failed ? (
                  <Txt tone="muted" center style={{ fontSize: rem(0.8125) }}>
                    지금은 현황을 불러오지 못했어요. 잠시 뒤 다시 확인할게요.
                  </Txt>
                ) : null}
              </View>
            </>
          ) : stats.length ? (
            <StatGrid>
              {stats.map((s) => (
                <StatBox key={s.key} label={s.label} testID={`live-stat-${s.key}`}>
                  <StatNum>
                    <CountUp value={s.n} ms={900} />
                  </StatNum>
                </StatBox>
              ))}
            </StatGrid>
          ) : null}

          {data && feed.length ? (
            <View
              onTouchStart={() => setHolding(true)}
              onTouchEnd={() => setHolding(false)}
              onTouchCancel={() => setHolding(false)}
              style={{ height: ROW * VISIBLE, overflow: 'hidden' }}
            >
              <Animated.View style={{ transform: [{ translateY: shiftY }] }}>
                {rows.map((e, i) => {
                  const hidden = rolling && i === VISIBLE && !shifting;
                  return (
                    <View
                      key={rowKey(e, i, rolling, cursor, feed.length)}
                      testID={`live-row-${e.kind}`}
                      accessibilityElementsHidden={hidden}
                      importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
                      style={{
                        height: ROW,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        borderTopWidth: 1,
                        borderTopColor: c.line,
                      }}
                    >
                      <KindDot tone={toneOf(e)} fresh={fresh.has(keyOf(e))} motionOK={motionOK} />
                      {e.kind === 'retire' ? (
                        <Press
                          scale={0.985}
                          disabled={hidden}
                          accessibilityLabel={`${who(e)} ${what(e)}`}
                          onPress={() => void openPublicLegendById(e.careerId)}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <ClubMark name={e.lastClub} id={e.lastClubId} />
                          <Txt
                            numberOfLines={1}
                            style={{
                              flex: 1,
                              fontSize: rem(0.8125),
                              textDecorationLine: 'underline',
                              textDecorationStyle: 'dotted',
                              textDecorationColor: c.line,
                            }}
                          >
                            <Txt bold style={{ fontSize: rem(0.8125) }}>
                              {who(e)}
                            </Txt>{' '}
                            {what(e)}
                          </Txt>
                        </Press>
                      ) : (
                        <View
                          style={{
                            flex: 1,
                            minWidth: 0,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <ClubMark name={e.club} id={e.clubId} />
                          <Txt numberOfLines={1} style={{ flex: 1, fontSize: rem(0.8125) }}>
                            <Txt bold style={{ fontSize: rem(0.8125) }}>
                              {who(e)}
                            </Txt>{' '}
                            {what(e)}
                          </Txt>
                        </View>
                      )}
                      <Txt tone="muted" style={{ fontSize: rem(0.6875) }}>
                        {ago(e.at)}
                      </Txt>
                    </View>
                  );
                })}
              </Animated.View>
            </View>
          ) : null}
        </Card>
      ) : null}
    </View>
  );
}

/** 웹 .live-stats — 칸 폭은 남은 칸이 나눠 갖는다(최소 70). */
function StatGrid({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>;
}
function StatBox({
  label,
  testID,
  children,
}: {
  label: string;
  testID?: string;
  children: React.ReactNode;
}) {
  const c = useColors();
  return (
    <View
      {...(testID ? { testID } : {})}
      accessible
      accessibilityLabel={label}
      style={{
        flexGrow: 1,
        flexBasis: 70,
        minWidth: 0,
        backgroundColor: c.surface2,
        borderRadius: 10,
        paddingVertical: 8,
        paddingHorizontal: 10,
        gap: 1,
      }}
    >
      {children}
      <Txt tone="muted" style={{ fontSize: rem(0.6875) }}>
        {label}
      </Txt>
    </View>
  );
}
/** 숫자가 길어지면(오늘 치른 시즌 16426 등) 줄바꿈 대신 칸 폭에 맞춰 글자를 줄인다. */
function StatNum({ children }: { children: React.ReactNode }) {
  return (
    <Txt
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.5}
      style={{
        fontFamily: DISPLAY[700],
        fontVariant: ['tabular-nums'],
        fontSize: rem(1.375),
        lineHeight: rem(1.375) * 1.1,
      }}
    >
      {children}
    </Txt>
  );
}

/** 웹 .live-dot — 빨간 점에서 고리가 퍼져 나간다. */
function LiveDot({ motionOK }: { motionOK: boolean }) {
  const c = useColors();
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!motionOK) return;
    const loop = Animated.loop(
      Animated.timing(v, {
        toValue: 1,
        duration: 1800,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [motionOK, v]);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.bad }}
    >
      {motionOK ? (
        <Animated.View
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 5,
            backgroundColor: c.bad,
            opacity: v.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.45, 0, 0] }),
            transform: [
              { scale: v.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 2.8, 2.8] }) },
            ],
          }}
        />
      ) : null}
    </View>
  );
}

/** 웹 .live-kind — 소식 종류 점. 새 소식이면 한 번 튄다. */
function KindDot({ tone, fresh, motionOK }: { tone: string; fresh: boolean; motionOK: boolean }) {
  const c = useColors();
  const [v] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (!fresh || !motionOK) return;
    v.setValue(0.6);
    Animated.timing(v, {
      toValue: 1,
      duration: 600,
      easing: Easing.bezier(0.2, 1.6, 0.4, 1),
      useNativeDriver: true,
    }).start();
  }, [fresh, motionOK, v]);
  const bg =
    tone === 'retire' ? c.accent : tone === 'honor' ? c.good : tone === 'first' ? c.pitch2 : c.line;
  return (
    <Animated.View
      accessibilityElementsHidden
      style={{
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: bg,
        transform: [{ scale: v }],
      }}
    />
  );
}
