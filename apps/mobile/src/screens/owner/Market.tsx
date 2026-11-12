import { runMarketMutation, type MarketMutationResult } from '@offside/app-core/marketMutation';
import { useMarketData } from './useMarketData';
import {
  toneColor,
  MiniCard,
  MarketSheet,
  Line,
  PctSlider,
  SubFilters,
  FindRow,
  AttrStrip,
  FilterChip,
  Check,
  LiveStrip,
  StyleTag,
  small,
  tiny,
} from './MarketParts';
// 이적시장(웹 ui/Market.svelte, T-11-080) — 지금 시즌 은퇴 선수 카드를 구단 자금으로 사고판다. 구단주 화면의 '이적시장'으로 연다.
// T-11-080d 시안대로: 초록 머리에 구단 자금과 '자금 만들기', 탭 셋(선수 사기 · 팔기 · 내 거래), 카드 모양 목록,
// 카드 상세 영입 시트, 카드 고르기 + 슬라이더 판매, 방출 화면. 각 화면은 처음 열 때만 불러온다(미리 받기·폴링 없음).
import { FONT, RADIUS } from '@offside/app-core/design-tokens';
import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { chatText as LC } from '@offside/app-core/i18n/ko/chat';
import { shareToLounge } from '../../components/loungeShare';
import { ShareIcon } from '../../components/ShareIcon';

import { useSnapshot } from 'valtio';

import { tradeValue } from '@offside/contracts/card-enhance';
import { enhanceValue } from '@offside/contracts/card-enhance';
import { cardEnhanceText as CE } from '@offside/app-core/i18n/ko/cardEnhance';
import { detailPosOf } from '@offside/contracts/positions';
import {
  buyListing,
  fetchListing,
  cancelListing,
  createListing,
  releaseCards,
  setCardLock,
  type MarketListing,
  type MarketSort,
} from '@offside/app-core/api/market';
import { type TeamPlayer } from '@offside/app-core/api/team';
import { enhanceLossNote } from '@offside/app-core/cardEnhance';
import {
  MARKET_POS_FILTERS,
  marketFiltered,
  marketSeasonChoices,
  cardFrom,
  MARKET_SORT_LABEL,
  MARKET_TOAST,
  marketTabs,
  buyBlock,
  cardMeta,
  fundsText,
  lineupOf,
  marketEmptyText,
  marketName,
  priceAtPct,
  staleListingNext,
  priceDiff,
  releaseAmount,
  releaseConfirmText,
  releaseLock,
  releaseValue,
  sellCandidates,
  sellNote,
  sellSlider,
  sellable,
  sellQuote,
  type MarketView,
  allReleasePicked,
  marketGuestText,
  pickAllIds,
  pickAllLabel,
  togglePickId,
  RELEASE_MAX,
} from '@offside/app-core/market';
import { agoKo, fmtValue } from '@offside/app-core/format';
import { localCareerNames } from '@offside/game/hof-store';
import { POS } from '@offside/game/data';
import { prefs } from '../../store';
import { go, takeFocus, takeMarketListing } from '../../game/nav';
import { measureShown, scrollToView } from '../../ui/scroll';
import { fundsHistoryText as F } from '@offside/app-core/i18n/ko/fundsHistory';
import { notificationDestination } from '../../platform/notificationDestination';
import { askPushAfter } from '../../platform/pushAsk';
import { toast } from '../../game/host';
import { useColors } from '../../theme/useColors';

import { DISPLAY, rem } from '../../theme/type';
import { ActionBar, Btn, Press, Screen, Topbar, Txt } from '../../ui';
import { useOnPull } from '../../ui/refresh';
import { PlayerCard } from '../../components/PlayerCard';
import { LoginButtons } from './LoginButtons';
import { MarketChart, MarketIndex } from './MarketChart';
import { MarketFind } from './MarketFind';

import { marketText as L } from '@offside/app-core/i18n/ko/market';
import { intlLocale } from '@offside/app-core/i18n/core';
import { teamSeasonLabel } from '@offside/app-core/seasonName';
import { Skeleton } from '../../ui/Skeleton';
import { seasonOptions } from '../../ui/seasonOptions';
import { SelectField } from '../settings/parts';

