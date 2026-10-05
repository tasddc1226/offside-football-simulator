// 이적시장(웹 ui/Market.svelte, T-11-080) — 지금 시즌 은퇴 선수 카드를 구단 자금으로 사고판다. 구단주 화면의 '이적시장'으로 연다.
// T-11-080d 시안대로: 초록 머리에 구단 자금과 '자금 만들기', 탭 셋(선수 사기 · 팔기 · 내 거래), 카드 모양 목록,
// 카드 상세 영입 시트, 카드 고르기 + 슬라이더 판매, 방출 화면. 각 화면은 처음 열 때만 불러온다(미리 받기·폴링 없음).
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Modal, PanResponder, Pressable, ScrollView, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSnapshot } from 'valtio';
import type { CareerPos } from '@offside/contracts';
import { detailPosOf, type DetailPos } from '@offside/contracts/positions';
import {
  buyListing,
  cancelListing,
  createListing,
  fetchMarket,
  fetchMarketChart,
  fetchMarketMe,
  releaseCards,
  type MarketChartPoint,
  type MarketListing,
  type MarketSale,
  type MarketMeResponse,
  type MarketSort,
  isStaleListing,
} from '@offside/app-core/api/market';
import {
  fetchOwnerTeam,
  type OwnerTeamResponse,
  type TeamPlayer,
} from '@offside/app-core/api/team';
import {
  MARKET_POS_FILTERS,
  MARKET_SORT_LABEL,
  MARKET_TICKER_MS,
  MARKET_TOAST,
  MARKET_TABS,
  TRADE_LABEL,
  buyBlock,
  cardMeta,
  fundsText,
  lineupOf,
  marketEmptyText,
  marketName,
  priceAtPct,
  priceDiff,
  releaseAmount,
  releaseConfirmText,
  releaseLock,
  releaseValue,
  saleText,
  sellNote,
  sellSlider,
  sellable,
  sellQuote,
  tradeAmount,
  type MarketView,
} from '@offside/app-core/market';
import { agoKo, cardTier, fmtValue } from '@offside/app-core/format';
import { localCareerNames } from '@offside/game/season';
import { POS_LABEL } from '@offside/game/pos-label';
import { appState, prefs } from '../../store';
import { toast } from '../../game/host';
import { useColors } from '../../theme/useColors';
import type { Colors } from '../../theme/colors';
import { DISPLAY, rem } from '../../theme/type';
import { ActionBar, BackBar, Btn, Press, Screen, Topbar, Txt } from '../../ui';
import { useRefresh } from '../../ui/refresh';
import { CARD_TONES, PlayerCard } from '../../components/PlayerCard';
import { MarketChart, MarketIndex } from './MarketChart';

type Sent<T> = Promise<
  { ok: true; data: T } | { ok: false; error: { message: string; reason?: string | undefined } }
>;

const SORT_KEYS = Object.keys(MARKET_SORT_LABEL) as MarketSort[];
const SHIELD = 'M0 9H16L25 2L50 0L75 2L84 9H100L98 84L86 93L50 100L14 93L2 84Z';

/** 작은 방패 카드(OVR · 세부 포지션). */
function Mini({
  c: card,
  size = 52,
  dim,
}: {
  c: { peak: number; legendScore: number | null; dpos: DetailPos | null; pos: CareerPos };
  size?: number;
  dim?: boolean;
}) {
  const tone = CARD_TONES[cardTier(card.legendScore, card.peak)];
  const t = { a: tone.base, b: tone.line, ink: tone.ink };
  const h = Math.round(size * 1.15);
  const id = `mk${t.a.slice(1)}`;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: h, opacity: dim ? 0.45 : 1 }}
    >
      <Svg
        width={size}
        height={h}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ position: 'absolute' }}
      >
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0.4" y2="1">
            <Stop offset="0" stopColor={t.a} />
            <Stop offset="1" stopColor={t.b} />
          </LinearGradient>
        </Defs>
        <Path d={SHIELD} fill={`url(#${id})`} />
      </Svg>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Txt
          style={{
            fontFamily: DISPLAY[700],
            fontSize: size * 0.42,
            lineHeight: size * 0.46,
            color: t.ink,
          }}
        >
          {card.peak}
        </Txt>
        <Txt style={{ fontFamily: DISPLAY[700], fontSize: size * 0.21, color: t.ink }}>
          {detailPosOf(card)}
        </Txt>
      </View>
    </View>
  );
}

const toneColor = (c: Colors, tone: 'up' | 'down' | 'same') =>
  tone === 'up' ? c.warn : tone === 'down' ? c.good : c.muted;

/** 아래에서 올라오는 시트 — 영입 · 방출 확인이 함께 쓴다. */
function MarketSheet({
  open,
  label,
  onClose,
  children,
}: {
  open: boolean;
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const c = useColors();
  const { motionOK } = useSnapshot(prefs);
  return (
    <Modal
      visible={open}
      transparent
      animationType={motionOK ? 'slide' : 'none'}
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          accessibilityLabel="닫기"
          onPress={onClose}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: c.scrim,
          }}
        />
        <View
          accessibilityViewIsModal
          accessibilityLabel={label}
          style={{
            maxHeight: '92%',
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            overflow: 'hidden',
            backgroundColor: c.surface,
          }}
        >
          <ScrollView>{children}</ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/** 왼쪽 이름, 오른쪽 값 한 줄(웹 .mk-lines). */
function Line({
  label,
  value,
  strong,
  big,
  extra,
}: {
  label: string;
  value: string;
  strong?: boolean;
  big?: boolean;
  extra?: ReactNode;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: 8,
      }}
    >
      <Txt
        tone={strong ? 'ink' : 'muted'}
        style={{ fontSize: rem(0.875), fontWeight: strong ? '700' : '400' }}
      >
        {label}
      </Txt>
      <Txt
        num
        style={
          big
            ? { fontFamily: DISPLAY[700], fontSize: rem(1.5) }
            : { fontSize: rem(0.875), fontWeight: strong ? '700' : '400' }
        }
      >
        {value}
        {extra}
      </Txt>
    </View>
  );
}

