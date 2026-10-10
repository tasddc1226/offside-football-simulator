// 이적시장(웹 ui/Market.svelte, T-11-080) — 지금 시즌 은퇴 선수 카드를 구단 자금으로 사고판다. 구단주 화면의 '이적시장'으로 연다.
// T-11-080d 시안대로: 초록 머리에 구단 자금과 '자금 만들기', 탭 셋(선수 사기 · 팔기 · 내 거래), 카드 모양 목록,
// 카드 상세 영입 시트, 카드 고르기 + 슬라이더 판매, 방출 화면. 각 화면은 처음 열 때만 불러온다(미리 받기·폴링 없음).
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Modal, PanResponder, Pressable, ScrollView, View } from 'react-native';
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
  setCardLock,
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
  marketTabs,
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
  type MarketView,
  needsOwnerLogin,
} from '@offside/app-core/market';
import { agoKo, fmtValue } from '@offside/app-core/format';
import { localCareerNames } from '@offside/game/hof-store';
import { POS } from '@offside/game/data';
import { appState, prefs } from '../../store';
import { go } from '../../game/nav';
import { fundsHistoryText as F } from '@offside/app-core/i18n/ko/fundsHistory';
import { notificationDestination } from '../../platform/notificationDestination';
import { toast } from '../../game/host';
import { useColors } from '../../theme/useColors';
import type { Colors } from '../../theme/colors';
import { DISPLAY, rem } from '../../theme/type';
import { ActionBar, BackBar, Btn, Press, Screen, Topbar, Txt } from '../../ui';
import { useOnPull } from '../../ui/refresh';
import { PlayerCard } from '../../components/PlayerCard';
import { LoginButtons } from './LoginButtons';
import { MarketChart, MarketIndex } from './MarketChart';
import { marketText as L } from '@offside/app-core/i18n/ko/market';
import { intlLocale } from '@offside/app-core/i18n/core';
import { seasonLabel, teamSeasonLabel } from '@offside/app-core/seasonName';

type Sent<T> = Promise<
  { ok: true; data: T } | { ok: false; error: { message: string; reason?: string | undefined } }
>;

const SORT_KEYS = Object.keys(MARKET_SORT_LABEL) as MarketSort[];

/** 목록·고르기용 카드 — 진짜 PlayerCard의 compact·mini판(OVR·자리·시즌·국기·등번호). 폭은 pitch 슬롯(62)과 거의 같은 64. */
function MiniCard({
  c: card,
  name,
  dim,
}: {
  c: {
    nation?: string | null | undefined;
    season?: number | undefined;
    peak: number;
    number: number | null;
    legendScore: number | null;
    pos: CareerPos;
    dpos: DetailPos | null;
    attrs: TeamPlayer['attrs'];
    locked?: boolean | undefined;
  };
  name: string;
  dim?: boolean;
}) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: 64, opacity: dim ? 0.45 : 1 }}
    >
      <PlayerCard
        compact
        mini
        animate={false}
        code={detailPosOf(card)}
        cell={{
          name,
          nation: card.nation,
          season: card.season,
          rating: card.peak,
          number: card.number,
          legendScore: card.legendScore,
          attrs: card.attrs,
          pos: card.pos,
          locked: card.locked,
          youth: false,
        }}
      />
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
          accessibilityLabel={L.close}
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
      accessibilityLabel={L.sliderLabelApp}
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
        accessibilityLabel={L.liveAll({ n: recent.length })}
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
        <Txt style={{ fontSize: rem(0.75), fontWeight: '700', color: c.bad }}>{L.justSold}</Txt>
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
              <MiniCard c={s.card} name={marketName(s.card, local)} />
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Txt bold numberOfLines={1}>
                  {marketName(s.card, local)}
                </Txt>
                <Txt tone="muted" style={{ fontSize: rem(0.75) }}>
                  {L.liveBase({
                    ago: agoKo(Date.now() - Date.parse(s.soldAt)),
                    value: fmtValue(s.card.cardValue),
                  })}
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

// T-11-158 '구단 자금 내역 보기'로 나갔다가 뒤로 돌아오면 '내 거래' 탭을 다시 연다(한 번만 읽는다).
let backToTrades = false;