const SORT_KEYS = Object.keys(MARKET_SORT_LABEL) as MarketSort[];
/** T-11-596 시즌 필터의 '모든 시즌'(시즌 id와 겹치지 않는 값). */
const ALL_SEASONS = -1;

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
    // T-11-442 상점의 '방출하러 가기'로 오면 방출 화면부터 연다.
    if (takeFocus('marketRelease')) return 'release';
    return destination.market || back ? 'trades' : 'market';
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const {
    me,
    meFailed,
    guest,
    loadMe,
    sort,
    setSort,
    filter,
    pickFilter,
    items,
    page,
    hasMore,
    season,
    listStatus,
    recent,
    loadList,
    indexPoints,
    refresh,
    team,
    setTeamSeason,
    teamFailed,
    loadTeam,
  } = useMarketData(view, destination.market, setView);
  const [finding, setFinding] = useState(false);
  const myListingIds = useMemo(() => new Set(me?.listings.map((l) => l.id) ?? []), [me]);
  const lineup = useMemo(() => (team ? lineupOf(team) : new Set<string>()), [team]);
  const forSale = useMemo(() => (team ? sellCandidates(team.players, lineup) : []), [team, lineup]);
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
  // T-11-442 서버는 한 번에 RELEASE_MAX명까지 받는다. 전체 선택도 그만큼만 고르고, 더 넣으려 하면 알린다.
  const allPicked = allReleasePicked(releasable.length, pickedPlayers.length);
  const togglePick = (id: string) => {
    const r = togglePickId(picked, id);
    if (r.full) return toast(L.pickLimit({ n: RELEASE_MAX }));
    setPicked(r.next);
  };

  // 팔기 — 고른 선수와 판매가(기준가의 %).
  const [selling, setSelling] = useState<TeamPlayer | null>(null);
  const [pct, setPct] = useState(100);
  // T-11-373 강화한 카드는 기준가에 강화 가치를 더한 값으로 가격 범위를 잰다(서버와 같은 규칙).
  const sellValue = selling?.cardValue ? tradeValue(selling.cardValue, selling.enhance) : 0;
  const sellPrice =
    sellValue && me ? priceAtPct(selling!.cardValue!, pct, me.rules, selling!.enhance) : 0;
  const quote =
    sellValue && me ? sellQuote(selling!.cardValue!, sellPrice, me.rules, selling!.enhance) : null;
  // T-11-442 카드를 고르면 아래 가격 칸이 화면 밖일 수 있어, 다 보이지 않으면 그 칸이 위에 오게 내린다.
  const priceBox = useRef<View>(null);
  const [sellPick, setSellPick] = useState(0);
  useEffect(() => {
    if (!sellPick) return;
    const t = setTimeout(
      () =>
        measureShown(priceBox.current, (share) => {
          if (share < 0.99) scrollToView(priceBox.current, prefs.motionOK);
        }),
      50,
    );
    return () => clearTimeout(t);
  }, [sellPick]);

  // 시트: 영입 · 방출 확인.
  const [buying, setBuying] = useState<MarketListing | null>(null);
  const [confirmRelease, setConfirmRelease] = useState(false);
  // 라운지 공유 카드에서 왔으면 그 선수의 구매창부터 연다.
  useEffect(() => {
    const id = takeMarketListing();
    if (!id) return;
    void fetchListing(id).then((r) => {
      if (r.ok) setBuying(r.data.listing);
      else toast(LC.shareListingGone);
    });
  }, []);

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
  // T-11-111 당겨서 새로고침 — 보이는 탭의 데이터만 조용히 다시 받는다(목록을 비우지 않는다). 사고파는 중에는 건너뛴다.
  useOnPull(() => (busy ? undefined : refresh(true)));
  function run<T>(send: () => Promise<MarketMutationResult<T>>, done: string): Promise<boolean> {
    return runMarketMutation(send, done, {
      sent: buying,
      setBusy,
      setError,
      settleStale,
      clearAfterSuccess: () => {
        closeSheets();
        setPicked(new Set());
        setSelling(null);
      },
      notify: toast,
      refresh,
    });
  }

  // 지금 열린 영입 시트(그 사이 닫았거나 다른 매물을 열었는지 보려고 ref로도 둔다).
  const buyingRef = useRef(buying);
  buyingRef.current = buying;
  async function settleStale(
    sent: MarketListing | null,
    e: { message: string; reason?: string | undefined },
  ) {
    const fresh = await loadList(0);
    // 시트 밖(내 거래 탭의 판매 내리기)이면 오류만 보인다. 그 사이 시트를 닫았거나 다른 매물을 열었으면 시트는 건드리지 않는다.
    if (!sent) return setError(e.message);
    if (buyingRef.current?.id !== sent.id) return;
    const next = staleListingNext(sent, e.reason, fresh);
    if ('listing' in next) {
      setBuying(next.listing);
      setError(next.notice);
    } else {
      closeSheets();
      toast(next.toast);
    }
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
      <Txt style={{ fontSize: rem(FONT.caption), fontWeight: '600', color: c.accentText }}>
        {L.playerUnlock}
      </Txt>
    </Press>
  );

  // T-11-442 로그인 전 기기 — 팔기 · 내 거래 · 방출은 오류 대신 이 탭에서 할 수 있는 일과 로그인 버튼을 보인다.
  const guestPane = (v: MarketView) => (
    <View testID={`market-guest-${v}`} style={{ gap: 10 }}>
      <Txt style={small}>{marketGuestText(v)}</Txt>
      <LoginButtons back={{ market: true }} onDone={() => void loadMe()} />
    </View>
  );

  const errText = error ? (
    <Txt tone="bad" accessibilityRole="alert" style={{ fontWeight: '600' }}>
      {error}
    </Txt>
  ) : null;
  const range = me ? sellSlider(me.rules, selling?.cardValue ?? 0, selling?.enhance) : null;
  const sellDiff = sellValue ? priceDiff(sellPrice, sellValue) : null;
  const buyDiff = buying
    ? priceDiff(buying.price, tradeValue(buying.card.cardValue, buying.card.enhance))
    : null;
  const ownBuying = !!buying && !!me && myListingIds.has(buying.id);
  const buyBlocked = buying && me && !ownBuying ? buyBlock(buying.price, me.balance) : null;
  const box = {
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: RADIUS.md,
    backgroundColor: c.surface,
  } as const;
  const glass = { borderRadius: RADIUS.md, backgroundColor: 'rgba(255,255,255,0.08)' } as const;

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
                        fontSize: rem(FONT.title1),
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
          </>
        }
      >
        <Topbar />

        {/* 초록 머리 — 구단 자금 · 자금 만들기 · 요약 셋 */}
        <View
          testID="market-funds"
          style={{ gap: 12, padding: 16, borderRadius: RADIUS.lg, backgroundColor: c.pitch }}
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
              borderRadius: RADIUS.md,
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
                borderRadius: RADIUS.pill,
                backgroundColor: c.pitchAccent,
                justifyContent: 'center',
              }}
            >
              <Txt style={{ fontSize: rem(FONT.label), fontWeight: '700', color: c.accentInk }}>
                {L.makeFunds}
              </Txt>
            </Press>
          </View>
          {me ? (
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[
                [L.statClubValue, fmtValue(me.clubValue)],
                [L.statBuysToday, String(me.boughtToday)],
                [L.statListed, String(me.listings.length)],
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
                  <Txt style={{ fontSize: rem(FONT.caption2), color: c.onPitch, opacity: 0.8 }}>
                    {k}
                  </Txt>
                  <Txt
                    style={{
                      fontFamily: DISPLAY[700],
                      fontSize: rem(FONT.title3),
                      color: c.onPitch,
                    }}
                  >
                    {v}
                  </Txt>
                </View>
              ))}
            </View>
          ) : guest ? (
            <Txt
              testID="market-guest-note"
              style={{ fontSize: rem(FONT.label), color: c.onPitch, opacity: 0.85 }}
            >
              {L.guestHero}
            </Txt>
          ) : meFailed ? (
            <Txt style={{ fontSize: rem(FONT.label), color: c.onPitch, opacity: 0.85 }}>
              {meFailed}
            </Txt>
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
              <View style={{ flex: 1, minWidth: 0 }}>
                {team && team.seasons.length > 1 ? (
                  <SelectField
                    compact
                    label={L.seasonGroup}
                    testID="market-season"
                    value={team.season}
                    options={seasonOptions(team.seasons)}
                    onChange={(id) => {
                      setTeamSeason(id);
                      setPicked(new Set());
                    }}
                  />
                ) : null}
              </View>
              {releasable.length > 0 ? (
                <Press
                  testID="market-pick-all"
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => setPicked(pickAllIds(releasable, picked))}
                >
                  <Txt style={{ ...small, fontWeight: '600', color: c.accentText }}>
                    {pickAllLabel(releasable.length, allPicked)}
                  </Txt>
                </Press>
              ) : null}
            </View>
            {guest ? (
              guestPane('release')
            ) : !team ? (
              teamFailed ? (
                <Txt tone="muted" style={small}>
                  {L.playersFailed}
                </Txt>
              ) : (
                <Skeleton rows={4} />
              )
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
                      borderRadius: RADIUS.md,
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
                      on={filter.pos === p}
                      label={p ? POS[p].label : L.posAll}
                      testID={`market-pos-${p ?? 'all'}`}
                      onPress={() => pickFilter({ pos: p })}
                    />
                  ))}
                </View>
                <FindRow filter={filter} onOpen={() => setFinding(true)} onPick={pickFilter} />
                {filter.pos ? <SubFilters filter={filter} onPick={pickFilter} /> : null}
                {season !== null && season > 0 ? (
                  <SelectField
                    compact
                    label={L.seasonGroup}
                    testID="market-card-season"
                    value={filter.cardSeason ?? ALL_SEASONS}
                    options={[
                      { value: ALL_SEASONS, label: L.seasonAll },
                      ...seasonOptions(marketSeasonChoices(season)),
                    ]}
                    onChange={(v) => pickFilter({ cardSeason: v === ALL_SEASONS ? undefined : v })}
                  />
                ) : null}
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
                    {season === null ? '' : L.listCount({ n: items.length, more: hasMore })}
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
                  <Skeleton rows={5} />
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
                        const diff = priceDiff(
                          l.price,
                          tradeValue(l.card.cardValue, l.card.enhance),
                        );
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
                              flexWrap: 'wrap',
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
                                    style={{ fontSize: rem(FONT.caption2), fontWeight: '700' }}
                                  >
                                    {`  ${L.myListing}`}
                                  </Txt>
                                ) : null}
                              </Txt>
                              <Txt tone="muted" style={tiny}>
                                <StyleTag card={l.card} />
                                {cardMeta(l.card, season)}
                              </Txt>
                              <Txt
                                tone="muted"
                                style={tiny}
                                numberOfLines={1}
                                testID="market-listing-from"
                              >
                                {cardFrom(l.card)}
                              </Txt>
                            </View>
                            <View style={{ alignItems: 'flex-end', gap: 2 }}>
                              <Txt
                                num
                                style={{ fontFamily: DISPLAY[700], fontSize: rem(FONT.title2) }}
                              >
                                {fmtValue(l.price)}
                              </Txt>
                              <Txt
                                style={{
                                  fontSize: rem(FONT.caption2),
                                  fontWeight: '600',
                                  color: toneColor(c, diff.tone),
                                }}
                              >
                                {diff.text}
                              </Txt>
                            </View>
                            {myListingIds.has(l.id) ? (
                              <Press
                                testID="listing-lounge-share"
                                accessibilityRole="button"
                                accessibilityLabel={LC.sharePlayerAria({
                                  name: marketName(l.card, local),
                                })}
                                hitSlop={8}
                                onPress={() =>
                                  void shareToLounge({ kind: 'player', careerId: l.card.careerId })
                                }
                                style={{
                                  width: 36,
                                  height: 36,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <ShareIcon color={c.muted} />
                              </Press>
                            ) : null}
                            <AttrStrip card={l.card} />
                          </Press>
                        );
                      })
                    ) : (
                      <Txt tone="muted" style={small}>
                        {marketEmptyText(season, marketFiltered(filter))}
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
                  {L.sellStep1}
                </Txt>
                {guest ? (
                  guestPane('sell')
                ) : !team ? (
                  teamFailed ? (
                    <Txt tone="muted" style={small}>
                      {L.playersFailed}
                    </Txt>
                  ) : (
                    <Skeleton rows={4} />
                  )
                ) : !isCurrent || team.players.length === 0 ? (
                  <Txt tone="muted" style={small}>
                    {L.sellNone}
                  </Txt>
                ) : (
                  <>
                    {forSale.length < team.players.length && (
                      <Txt tone="muted" style={small} testID="market-sell-starters">
                        {L.sellStartersHidden}
                      </Txt>
                    )}
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {forSale.map((p) => {
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
                                setSellPick((n) => n + 1);
                              }}
                              style={{
                                minHeight: 104,
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 3,
                                paddingVertical: 6,
                                paddingHorizontal: 4,
                                borderRadius: RADIUS.md,
                                borderWidth: on ? 2 : 1,
                                borderColor: on ? c.accent : c.line,
                                backgroundColor: on ? c.surface2 : c.surface,
                              }}
                            >
                              <MiniCard c={p} name={nameOfPlayer(p)} dim={off} />
                              <Txt numberOfLines={1} style={{ fontSize: rem(FONT.caption2) }}>
                                {nameOfPlayer(p)}
                              </Txt>
                              <Txt
                                style={{
                                  fontSize: rem(FONT.caption2),
                                  fontWeight: '600',
                                  color: on ? c.accentText : c.muted,
                                }}
                              >
                                {on ? L.sellSelected : sellNote(p)}
                              </Txt>
                            </Press>
                            {p.locked ? unlockBtn(p) : null}
                          </View>
                        );
                      })}
                    </View>
                  </>
                )}
                {selling && quote && me ? (
                  <View
                    ref={priceBox}
                    collapsable={false}
                    testID="market-price-box"
                    style={{ ...box, borderRadius: RADIUS.lg, gap: 12, padding: 14 }}
                  >
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
                          [L.presetBase, fmtValue(sellValue), pct === 100, () => setPct(100)],
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
                            borderRadius: RADIUS.md,
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
                        <Txt style={{ fontSize: rem(FONT.label) }}>{L.price}</Txt>
                        <Txt num style={{ fontFamily: DISPLAY[700], fontSize: rem(FONT.title2) }}>
                          {`${fmtValue(sellPrice)} `}
                          <Txt
                            style={{
                              fontSize: rem(FONT.caption2),
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
                        valueText={fmtValue(sellPrice)}
                        onChange={setPct}
                      />
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Txt tone="muted" style={{ fontSize: rem(FONT.caption2) }}>
                          {`${fmtValue(quote.band.min)} (${range!.minPct}%)`}
                        </Txt>
                        <Txt tone="muted" style={{ fontSize: rem(FONT.caption2) }}>
                          {`${fmtValue(quote.band.max)} (${range!.maxLabelPct}%)`}
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
                    {selling.enhance ? (
                      <Txt tone="muted" style={small}>
                        {CE.sellNote({
                          lv: selling.enhance,
                          value: fmtValue(enhanceValue(selling.enhance)),
                        })}
                      </Txt>
                    ) : null}
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
                        ).then((ok) => {
                          if (ok) void askPushAfter('sell');
                        })
                      }
                    >
                      {L.listFor({ price: fmtValue(sellPrice) })}
                    </Btn>
                  </View>
                ) : null}
              </View>
            ) : (
              <View testID="market-trades" style={{ gap: 10 }}>
                {guest ? (
                  guestPane('trades')
                ) : !me ? (
                  meFailed ? (
                    <Txt tone="muted" style={small}>
                      {meFailed}
                    </Txt>
                  ) : (
                    <Skeleton rows={4} />
                  )
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
                              <StyleTag card={l.card} />
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

      <MarketSheet
        open={!!buying && (!!me || guest)}
        label={L.sheetBuy}
        onClose={closeSheets}
        foot={
          buying ? (
            !me ? (
              <LoginButtons back={{ market: true }} onDone={() => void loadMe()} />
            ) : ownBuying ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Btn
                  style={{ flex: 1 }}
                  testID="listing-lounge-share"
                  onPress={() =>
                    void shareToLounge({ kind: 'player', careerId: buying.card.careerId })
                  }
                >
                  {LC.sharePlayerAct}
                </Btn>
                <Btn
                  style={{ flex: 1 }}
                  disabled={busy}
                  onPress={() => void run(() => cancelListing(buying.id), MARKET_TOAST.unlisted)}
                >
                  {L.unlist}
                </Btn>
              </View>
            ) : (
              <Btn
                kind="accent"
                testID="market-buy"
                disabled={busy || !!buyBlocked}
                onPress={() =>
                  void run(() => buyListing(buying.id, buying.price), MARKET_TOAST.bought)
                }
              >
                {L.buyFor({ price: fmtValue(buying.price) })}
              </Btn>
            )
          ) : null
        }
      >
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
                    careerId: buying.card.careerId,
                    look: buying.card.look,
                    nation: buying.card.nation,
                    season: buying.card.season,
                    rating: buying.card.peak,
                    number: buying.card.number,
                    legendScore: buying.card.legendScore,
                    attrs: buying.card.attrs,
                    height: buying.card.height,
                    weight: buying.card.weight,
                    foot: buying.card.foot,
                    cardValue: buying.card.cardValue,
                    enhance: buying.card.enhance,
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
                    <Txt style={{ fontSize: rem(FONT.caption2), color: c.onPitch, opacity: 0.8 }}>
                      {k}
                    </Txt>
                    <Txt style={{ fontSize: rem(FONT.label), fontWeight: '600', color: c.onPitch }}>
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
                {ownBuying ? L.ownListing : me ? L.buyTitle : L.loginTitle}
              </Txt>
              <View style={{ gap: 8 }}>
                <Line
                  label={buying.card.enhance ? L.baseLineEnhanced : L.baseLine}
                  value={fmtValue(tradeValue(buying.card.cardValue, buying.card.enhance))}
                />
                <Line
                  big
                  label={L.price}
                  value={fmtValue(buying.price)}
                  extra={
                    <Txt
                      style={{
                        fontSize: rem(FONT.caption2),
                        fontWeight: '600',
                        color: toneColor(c, buyDiff!.tone),
                      }}
                    >
                      {` ${buyDiff!.text}`}
                    </Txt>
                  }
                />
                {me && !ownBuying ? (
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
              {buying.card.enhance ? (
                <Txt tone="muted" style={small}>
                  {CE.sellNote({
                    lv: buying.card.enhance,
                    value: fmtValue(enhanceValue(buying.card.enhance)),
                  })}
                </Txt>
              ) : null}
              <MarketChart card={buying.card} />
              {!me ? (
                <View testID="market-login" style={{ gap: 10 }}>
                  <View
                    style={{ padding: 12, borderRadius: RADIUS.sm, backgroundColor: c.surface2 }}
                  >
                    <Txt style={small}>{L.loginToBuy}</Txt>
                  </View>
                </View>
              ) : (
                <>
                  {ownBuying ? null : (
                    <View
                      style={{ padding: 12, borderRadius: RADIUS.sm, backgroundColor: c.surface2 }}
                    >
                      <Txt tone="muted" style={tiny}>
                        {L.buyNote}
                      </Txt>
                    </View>
                  )}
                  {buyBlocked ? (
                    <Txt tone="bad" style={{ fontWeight: '600' }}>
                      {buyBlocked}
                    </Txt>
                  ) : null}
                  {errText}
                </>
              )}
            </View>
          </>
        ) : null}
      </MarketSheet>

      <MarketFind
        open={finding}
        filter={filter}
        onPick={pickFilter}
        onClose={() => setFinding(false)}
      />

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
          {enhanceLossNote(pickedPlayers) ? (
            <Txt v="sm">{enhanceLossNote(pickedPlayers)}</Txt>
          ) : null}
          {errText}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Btn style={{ flex: 1 }} onPress={closeSheets}>
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