/** 기준가 대비 판매가 슬라이더(%) — 네이티브 모듈 없이 PanResponder로 끈다. */
function PctSlider({
  min,
  max,
  step,
  value,
  onChange,
}: {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  const c = useColors();
  const width = useRef(1);
  const latest = useRef({ min, max, step, onChange });
  latest.current = { min, max, step, onChange };
  const at = (x: number) => {
    const { min: lo, max: hi, step: st, onChange: set } = latest.current;
    const ratio = Math.min(1, Math.max(0, x / width.current));
    set(Math.round((lo + ratio * (hi - lo)) / st) * st);
  };
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => at(e.nativeEvent.locationX),
        onPanResponderMove: (e) => at(e.nativeEvent.locationX),
      }),
    [],
  );
  const ratio = (value - min) / (max - min);
  return (
    <View
      testID="market-sell-pct"
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="기준가 대비 판매가"
      accessibilityValue={{ min, max, now: value, text: `${value}%` }}
      onAccessibilityAction={(e) =>
        onChange(
          Math.min(
            max,
            Math.max(min, value + (e.nativeEvent.actionName === 'increment' ? step : -step)),
          ),
        )
      }
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onLayout={(e) => (width.current = e.nativeEvent.layout.width || 1)}
      style={{ height: 32, justifyContent: 'center' }}
      {...pan.panHandlers}
    >
      <View pointerEvents="none" style={{ height: 6, borderRadius: 3, backgroundColor: c.line }}>
        <View
          style={{
            width: `${ratio * 100}%`,
            height: 6,
            borderRadius: 3,
            backgroundColor: c.accent,
          }}
        />
      </View>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: `${ratio * 100}%`,
          marginLeft: -11,
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: c.surface,
          borderWidth: 3,
          borderColor: c.accent,
        }}
      />
    </View>
  );
}