export default function Market() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const local = useMemo(() => localCareerNames(), []);
  const destination = useSnapshot(notificationDestination);
  const [view, setView] = useState<MarketView>(() => {
    const back = backToTrades;
    backToTrades = false;
    return destination.market || back ? 'trades' : 'market';
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 자금 · 구단 가치 · 내 등록 · 최근 거래(1분 메모). 쓰기가 성공하면 apiFetch가 메모를 비우니 다시 받는다.
  const [me, setMe] = useState<MarketMeResponse | null>(null);
  const [meFailed, setMeFailed] = useState<string | null>(null);
  // 로그인 전(세션 없음 · 구글/애플 연결 전) — 매물을 누르면 영입 대신 로그인을 권한다.
  const [guest, setGuest] = useState(false);
  const loadMe = useCallback(async () => {
    const r = await fetchMarketMe();
    setGuest(!r.ok && needsOwnerLogin(r.error));
    if (r.ok) {
      setMe(r.data);
      setMeFailed(null);
    } else setMeFailed(r.error.message);
  }, []);
  const meLoaded = useRef(false);
  useEffect(() => {
    if (destination.market) {
      notificationDestination.market = false;
      setView('trades');
      meLoaded.current = true;
      void loadMe();
    } else if (!meLoaded.current) {
      meLoaded.current = true;
      void loadMe();
    }
  }, [loadMe, destination.market]);

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
  const seasonName = team?.seasons.find((o) => o.id === team.season)
    ? teamSeasonLabel(team.season)
    : '';

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
  /** silent: T-11-111 당겨서 새로고침 — 목록을 비우지 않고, 시장 지수도 한 번 불러왔으면 다시 받는다. */
  const refresh = async (silent = false) => {
    await Promise.all([
      loadMe(),
      view === 'market'
        ? Promise.all([loadList(0, silent), silent && indexAsked.current ? loadIndex() : null])
        : view === 'sell' || view === 'release'
          ? loadTeam()
          : null,
    ]);
  };
  // T-11-111 당겨서 새로고침 — 보이는 탭의 데이터만 조용히 다시 받는다(목록을 비우지 않는다). 사고파는 중에는 건너뛴다.
  useOnPull(() => (busy ? undefined : refresh(true)));
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

  // T-11-188 잠금 풀기(팔기 · 방출 화면). 잠그기는 팀 라커룸에서 한다.
  const unlockBtn = (p: TeamPlayer) => (
    <Press
      testID={`market-unlock-${p.careerId}`}
      accessibilityRole="button"
      disabled={busy}
      hitSlop={8}
      onPress={() => void run(() => setCardLock(p.careerId, false), MARKET_TOAST.unlocked)}
      style={{ minHeight: 32, alignItems: 'center', justifyContent: 'center' }}
    >
      <Txt style={{ fontSize: rem(0.75), fontWeight: '600', color: c.accentText }}>
        {L.playerUnlock}
      </Txt>
    </Press>
  );

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
        ? L.ownListing
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
                    <Txt style={small}>{L.dockSum({ n: pickedPlayers.length })}</Txt>
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
                    {L.dockWarn}
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
                    {L.releaseBtn({ n: pickedPlayers.length })}
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
              {L.title}
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
              <Txt style={{ ...tiny, color: c.onPitch, opacity: 0.8 }}>{L.funds}</Txt>
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
                {L.makeFunds}
              </Txt>
            </Press>
          </View>
          {me ? (
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[
                [L.statClubValue, fmtValue(me.clubValue)],
                [L.statBuysToday, `${me.rules.dailyBuys - me.buysLeft} / ${me.rules.dailyBuys}`],
                [L.statListed, `${me.listings.length} / ${me.rules.listLimit}`],
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
                {L.releasePane}
              </Txt>
              <Press onPress={() => open('market')} accessibilityRole="button" hitSlop={8}>
                <Txt style={{ ...small, fontWeight: '600', color: c.accentText }}>
                  {L.backToMarket}
                </Txt>
              </Press>
            </View>
            <Txt tone="muted" style={small}>
              {L.releaseIntro}
            </Txt>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {(team?.seasons ?? []).map((o) => (
                  <FilterChip
                    key={o.id}
                    on={team?.season === o.id}
                    label={L.seasonChip({ name: seasonLabel(o.id, o.name) })}
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
                    {allPicked ? L.pickNone : L.pickAll}
                  </Txt>
                </Press>
              ) : null}
            </View>
            {!team ? (
              <Txt tone="muted" style={small}>
                {teamFailed ? L.playersFailed : L.loading}
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
                    accessibilityLabel={L.releasePickLabel({ name: nameOfPlayer(p) })}
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
                    <MiniCard c={p} name={nameOfPlayer(p)} dim={!!lock} />
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <Txt bold numberOfLines={1}>
                        {nameOfPlayer(p)}
                      </Txt>
                      <Txt tone={lock ? 'bad' : 'muted'} style={tiny}>
                        {lock ??
                          L.releaseInfo({
                            score: (p.legendScore ?? 0).toLocaleString(intlLocale()),
                          })}
                      </Txt>
                    </View>
                    {!lock && me ? (
                      <Txt bold style={small}>
                        {fundsText(releaseValue(p, me.rules.releaseRate))}
                      </Txt>
                    ) : null}
                    {p.locked && p.raised ? unlockBtn(p) : null}
                  </Press>
                );
              })
            ) : (
              <Txt tone="muted" style={small}>
                {L.noRetired({ season: seasonName })}
              </Txt>
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
              {marketTabs().map(([k, label]) => (
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
                      label={p ? POS[p].label : L.posAll}
                      testID={`market-pos-${p ?? 'all'}`}
                      onPress={() => setPos(p)}
                    />
                  ))}
                </View>
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    rowGap: 2,
                  }}
                >
                  <Txt tone="muted" style={small}>
                    {season === null ? '' : L.seasonCount({ n: items.length, more: hasMore })}
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
                    {L.loading}
                  </Txt>
                ) : listStatus === 'error' ? (
                  <View style={{ gap: 8 }}>
                    <Txt tone="muted" style={small}>
                      {L.listFailed}
                    </Txt>
                    <Btn block onPress={() => void loadList(0)}>
                      {L.reload}
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
                            accessibilityLabel={L.openListing({ name: marketName(l.card, local) })}
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
                            <MiniCard c={l.card} name={marketName(l.card, local)} />
                            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                              <Txt numberOfLines={1}>
                                <Txt bold>{marketName(l.card, local)}</Txt>
                                {myListingIds.has(l.id) ? (
                                  <Txt
                                    tone="muted"
                                    style={{ fontSize: rem(0.6875), fontWeight: '700' }}
                                  >
                                    {`  ${L.myListing}`}
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
                        {L.more}
                      </Btn>
                    ) : null}
                  </>
                )}
              </View>
            ) : view === 'sell' ? (
              <View testID="market-sell" style={{ gap: 10 }}>
                <Txt bold accessibilityRole="header" style={small}>
                  {`${L.sellStep1} `}
                  <Txt tone="muted" style={small}>
                    {L.sellSeasonOnly({ season: seasonName || L.thisSeason })}
                  </Txt>
                </Txt>
                {!team ? (
                  <Txt tone="muted" style={small}>
                    {teamFailed ? L.playersFailed : L.loading}
                  </Txt>
                ) : !isCurrent || team.players.length === 0 ? (
                  <Txt tone="muted" style={small}>
                    {L.sellNone}
                  </Txt>
                ) : (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {team.players.map((p) => {
                      const on = selling?.careerId === p.careerId;
                      const off = !sellable(p);
                      return (
                        <View
                          key={p.careerId}
                          style={{ width: '23%', flexGrow: 1, maxWidth: '25%', gap: 2 }}
                        >
                          <Press
                            testID={`market-sell-pick-${p.careerId}`}
                            disabled={off}
                            accessibilityRole="button"
                            accessibilityLabel={L.sellPickLabel({ name: nameOfPlayer(p) })}
                            accessibilityState={{ selected: on, disabled: off }}
                            onPress={() => {
                              setSelling(p);
                              setPct(100);
                              setError(null);
                            }}
                            style={{
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
                            <MiniCard c={p} name={nameOfPlayer(p)} dim={off} />
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
                              {on ? L.sellSelected : sellNote(p, lineup)}
                            </Txt>
                          </Press>
                          {p.locked ? unlockBtn(p) : null}
                        </View>
                      );
                    })}
                  </View>
                )}
                {selling && quote && me ? (
                  <View style={{ ...box, borderRadius: 16, gap: 12, padding: 14 }}>
                    <Txt bold style={small}>
                      {L.sellStep2({
                        name: nameOfPlayer(selling),
                        pos: detailPosOf(selling),
                        peak: selling.peak,
                      })}
                    </Txt>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {(
                        [
                          [
                            L.presetBase,
                            fmtValue(selling.cardValue!),
                            pct === 100,
                            () => setPct(100),
                          ],
                          [
                            L.presetCustom,
                            pct === 100 ? L.presetSlider : fmtValue(sellPrice),
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
                        <Txt style={{ fontSize: rem(0.8125) }}>{L.price}</Txt>
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
                      <Line
                        label={L.fee({ pct: range!.feePct })}
                        value={`−${fmtValue(quote.fee)}`}
                      />
                      <Line strong label={L.gets} value={fmtValue(quote.gets)} />
                    </View>
                    <Txt tone="muted" style={small}>
                      {L.sellHelp}
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
                      {L.listFor({ price: fmtValue(sellPrice) })}
                    </Btn>
                  </View>
                ) : null}
              </View>
            ) : (
              <View testID="market-trades" style={{ gap: 10 }}>
                {!me ? (
                  <Txt tone="muted" style={small}>
                    {meFailed ?? L.loading}
                  </Txt>
                ) : (
                  <>
                    <Txt bold accessibilityRole="header" style={small}>
                      {L.tradesListed}
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
                          <MiniCard c={l.card} name={marketName(l.card, local)} />
                          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                            <Txt bold numberOfLines={1}>
                              {marketName(l.card, local)}
                            </Txt>
                            <Txt tone="muted" style={tiny}>
                              {L.listedAgo({
                                price: fmtValue(l.price),
                                ago: agoKo(Date.now() - Date.parse(l.createdAt)),
                              })}
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
                            {L.unlistBtn}
                          </Btn>
                        </View>
                      ))
                    ) : (
                      <Txt tone="muted" style={small}>
                        {L.noListed}
                      </Txt>
                    )}
                    {/* T-11-158 자금 내역은 구단주 화면의 구단 자금 내역 한 곳에서 본다(방출 · 거래 · 구단 자금 사용 전부). */}
                    <Btn
                      sm
                      kind="ghost"
                      testID="market-funds-history"
                      onPress={() => {
                        backToTrades = true;
                        go('funds');
                      }}
                    >
                      {F.openAria}
                    </Btn>
                  </>
                )}
              </View>
            )}
          </>
        )}
      </Screen>

      <MarketSheet open={!!buying && (!!me || guest)} label={L.sheetBuy} onClose={closeSheets}>
        {buying && (me || guest) ? (
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
              <View style={{ width: 170 }}>
                <PlayerCard
                  animate={false}
                  code={detailPosOf(buying.card)}
                  cell={{
                    name: marketName(buying.card, local),
                    nation: buying.card.nation,
                    season: buying.card.season,
                    rating: buying.card.peak,
                    number: buying.card.number,
                    legendScore: buying.card.legendScore,
                    attrs: buying.card.attrs,
                    height: buying.card.height,
                    weight: buying.card.weight,
                    cardValue: buying.card.cardValue,
                    pos: buying.card.pos,
                    type: buying.card.type ?? null,
                    youth: false,
                  }}
                />
              </View>
              <View style={{ flexDirection: 'row', gap: 8, alignSelf: 'stretch' }}>
                {[
                  [L.detailLegend, buying.card.legendScore.toLocaleString(intlLocale())],
                  [L.detailTransfers, L.transferTimes({ n: buying.card.transfers })],
                  [L.position, POS[buying.card.pos].label],
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
                {me ? L.buyTitle : L.loginTitle}
              </Txt>
              <View style={{ gap: 8 }}>
                <Line label={L.baseLine} value={fmtValue(buying.card.cardValue)} />
                <Line
                  big
                  label={L.price}
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
                {me ? (
                  <>
                    <View style={{ height: 1, backgroundColor: c.line }} />
                    <Line label={L.fundsNow} value={fundsText(me.balance)} />
                    <Line
                      strong
                      label={L.fundsAfter}
                      value={
                        me.balance >= buying.price
                          ? fundsText(me.balance - buying.price)
                          : L.notEnough
                      }
                    />
                  </>
                ) : null}
              </View>
              <MarketChart card={buying.card} />
              {!me ? (
                <View testID="market-login" style={{ gap: 10 }}>
                  <View style={{ padding: 12, borderRadius: 10, backgroundColor: c.surface2 }}>
                    <Txt style={small}>{L.loginToBuy}</Txt>
                  </View>
                  <LoginButtons back={{ market: true }} onDone={() => void loadMe()} />
                  <Btn testID="market-sheet-close" onPress={closeSheets}>
                    {L.close}
                  </Btn>
                </View>
              ) : (
                <>
                  <View style={{ padding: 12, borderRadius: 10, backgroundColor: c.surface2 }}>
                    <Txt tone="muted" style={tiny}>
                      {L.buyNote}
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
                      {L.close}
                    </Btn>
                    {myListingIds.has(buying.id) ? (
                      <Btn
                        style={{ flex: 2 }}
                        disabled={busy}
                        onPress={() =>
                          void run(() => cancelListing(buying.id), MARKET_TOAST.unlisted)
                        }
                      >
                        {L.unlist}
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
                        {L.buyFor({ price: fmtValue(buying.price) })}
                      </Btn>
                    )}
                  </View>
                </>
              )}
            </View>
          </>
        ) : null}
      </MarketSheet>

      <MarketSheet open={confirmRelease && !!me} label={L.sheetRelease} onClose={closeSheets}>
        <View
          style={{
            gap: 12,
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: 16 + insets.bottom,
          }}
        >
          <Txt v="h2" accessibilityRole="header">
            {L.sheetRelease}
          </Txt>
          <Txt>{releaseConfirmText(pickedPlayers.length, pickedAmount)}</Txt>
          {errText}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Btn style={{ flex: 1 }} testID="market-sheet-close" onPress={closeSheets}>
              {L.close}
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
              {L.releaseBtn({ n: pickedPlayers.length })}
            </Btn>
          </View>
        </View>
      </MarketSheet>
    </>
  );
}