function FilterChip({
  on,
  label,
  onPress,
  testID,
}: {
  on: boolean;
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  const c = useColors();
  return (
    <Press
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={{
        minHeight: 34,
        paddingHorizontal: 13,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: on ? c.ink : c.line,
        backgroundColor: on ? c.ink : c.surface,
        justifyContent: 'center',
      }}
    >
      <Txt
        style={{
          fontSize: rem(0.8125),
          fontWeight: on ? '600' : '400',
          color: on ? c.surface : c.ink,
        }}
      >
        {label}
      </Txt>
    </Press>
  );
}

/** 방출할 선수 고르기 칸. */
function Check({ on, disabled }: { on: boolean; disabled?: boolean }) {
  const c = useColors();
  return (
    <View
      style={{
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: on ? c.bad : c.line,
        backgroundColor: on ? c.bad : disabled ? c.surface2 : c.surface,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {on ? <Txt style={{ color: '#fff', fontSize: rem(0.75), fontWeight: '700' }}>✓</Txt> : null}
    </View>
  );
}

/** '방금 이적' 띠(웹 .mk-live) — 첫 페이지 응답의 최근 거래를 한 줄씩 넘긴다. 서버는 다시 부르지 않는다. */
function LiveStrip({
  recent,
  local,
}: {
  recent: MarketSale[];
  local: ReadonlyMap<string, string>;
}) {
  const c = useColors();
  const { motionOK } = useSnapshot(prefs);
  const [tick, setTick] = useState(0);
  const [openAll, setOpenAll] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (openAll || recent.length < 2) return;
    const t = setInterval(() => setTick((n) => n + 1), MARKET_TICKER_MS);
    return () => clearInterval(t);
  }, [openAll, recent]);
  useEffect(() => {
    if (!motionOK) return;
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, [tick, motionOK, fade]);
  useEffect(() => {
    if (!motionOK) return;
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1600, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [motionOK, pulse]);
  const live = recent[tick % recent.length];
  if (!live) return null;
  return (
    <View
      testID="market-live"
      style={{ borderWidth: 1, borderColor: c.line, borderRadius: 14, backgroundColor: c.surface }}
    >
      <Press
        scale={0.99}
        accessibilityRole="button"
        accessibilityLabel={`방금 이적 ${recent.length}건 모두 보기`}
        accessibilityState={{ expanded: openAll }}
        onPress={() => setOpenAll((v) => !v)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          minHeight: 44,
          paddingHorizontal: 12,
        }}
      >
        <View style={{ width: 8, height: 8 }}>
          <Animated.View
            style={{
              position: 'absolute',
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: c.bad,
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
              transform: [
                { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) },
              ],
            }}
          />
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.bad }} />
        </View>
        <Txt style={{ fontSize: rem(0.75), fontWeight: '700', color: c.bad }}>방금 이적</Txt>
        <Animated.View
          style={{
            flex: 1,
            minWidth: 0,
            opacity: fade,
            transform: [
              { translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
            ],
          }}
        >
          <Txt numberOfLines={1} style={{ fontSize: rem(0.8125) }}>
            {saleText(live, local)}
          </Txt>
        </Animated.View>
        <Txt tone="muted" style={{ fontSize: rem(0.6875) }}>
          {agoKo(Date.now() - Date.parse(live.soldAt))}
        </Txt>
      </Press>
      {openAll ? (
        <View style={{ paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: c.line }}>
          {recent.map((s, i) => (
            <View
              key={s.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingVertical: 8,
                borderTopWidth: i ? 1 : 0,
                borderTopColor: c.line,
              }}
            >
              <Mini c={s.card} size={34} />
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Txt bold numberOfLines={1}>
                  {marketName(s.card, local)}
                </Txt>
                <Txt tone="muted" style={{ fontSize: rem(0.75) }}>
                  {`${agoKo(Date.now() - Date.parse(s.soldAt))} · 기준가 ${fmtValue(s.card.cardValue)}`}
                </Txt>
              </View>
              <Txt bold num style={{ fontSize: rem(0.875) }}>
                {fmtValue(s.price)}
              </Txt>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const small = { fontSize: rem(0.875) } as const;
const tiny = { fontSize: rem(0.75) } as const;

export default function Market() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const local = useMemo(() => localCareerNames(), []);
  const [view, setView] = useState<MarketView>('market');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 자금 · 구단 가치 · 내 등록 · 최근 거래(1분 메모). 쓰기가 성공하면 apiFetch가 메모를 비우니 다시 받는다.
  const [me, setMe] = useState<MarketMeResponse | null>(null);
  const [meFailed, setMeFailed] = useState<string | null>(null);
  const loadMe = useCallback(async () => {
    const r = await fetchMarketMe();
    if (r.ok) {
      setMe(r.data);
      setMeFailed(null);
    } else setMeFailed(r.error.message);
  }, []);
  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  // 선수 사기 — 정렬·포지션이 바뀌면 첫 페이지부터.
  const [sort, setSort] = useState<MarketSort>('new');
  const [pos, setPos] = useState<CareerPos | undefined>(undefined);
  const [items, setItems] = useState<MarketListing[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [season, setSeason] = useState<number | null>(null);
  const [listStatus, setListStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [recent, setRecent] = useState<MarketSale[]>([]);
  const listReq = useRef(0);
  // 정렬을 빠르게 바꿀 때 늦게 온 이전 응답이 덮어쓰지 않게 요청 번호를 둔다.
  const loadList = useCallback(
    async (next = 0, silent = false) => {
      const req = ++listReq.current;
      if (next === 0 && !silent) setListStatus('loading');
      const r = await fetchMarket(sort, pos, next);
      if (req !== listReq.current) return;
      if (!r.ok) return silent ? undefined : setListStatus('error');
      setItems((prev) => (next === 0 ? r.data.items : [...prev, ...r.data.items]));
      // 배포 직후 옛 엣지 응답에는 recent가 없다.
      if (next === 0) setRecent(r.data.recent ?? []);
      setPage(next);
      setHasMore(r.data.hasMore);
      setSeason(r.data.season);
      setListStatus('ok');
    },
    [sort, pos],
  );
  useEffect(() => {
    if (view === 'market') void loadList(0);
  }, [view, loadList]);
  // 시장 지수(최근 7일 · 시장 전체). 선수 사기 탭을 처음 볼 때 한 번(1분 메모).
  const [indexPoints, setIndexPoints] = useState<MarketChartPoint[]>([]);
  const indexAsked = useRef(false);
  const loadIndex = useCallback(
    () => fetchMarketChart('week').then((r) => r.ok && setIndexPoints(r.data.points)),
    [],
  );
  useEffect(() => {
    if (view !== 'market' || indexAsked.current) return;
    indexAsked.current = true;
    void loadIndex();
  }, [view, loadIndex]);
  const myListingIds = useMemo(() => new Set(me?.listings.map((l) => l.id) ?? []), [me]);

  // 팔기는 지금 시즌 선수, 방출은 시즌을 골라 본다(기본은 지금 시즌).
  const [team, setTeam] = useState<OwnerTeamResponse | null>(null);
  const [teamSeason, setTeamSeason] = useState<number | undefined>(undefined);
  const [teamFailed, setTeamFailed] = useState(false);
  const loadTeam = useCallback(async () => {
    const r = await fetchOwnerTeam(view === 'sell' ? undefined : teamSeason);
    if (r.ok) {
      setTeam(r.data);
      setTeamFailed(false);
    } else setTeamFailed(true);
  }, [view, teamSeason]);
  useEffect(() => {
    if (view === 'sell' || view === 'release') void loadTeam();
  }, [view, loadTeam]);
  const lineup = useMemo(() => (team ? lineupOf(team) : new Set<string>()), [team]);
  const isCurrent = !!team && team.season === team.current;
  const nameOfPlayer = (p: TeamPlayer) => marketName(p, local);
  const seasonName = team?.seasons.find((o) => o.id === team.season)?.name ?? '';

  // 방출 — 고른 선수.
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const releasable = team?.players.filter((p) => !releaseLock(p, lineup)) ?? [];
  const pickedPlayers = releasable.filter((p) => picked.has(p.careerId));
  const pickedAmount = me ? releaseAmount(pickedPlayers, me.rules.releaseRate) : 0;
  const allPicked = releasable.length > 0 && pickedPlayers.length === releasable.length;
  const togglePick = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  // 팔기 — 고른 선수와 판매가(기준가의 %).
  const [selling, setSelling] = useState<TeamPlayer | null>(null);
  const [pct, setPct] = useState(100);
  const sellPrice = selling?.cardValue && me ? priceAtPct(selling.cardValue, pct, me.rules) : 0;
  const quote = selling?.cardValue && me ? sellQuote(selling.cardValue, sellPrice, me.rules) : null;

  // 시트: 영입 · 방출 확인.
  const [buying, setBuying] = useState<MarketListing | null>(null);
  const [confirmRelease, setConfirmRelease] = useState(false);

  const open = (v: MarketView) => {
    setView(v);
    setError(null);
    setPicked(new Set());
    setSelling(null);
    setTeamSeason(undefined);
  };
  const closeSheets = () => {
    setBuying(null);
    setConfirmRelease(false);
    setError(null);
  };
  const refresh = async () => {
    await Promise.all([
      loadMe(),
      view === 'market' ? loadList(0) : view === 'sell' || view === 'release' ? loadTeam() : null,
    ]);
  };
  // T-11-111 당겨서 새로고침 — 보이는 탭의 데이터만 조용히 다시 받는다(목록을 비우지 않는다). 사고파는 중에는 건너뛴다.
  const { tick, track } = useRefresh();
  useEffect(() => {
    if (!tick || busy) return;
    void track(
      Promise.all([
        loadMe(),
        view === 'market'
          ? Promise.all([loadList(0, true), indexAsked.current ? loadIndex() : null])
          : view === 'sell' || view === 'release'
            ? loadTeam()
            : null,
      ]),
    );
    // tick이 바뀔 때만.
  }, [tick]);
  async function run<T>(send: () => Sent<T>, done: string) {
    setBusy(true);
    setError(null);
    const r = await send();
    setBusy(false);
    if (!r.ok) {
      setError(r.error.message);
      // 이미 팔렸거나 가격이 바뀌었으면 목록을 새로 받는다.
      if (isStaleListing(r.error)) void loadList(0);
      return;
    }
    closeSheets();
    setPicked(new Set());
    setSelling(null);
    toast(done);
    await refresh();
  }

  const errText = error ? (
    <Txt tone="bad" accessibilityRole="alert" style={{ fontWeight: '600' }}>
      {error}
    </Txt>
  ) : null;
  const range = me ? sellSlider(me.rules) : null;
  const sellDiff = selling?.cardValue ? priceDiff(sellPrice, selling.cardValue) : null;
  const buyDiff = buying ? priceDiff(buying.price, buying.card.cardValue) : null;
  const buyBlocked =
    buying && me
      ? myListingIds.has(buying.id)
        ? '내가 내놓은 선수예요.'
        : buyBlock(buying.price, me.balance, me.buysLeft)
      : null;
  const box = {
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 14,
    backgroundColor: c.surface,
  } as const;
  const glass = { borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)' } as const;

  return (
    <>
      <Screen
        footer={
          <>
            {view === 'release' && pickedPlayers.length > 0 ? (
              <ActionBar>
                <View style={{ gap: 6 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                    }}
                  >
                    <Txt style={small}>{`${pickedPlayers.length}명 방출 · 받는 자금`}</Txt>
                    <Txt
                      style={{
                        fontFamily: DISPLAY[700],
                        fontSize: rem(1.625),
                        color: c.accentText,
                      }}
                    >
                      {`+${fundsText(pickedAmount)}`}
                    </Txt>
                  </View>
                  <Txt tone="bad" style={tiny}>
                    방출한 선수는 다시 데려올 수 없어요.
                  </Txt>
                  <Btn
                    block
                    kind="danger"
                    testID="market-release"
                    onPress={() => {
                      setConfirmRelease(true);
                      setError(null);
                    }}
                  >
                    {`${pickedPlayers.length}명 방출하기`}
                  </Btn>
                </View>
              </ActionBar>
            ) : null}
            <BackBar testID="market-back" fallback={() => (appState.screen = 'owner')} />
          </>
        }
      >
        <Topbar />

        {/* 초록 머리 — 구단 자금 · 자금 만들기 · 요약 셋 */}
        <View
          testID="market-funds"
          style={{ gap: 12, padding: 16, borderRadius: 18, backgroundColor: c.pitch }}
        >
          <View>
            <Txt v="eyebrow" style={{ color: c.onPitch, opacity: 0.75 }}>
              Transfer market
            </Txt>
            <Txt v="h1" accessibilityRole="header" style={{ color: c.onPitch, marginTop: 2 }}>
              이적시장
            </Txt>
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: 12,
              paddingVertical: 12,
              paddingHorizontal: 14,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.16)',
              backgroundColor: 'rgba(255,255,255,0.08)',
            }}
          >
            <View accessible style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Txt style={{ ...tiny, color: c.onPitch, opacity: 0.8 }}>구단 자금</Txt>
              <Txt style={{ fontFamily: DISPLAY[700], fontSize: rem(1.875), color: c.pitchAccent }}>
                {me ? fundsText(me.balance) : '–'}
              </Txt>
            </View>
            <Press
              testID="market-open-release"
              accessibilityRole="button"
              accessibilityState={{ selected: view === 'release' }}
              onPress={() => open('release')}
              style={{
                minHeight: 40,
                paddingHorizontal: 14,
                borderRadius: 999,
                backgroundColor: c.pitchAccent,
                justifyContent: 'center',
              }}
            >
              <Txt style={{ fontSize: rem(0.8125), fontWeight: '700', color: c.accentInk }}>
                자금 만들기
              </Txt>
            </Press>
          </View>
          {me ? (
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[
                ['구단 가치', fmtValue(me.clubValue)],
                ['오늘 영입', `${me.rules.dailyBuys - me.buysLeft} / ${me.rules.dailyBuys}`],
                ['내놓은 선수', `${me.listings.length} / ${me.rules.listLimit}`],
              ].map(([k, v]) => (
                <View
                  key={k}
                  accessible
                  accessibilityLabel={`${k} ${v}`}
                  style={{
                    ...glass,
                    flex: 1,
                    minWidth: 0,
                    paddingVertical: 8,
                    alignItems: 'center',
                  }}
                >
                  <Txt style={{ fontSize: rem(0.6875), color: c.onPitch, opacity: 0.8 }}>{k}</Txt>
                  <Txt style={{ fontFamily: DISPLAY[700], fontSize: rem(1.125), color: c.onPitch }}>
                    {v}
                  </Txt>
                </View>
              ))}
            </View>
          ) : meFailed ? (
            <Txt style={{ fontSize: rem(0.8125), color: c.onPitch, opacity: 0.85 }}>{meFailed}</Txt>
          ) : null}
        </View>

        {view === 'release' ? (
          <View testID="market-release-pane" style={{ gap: 10 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 4,
              }}
            >
              <Txt bold accessibilityRole="header" style={small}>
                방출해서 자금 만들기
              </Txt>
              <Press onPress={() => open('market')} accessibilityRole="button" hitSlop={8}>
                <Txt style={{ ...small, fontWeight: '600', color: c.accentText }}>이적시장으로</Txt>
              </Press>
            </View>
            <Txt tone="muted" style={small}>
              직접 키운 선수를 내보내면 카드 기준가만큼 구단 자금이 생겨요. 명예의 전당 기록은
              그대로 남아요.
            </Txt>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {(team?.seasons ?? []).map((o) => (
                  <FilterChip
                    key={o.id}
                    on={team?.season === o.id}
                    label={`${o.name} 선수`}
                    testID={`market-season-${o.id}`}
                    onPress={() => {
                      setTeamSeason(o.id);
                      setPicked(new Set());
                    }}
                  />
                ))}
              </View>
              {releasable.length > 0 ? (
                <Press
                  testID="market-pick-all"
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() =>
                    setPicked(allPicked ? new Set() : new Set(releasable.map((p) => p.careerId)))
                  }
                >
                  <Txt style={{ ...small, fontWeight: '600', color: c.accentText }}>
                    {allPicked ? '선택 해제' : '전체 선택'}
                  </Txt>
                </Press>
              ) : null}
            </View>
            {!team ? (
              <Txt tone="muted" style={small}>
                {teamFailed ? '내 선수를 불러오지 못했어요.' : '불러오는 중…'}
              </Txt>
            ) : team.players.length ? (
              team.players.map((p) => {
                const lock = releaseLock(p, lineup);
                const on = picked.has(p.careerId);
                return (
                  <Press
                    key={p.careerId}
                    testID={`market-mine-${p.careerId}`}
                    scale={0.99}
                    disabled={!!lock}
                    accessibilityRole="checkbox"
                    accessibilityLabel={`${nameOfPlayer(p)} 방출할 선수로 고르기`}
                    accessibilityState={{ checked: on, disabled: !!lock }}
                    onPress={() => togglePick(p.careerId)}
                    style={{
                      ...box,
                      borderRadius: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      minHeight: 64,
                      paddingVertical: 6,
                      paddingHorizontal: 12,
                      ...(on ? { borderColor: c.bad, backgroundColor: c.surface2 } : null),
                    }}
                  >
                    <Check on={on} disabled={!!lock} />
                    <Mini c={p} size={40} dim={!!lock} />
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <Txt bold numberOfLines={1}>
                        {nameOfPlayer(p)}
                      </Txt>
                      <Txt tone={lock ? 'bad' : 'muted'} style={tiny}>
                        {lock ?? `레전드 ${(p.legendScore ?? 0).toLocaleString()} · 기준가`}
                      </Txt>
                    </View>
                    {!lock && me ? (
                      <Txt bold style={small}>
                        {fundsText(releaseValue(p, me.rules.releaseRate))}
                      </Txt>
                    ) : null}
                  </Press>
                );
              })
            ) : (
              <Txt tone="muted" style={small}>{`${seasonName}에 은퇴한 내 선수가 없어요.`}</Txt>
            )}
          </View>
        ) : (
          <>
            {/* 밑줄 탭 */}
            <View
              accessibilityRole="tablist"
              style={{
                flexDirection: 'row',
                borderTopLeftRadius: 14,
                borderTopRightRadius: 14,
                backgroundColor: c.surface,
                borderBottomWidth: 1,
                borderBottomColor: c.line,
              }}
            >
              {MARKET_TABS.map(([k, label]) => (
                <Press
                  key={k}
                  testID={`market-tab-${k}`}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: view === k }}
                  onPress={() => open(k)}
                  style={{
                    flex: 1,
                    minHeight: 46,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderBottomWidth: 3,
                    borderBottomColor: view === k ? c.accent : 'transparent',
                  }}
                >
                  <Txt
                    tone={view === k ? 'ink' : 'muted'}
                    style={{ ...small, fontWeight: view === k ? '700' : '400' }}
                  >
                    {label}
                  </Txt>
                </Press>
              ))}
            </View>

            {view === 'market' ? (
              <View testID="market-list" style={{ gap: 10 }}>
                <MarketIndex points={indexPoints} />
                <LiveStrip recent={recent} local={local} />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {MARKET_POS_FILTERS.map((p) => (
                    <FilterChip
                      key={p ?? 'all'}
                      on={pos === p}
                      label={p ? POS_LABEL[p] : '전체'}
                      testID={`market-pos-${p ?? 'all'}`}
                      onPress={() => setPos(p)}
                    />
                  ))}
                </View>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Txt tone="muted" style={small}>
                    {season === null ? '' : `이번 시즌 선수 ${items.length}${hasMore ? '+' : ''}명`}
                  </Txt>
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    {SORT_KEYS.map((k) => (
                      <Press
                        key={k}
                        testID={`market-sort-${k}`}
                        accessibilityRole="button"
                        accessibilityState={{ selected: sort === k }}
                        hitSlop={6}
                        onPress={() => setSort(k)}
                        style={{ paddingHorizontal: 6, paddingVertical: 4 }}
                      >
                        <Txt
                          tone={sort === k ? 'ink' : 'muted'}
                          style={{ ...tiny, fontWeight: sort === k ? '700' : '400' }}
                        >
                          {MARKET_SORT_LABEL[k]}
                        </Txt>
                      </Press>
                    ))}
                  </View>
                </View>
                {listStatus === 'loading' ? (
                  <Txt tone="muted" style={small}>
                    불러오는 중…
                  </Txt>
                ) : listStatus === 'error' ? (
                  <View style={{ gap: 8 }}>
                    <Txt tone="muted" style={small}>
                      시장을 불러오지 못했어요.
                    </Txt>
                    <Btn block onPress={() => void loadList(0)}>
                      다시 불러오기
                    </Btn>
                  </View>
                ) : (
                  <>
                    {items.length ? (
                      items.map((l) => {
                        const diff = priceDiff(l.price, l.card.cardValue);
                        return (
                          <Press
                            key={l.id}
                            scale={0.985}
                            testID={`market-listing-${l.id}`}
                            accessibilityLabel={`${marketName(l.card, local)} 영입 보기`}
                            onPress={() => {
                              setBuying(l);
                              setError(null);
                            }}
                            style={{
                              ...box,
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 12,
                              paddingVertical: 10,
                              paddingHorizontal: 12,
                            }}
                          >
                            <Mini c={l.card} />
                            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                              <Txt numberOfLines={1}>
                                <Txt bold>{marketName(l.card, local)}</Txt>
                                {myListingIds.has(l.id) ? (
                                  <Txt
                                    tone="muted"
                                    style={{ fontSize: rem(0.6875), fontWeight: '700' }}
                                  >
                                    {'  내 등록'}
                                  </Txt>
                                ) : null}
                              </Txt>
                              <Txt tone="muted" style={tiny}>
                                {cardMeta(l.card)}
                              </Txt>
                            </View>
                            <View style={{ alignItems: 'flex-end', gap: 2 }}>
                              <Txt num style={{ fontFamily: DISPLAY[700], fontSize: rem(1.1875) }}>
                                {fmtValue(l.price)}
                              </Txt>
                              <Txt
                                style={{
                                  fontSize: rem(0.6875),
                                  fontWeight: '600',
                                  color: toneColor(c, diff.tone),
                                }}
                              >
                                {diff.text}
                              </Txt>
                            </View>
                          </Press>
                        );
                      })
                    ) : (
                      <Txt tone="muted" style={small}>
                        {marketEmptyText(season, !!pos)}
                      </Txt>
                    )}
                    {hasMore ? (
                      <Btn block onPress={() => void loadList(page + 1)}>
                        더 보기
                      </Btn>
                    ) : null}
                  </>
                )}
              </View>
            ) : view === 'sell' ? (
              <View testID="market-sell" style={{ gap: 10 }}>
                <Txt bold accessibilityRole="header" style={small}>
                  {'1. 내놓을 선수 '}
                  <Txt tone="muted" style={small}>{`(${seasonName || '이번 시즌'} 선수만)`}</Txt>
                </Txt>
                {!team ? (
                  <Txt tone="muted" style={small}>
                    {teamFailed ? '내 선수를 불러오지 못했어요.' : '불러오는 중…'}
                  </Txt>
                ) : !isCurrent || team.players.length === 0 ? (
                  <Txt tone="muted" style={small}>
                    이번 시즌에 은퇴한 내 선수가 없어요. 지난 시즌 선수는 방출해서 자금으로 바꿀 수
                    있어요.
                  </Txt>
                ) : (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {team.players.map((p) => {
                      const on = selling?.careerId === p.careerId;
                      const off = !sellable(p);
                      return (
                        <Press
                          key={p.careerId}
                          testID={`market-sell-pick-${p.careerId}`}
                          disabled={off}
                          accessibilityRole="button"
                          accessibilityLabel={`${nameOfPlayer(p)} 내놓을 선수로 고르기`}
                          accessibilityState={{ selected: on, disabled: off }}
                          onPress={() => {
                            setSelling(p);
                            setPct(100);
                            setError(null);
                          }}
                          style={{
                            width: '23%',
                            flexGrow: 1,
                            maxWidth: '25%',
                            minHeight: 104,
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 3,
                            paddingVertical: 6,
                            paddingHorizontal: 4,
                            borderRadius: 12,
                            borderWidth: on ? 2 : 1,
                            borderColor: on ? c.accent : c.line,
                            backgroundColor: on ? c.surface2 : c.surface,
                          }}
                        >
                          <Mini c={p} dim={off} />
                          <Txt numberOfLines={1} style={{ fontSize: rem(0.6875) }}>
                            {nameOfPlayer(p)}
                          </Txt>
                          <Txt
                            style={{
                              fontSize: rem(0.625),
                              fontWeight: '600',
                              color: on ? c.accentText : c.muted,
                            }}
                          >
                            {on ? '선택' : sellNote(p, lineup)}
                          </Txt>
                        </Press>
                      );
                    })}
                  </View>
                )}
                {selling && quote && me ? (
                  <View style={{ ...box, borderRadius: 16, gap: 12, padding: 14 }}>
                    <Txt bold style={small}>
                      {`2. 가격 정하기 · ${nameOfPlayer(selling)} ${detailPosOf(selling)} ${selling.peak}`}
                    </Txt>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {(
                        [
                          [
                            '기준가 그대로',
                            fmtValue(selling.cardValue!),
                            pct === 100,
                            () => setPct(100),
                          ],
                          [
                            '직접 정하기',
                            pct === 100 ? '슬라이더로' : fmtValue(sellPrice),
                            pct !== 100,
                            () => setPct((v) => (v === 100 ? 110 : v)),
                          ],
                        ] as const
                      ).map(([label, value, on, press]) => (
                        <Press
                          key={label}
                          accessibilityRole="button"
                          accessibilityState={{ selected: on }}
                          onPress={press}
                          style={{
                            flex: 1,
                            minHeight: 56,
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 2,
                            borderRadius: 12,
                            borderWidth: on ? 2 : 1,
                            borderColor: on ? c.accent : c.line,
                            backgroundColor: on ? c.surface2 : c.surface,
                          }}
                        >
                          <Txt tone="muted" style={tiny}>
                            {label}
                          </Txt>
                          <Txt bold style={small}>
                            {value}
                          </Txt>
                        </Press>
                      ))}
                    </View>
                    <View style={{ gap: 6 }}>
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'baseline',
                        }}
                      >
                        <Txt style={{ fontSize: rem(0.8125) }}>판매가</Txt>
                        <Txt num style={{ fontFamily: DISPLAY[700], fontSize: rem(1.375) }}>
                          {`${fmtValue(sellPrice)} `}
                          <Txt
                            style={{
                              fontSize: rem(0.6875),
                              fontWeight: '600',
                              color: toneColor(c, sellDiff!.tone),
                            }}
                          >
                            {sellDiff!.text}
                          </Txt>
                        </Txt>
                      </View>
                      <PctSlider
                        min={range!.minPct}
                        max={range!.maxPct}
                        step={range!.step}
                        value={pct}
                        onChange={setPct}
                      />
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Txt tone="muted" style={{ fontSize: rem(0.6875) }}>
                          {`${fmtValue(quote.band.min)} (${range!.minPct}%)`}
                        </Txt>
                        <Txt tone="muted" style={{ fontSize: rem(0.6875) }}>
                          {`${fmtValue(quote.band.max)} (${range!.maxPct}%)`}
                        </Txt>
                      </View>
                    </View>
                    <View
                      style={{ gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: c.line }}
                    >
                      <Line label={`수수료 ${range!.feePct}%`} value={`−${fmtValue(quote.fee)}`} />
                      <Line strong label="팔리면 받는 자금" value={fmtValue(quote.gets)} />
                    </View>
                    <Txt tone="muted" style={small}>
                      팔리기 전까지는 팀에서 계속 뛰어요. 팔리면 선발 자리는 유스 선수가 채워요.
                      언제든 내릴 수 있어요.
                    </Txt>
                    {errText}
                    <Btn
                      block
                      kind="primary"
                      testID="market-list-submit"
                      disabled={busy || !!quote.error}
                      onPress={() =>
                        void run(
                          () => createListing(selling.careerId, sellPrice),
                          MARKET_TOAST.listed,
                        )
                      }
                    >
                      {`${fmtValue(sellPrice)}에 내놓기`}
                    </Btn>
                  </View>
                ) : null}
              </View>
            ) : (
              <View testID="market-trades" style={{ gap: 10 }}>
                {!me ? (
                  <Txt tone="muted" style={small}>
                    {meFailed ?? '불러오는 중…'}
                  </Txt>
                ) : (
                  <>
                    <Txt bold accessibilityRole="header" style={small}>
                      내놓은 선수
                    </Txt>
                    {me.listings.length ? (
                      me.listings.map((l) => (
                        <View
                          key={l.id}
                          style={{
                            ...box,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 12,
                            paddingVertical: 10,
                            paddingHorizontal: 12,
                          }}
                        >
                          <Mini c={l.card} />
                          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                            <Txt bold numberOfLines={1}>
                              {marketName(l.card, local)}
                            </Txt>
                            <Txt tone="muted" style={tiny}>
                              {`${fmtValue(l.price)} · ${agoKo(Date.now() - Date.parse(l.createdAt))} 등록`}
                            </Txt>
                          </View>
                          <Btn
                            sm
                            disabled={busy}
                            testID={`market-unlist-${l.id}`}
                            onPress={() =>
                              void run(() => cancelListing(l.id), MARKET_TOAST.unlisted)
                            }
                          >
                            내리기
                          </Btn>
                        </View>
                      ))
                    ) : (
                      <Txt tone="muted" style={small}>
                        내놓은 선수가 없어요.
                      </Txt>
                    )}
                    <Txt bold accessibilityRole="header" style={{ ...small, marginTop: 6 }}>
                      자금 내역
                    </Txt>
                    {me.trades.length ? (
                      <View style={{ ...box }}>
                        {me.trades.map((t, i) => {
                          const badge =
                            t.kind === 'bought'
                              ? { bg: c.surface2, fg: c.ink }
                              : t.kind === 'sold'
                                ? { bg: c.surface2, fg: c.accentText }
                                : { bg: c.surface2, fg: c.bad };
                          return (
                            <View
                              key={t.id}
                              testID={`market-trade-${t.kind}`}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 10,
                                paddingVertical: 10,
                                paddingHorizontal: 12,
                                borderTopWidth: i ? 1 : 0,
                                borderTopColor: c.line,
                              }}
                            >
                              <View
                                style={{
                                  minWidth: 36,
                                  paddingVertical: 3,
                                  paddingHorizontal: 6,
                                  borderRadius: 6,
                                  alignItems: 'center',
                                  backgroundColor: badge.bg,
                                }}
                              >
                                <Txt
                                  style={{
                                    fontSize: rem(0.6875),
                                    fontWeight: '700',
                                    color: badge.fg,
                                  }}
                                >
                                  {TRADE_LABEL[t.kind]}
                                </Txt>
                              </View>
                              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                                <Txt numberOfLines={1} style={small}>
                                  {`${marketName(t.card, local)} ${POS_LABEL[t.card.pos]} ${t.card.peak}`}
                                </Txt>
                                <Txt tone="muted" style={tiny}>
                                  {`${agoKo(Date.now() - Date.parse(t.at))}${t.kind === 'sold' ? ' · 수수료 뺌' : ''}`}
                                </Txt>
                              </View>
                              <Txt
                                tone={t.kind === 'bought' ? 'ink' : 'good'}
                                bold
                                num
                                style={small}
                              >
                                {tradeAmount(t)}
                              </Txt>
                            </View>
                          );
                        })}
                      </View>
                    ) : (
                      <Txt tone="muted" style={small}>
                        아직 거래가 없어요.
                      </Txt>
                    )}
                  </>
                )}
              </View>
            )}
          </>
        )}
      </Screen>

      <MarketSheet open={!!buying && !!me} label="선수 영입" onClose={closeSheets}>
        {buying && me ? (
          <>
            <View
              style={{
                alignItems: 'center',
                gap: 12,
                padding: 16,
                paddingTop: 20,
                backgroundColor: c.pitch,
              }}
            >
              <View style={{ width: 188 }}>
                <PlayerCard
                  animate={false}
                  code={detailPosOf(buying.card)}
                  cell={{
                    name: marketName(buying.card, local),
                    nation: buying.card.nation,
                    rating: buying.card.peak,
                    number: buying.card.number,
                    legendScore: buying.card.legendScore,
                    attrs: buying.card.attrs,
                    pos: buying.card.pos,
                    youth: false,
                  }}
                />
              </View>
              <View style={{ flexDirection: 'row', gap: 8, alignSelf: 'stretch' }}>
                {[
                  ['레전드 점수', buying.card.legendScore.toLocaleString()],
                  ['이적', `${buying.card.transfers}회`],
                  ['포지션', POS_LABEL[buying.card.pos]],
                ].map(([k, v]) => (
                  <View
                    key={k}
                    accessible
                    accessibilityLabel={`${k} ${v}`}
                    style={{ ...glass, flex: 1, paddingVertical: 8, alignItems: 'center' }}
                  >
                    <Txt style={{ fontSize: rem(0.6875), color: c.onPitch, opacity: 0.8 }}>{k}</Txt>
                    <Txt style={{ fontSize: rem(0.8125), fontWeight: '600', color: c.onPitch }}>
                      {v}
                    </Txt>
                  </View>
                ))}
              </View>
            </View>
            <View
              style={{
                gap: 12,
                paddingHorizontal: 20,
                paddingTop: 16,
                paddingBottom: 16 + insets.bottom,
              }}
            >
              <Txt v="h2" accessibilityRole="header">
                이 선수를 영입할까요?
              </Txt>
              <View style={{ gap: 8 }}>
                <Line label="기준가 (최고 OVR 시즌 몸값)" value={fmtValue(buying.card.cardValue)} />
                <Line
                  big
                  label="판매가"
                  value={fmtValue(buying.price)}
                  extra={
                    <Txt
                      style={{
                        fontSize: rem(0.6875),
                        fontWeight: '600',
                        color: toneColor(c, buyDiff!.tone),
                      }}
                    >
                      {` ${buyDiff!.text}`}
                    </Txt>
                  }
                />
                <View style={{ height: 1, backgroundColor: c.line }} />
                <Line label="지금 구단 자금" value={fundsText(me.balance)} />
                <Line
                  strong
                  label="영입 뒤 남는 자금"
                  value={
                    me.balance >= buying.price ? fundsText(me.balance - buying.price) : '모자라요'
                  }
                />
              </View>
              <MarketChart card={buying.card} />
              <View style={{ padding: 12, borderRadius: 10, backgroundColor: c.surface2 }}>
                <Txt tone="muted" style={tiny}>
                  영입한 선수는 바로 팀에 넣을 수 있어요. 다시 팔 수는 있지만 방출해서 자금으로 바꿀
                  수는 없어요.
                </Txt>
              </View>
              {buyBlocked ? (
                <Txt tone="bad" style={{ fontWeight: '600' }}>
                  {buyBlocked}
                </Txt>
              ) : null}
              {errText}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Btn style={{ flex: 1 }} testID="market-sheet-close" onPress={closeSheets}>
                  닫기
                </Btn>
                {myListingIds.has(buying.id) ? (
                  <Btn
                    style={{ flex: 2 }}
                    disabled={busy}
                    onPress={() => void run(() => cancelListing(buying.id), MARKET_TOAST.unlisted)}
                  >
                    판매 내리기
                  </Btn>
                ) : (
                  <Btn
                    style={{ flex: 2 }}
                    kind="accent"
                    testID="market-buy"
                    disabled={busy || !!buyBlocked}
                    onPress={() =>
                      void run(() => buyListing(buying.id, buying.price), MARKET_TOAST.bought)
                    }
                  >
                    {`${fmtValue(buying.price)}에 영입하기`}
                  </Btn>
                )}
              </View>
            </View>
          </>
        ) : null}
      </MarketSheet>

      <MarketSheet open={confirmRelease && !!me} label="선수 방출" onClose={closeSheets}>
        <View
          style={{
            gap: 12,
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: 16 + insets.bottom,
          }}
        >
          <Txt v="h2" accessibilityRole="header">
            선수 방출
          </Txt>
          <Txt>{releaseConfirmText(pickedPlayers.length, pickedAmount)}</Txt>
          {errText}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Btn style={{ flex: 1 }} testID="market-sheet-close" onPress={closeSheets}>
              닫기
            </Btn>
            <Btn
              style={{ flex: 2 }}
              kind="danger"
              testID="market-release-confirm"
              disabled={busy}
              onPress={() =>
                void run(
                  () => releaseCards(pickedPlayers.map((p) => p.careerId)),
                  MARKET_TOAST.released(pickedPlayers.length),
                )
              }
            >
              {`${pickedPlayers.length}명 방출하기`}
            </Btn>
          </View>
        </View>
      </MarketSheet>
    </>
  );
}
