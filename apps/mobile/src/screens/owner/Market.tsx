// 이적시장(웹 ui/Market.svelte, T-11-080) — 지금 시즌 은퇴 선수 카드를 구단 자금으로 사고판다. 구단주 화면의 '이적시장'으로 연다.
// 탭 셋: 시장(열린 등록) · 내 선수(내놓기 · 방출) · 내 거래(판매 중 · 최근 거래). 탭을 처음 열 때만 불러온다(미리 받기·폴링 없음).
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSnapshot } from 'valtio';
import type { CareerPos } from '@offside/contracts';
import { DETAIL_LABEL } from '@offside/contracts/owner-team';
import {
  buyListing,
  cancelListing,
  createListing,
  fetchMarket,
  fetchMarketMe,
  releaseCards,
  type MarketListing,
  type MarketMeResponse,
  type MarketSort,
} from '@offside/app-core/api/market';
import {
  fetchOwnerTeam,
  type OwnerTeamResponse,
  type TeamPlayer,
} from '@offside/app-core/api/team';
import {
  MARKET_POS_FILTERS,
  MARKET_SORT_LABEL,
  MARKET_TABS,
  TRADE_LABEL,
  buyBlock,
  fundsText,
  lineupOf,
  marketEmptyText,
  marketName,
  mineState,
  parseEok,
  priceRatio,
  releaseAmount,
  releaseConfirmText,
  sellQuote,
  toEok,
  tradeAmount,
  type MarketTab,
} from '@offside/app-core/market';
import { agoKo, fmtValue } from '@offside/app-core/format';
import { localCareerNames } from '@offside/game/season';
import { POS_LABEL } from '@offside/game/pos-label';
import { appState, prefs } from '../../store';
import { toast } from '../../game/host';
import { useColors } from '../../theme/useColors';
import { DISPLAY, rem } from '../../theme/type';
import { ActionBar, BackBar, Btn, Card, Press, Screen, Topbar, Txt } from '../../ui';
import { Seg, TabOpt } from '../board/parts';

type Sent<T> = Promise<
  { ok: true; data: T } | { ok: false; error: { message: string; reason?: string | undefined } }
>;

const SORT_KEYS = Object.keys(MARKET_SORT_LABEL) as MarketSort[];

const posOf = (cd: { dpos: keyof typeof DETAIL_LABEL | null; pos: CareerPos }) =>
  cd.dpos ? DETAIL_LABEL[cd.dpos] : POS_LABEL[cd.pos];

/** 선수 OVR 네모(웹 .mk-ovr). */
function Ovr({ value }: { value: number }) {
  const c = useColors();
  return (
    <View
      style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: c.pitch,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Txt style={{ fontFamily: DISPLAY[700], fontSize: rem(1.125), color: c.pitchAccent }}>
        {value}
      </Txt>
    </View>
  );
}

/** 한 줄의 틀(웹 .mk-row) — 위 구분선 + 가로 배치. */
function RowFrame({ children, testID }: { children: ReactNode; testID?: string }) {
  const c = useColors();
  return (
    <View
      testID={testID}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: c.line,
      }}
    >
      {children}
    </View>
  );
}

/** 값 칸(웹 .mk-funds dl div · .mk-quote div). */
function Cell({
  label,
  value,
  big,
  full,
}: {
  label: string;
  value: string;
  big?: boolean;
  full?: boolean;
}) {
  const c = useColors();
  return (
    <View
      accessible
      accessibilityLabel={`${label} ${value}`}
      style={{
        ...(full ? { width: '100%' } : { flexGrow: 1, flexBasis: '45%' }),
        minWidth: 0,
        gap: 2,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 12,
        backgroundColor: c.surface2,
      }}
    >
      <Txt tone="muted" style={{ fontSize: rem(0.75) }}>
        {label}
      </Txt>
      <Txt
        tone={big ? 'accent' : 'ink'}
        style={{ fontFamily: DISPLAY[700], fontSize: rem(big ? 1.75 : 1.125) }}
      >
        {value}
      </Txt>
    </View>
  );
}

/** 아래에서 올라오는 시트(웹 .tm-sheet) — 영입 · 내놓기 · 방출 확인이 함께 쓴다. */
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
  const insets = useSafeAreaInsets();
  const { motionOK } = useSnapshot(prefs);
  return (
    <Modal
      visible={open}
      transparent
      animationType={motionOK ? 'slide' : 'none'}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'flex-end' }}
      >
        <Pressable
          accessibilityLabel="닫기"
          onPress={onClose}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.45)',
          }}
        />
        <View
          accessibilityViewIsModal
          accessibilityLabel={label}
          style={{
            maxHeight: '78%',
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            backgroundColor: c.surface,
          }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              gap: 8,
              paddingTop: 16,
              paddingHorizontal: 16,
              paddingBottom: 12 + insets.bottom,
            }}
          >
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function SheetHead({
  eyebrow,
  title,
  onClose,
}: {
  eyebrow?: string;
  title: string;
  onClose: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 12,
      }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        {eyebrow ? <Txt v="eyebrow">{eyebrow}</Txt> : null}
        <Txt v="h2" accessibilityRole="header">
          {title}
        </Txt>
      </View>
      <Btn sm onPress={onClose} testID="market-sheet-close">
        닫기
      </Btn>
    </View>
  );
}

/** 방출할 선수 고르기 칸(웹 input.mk-check). */
function Check({
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
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: on }}
      hitSlop={12}
      onPress={onPress}
      style={{
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: on ? c.accent : c.line,
        backgroundColor: on ? c.accent : c.surface,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {on ? (
        <Txt style={{ color: c.accentInk, fontSize: rem(0.75), fontWeight: '700' }}>✓</Txt>
      ) : null}
    </Press>
  );
}

const small = { fontSize: rem(0.875) } as const;

export default function Market() {
  const c = useColors();
  const local = useMemo(() => localCareerNames(), []);
  const [tab, setTab] = useState<MarketTab>('market');
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

  // 시장 목록 — 정렬·포지션이 바뀌면 첫 페이지부터.
  const [sort, setSort] = useState<MarketSort>('new');
  const [pos, setPos] = useState<CareerPos | undefined>(undefined);
  const [items, setItems] = useState<MarketListing[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [season, setSeason] = useState<number | null>(null);
  const [listStatus, setListStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const listReq = useRef(0);
  // 정렬을 빠르게 바꿀 때 늦게 온 이전 응답이 덮어쓰지 않게 요청 번호를 둔다.
  const loadList = useCallback(
    async (next = 0) => {
      const req = ++listReq.current;
      if (next === 0) setListStatus('loading');
      const r = await fetchMarket(sort, pos, next);
      if (req !== listReq.current) return;
      if (!r.ok) return setListStatus('error');
      setItems((prev) => (next === 0 ? r.data.items : [...prev, ...r.data.items]));
      setPage(next);
      setHasMore(r.data.hasMore);
      setSeason(r.data.season);
      setListStatus('ok');
    },
    [sort, pos],
  );
  useEffect(() => {
    if (tab === 'market') void loadList(0);
  }, [tab, loadList]);
  const myListingIds = useMemo(() => new Set(me?.listings.map((l) => l.id) ?? []), [me]);

  // 내 선수 — 시즌을 골라 본다(기본은 지금 시즌).
  const [team, setTeam] = useState<OwnerTeamResponse | null>(null);
  const [teamSeason, setTeamSeason] = useState<number | undefined>(undefined);
  const [teamFailed, setTeamFailed] = useState(false);
  const loadTeam = useCallback(async () => {
    const r = await fetchOwnerTeam(teamSeason);
    if (r.ok) {
      setTeam(r.data);
      setTeamFailed(false);
    } else setTeamFailed(true);
  }, [teamSeason]);
  useEffect(() => {
    if (tab === 'mine') void loadTeam();
  }, [tab, loadTeam]);
  const lineup = useMemo(() => (team ? lineupOf(team) : new Set<string>()), [team]);
  const isCurrent = !!team && team.season === team.current;
  const nameOfPlayer = (p: TeamPlayer) => marketName(p, local);

  // 일괄 방출 — 고른 선수.
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const pickedPlayers = team?.players.filter((p) => picked.has(p.careerId)) ?? [];
  const pickedAmount = me ? releaseAmount(pickedPlayers, me.rules.releaseRate) : 0;
  const togglePick = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  // 시트: 영입 · 내놓기 · 방출 확인.
  const [buying, setBuying] = useState<MarketListing | null>(null);
  const [selling, setSelling] = useState<TeamPlayer | null>(null);
  const [sellInput, setSellInput] = useState('');
  const [confirmRelease, setConfirmRelease] = useState(false);
  const sellPrice = parseEok(sellInput);
  const quote = selling?.cardValue && me ? sellQuote(selling.cardValue, sellPrice, me.rules) : null;

  const closeSheets = () => {
    setBuying(null);
    setSelling(null);
    setConfirmRelease(false);
    setError(null);
  };
  const refresh = async () => {
    await Promise.all([
      loadMe(),
      tab === 'market' ? loadList(0) : tab === 'mine' ? loadTeam() : null,
    ]);
  };
  async function run<T>(send: () => Sent<T>, done: string) {
    setBusy(true);
    setError(null);
    const r = await send();
    setBusy(false);
    if (!r.ok) {
      setError(r.error.message);
      // 이미 팔렸거나 가격이 바뀌었으면 목록을 새로 받는다.
      if (r.error.reason === 'LISTING_GONE' || r.error.reason === 'PRICE_CHANGED') void loadList(0);
      return;
    }
    closeSheets();
    setPicked(new Set());
    toast(done);
    await refresh();
  }

  const errText = error ? (
    <Txt tone="bad" accessibilityRole="alert" style={{ fontWeight: '600' }}>
      {error}
    </Txt>
  ) : null;
  const buyBlocked =
    buying && me
      ? myListingIds.has(buying.id)
        ? '내가 내놓은 선수예요.'
        : buyBlock(buying.price, me.balance, me.buysLeft)
      : null;

  return (
    <>
      <Screen
        footer={
          <>
            {tab === 'mine' && picked.size > 0 ? (
              <ActionBar row>
                <View style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>
                  <Txt style={small}>
                    <Txt bold style={small}>{`${picked.size}명`}</Txt>
                    {` 고름 · 받을 자금 ${fmtValue(pickedAmount)}`}
                  </Txt>
                </View>
                <Btn
                  kind="accent"
                  testID="market-release"
                  onPress={() => {
                    setConfirmRelease(true);
                    setError(null);
                  }}
                >
                  방출
                </Btn>
              </ActionBar>
            ) : null}
            <BackBar testID="market-back" fallback={() => (appState.screen = 'owner')} />
          </>
        }
      >
        <Topbar />
        <View style={{ paddingHorizontal: 2, paddingTop: 4 }}>
          <Txt v="eyebrow">Transfer market</Txt>
          <Txt v="h1" accessibilityRole="header" style={{ marginTop: 2 }}>
            이적시장
          </Txt>
        </View>

        <Card gap={8} testID="market-funds">
          {me ? (
            <>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Cell full big label="구단 자금" value={fundsText(me.balance)} />
                <Cell label="구단 가치" value={fmtValue(me.clubValue)} />
                <Cell label="오늘 남은 영입" value={`${me.buysLeft}/${me.rules.dailyBuys}`} />
              </View>
              <Txt tone="muted" style={small}>
                {`직접 키운 선수를 방출하면 자금이 생겨요. 판매 대금의 ${Math.round(me.rules.feeRate * 100)}%는 수수료로 빠져요.`}
              </Txt>
            </>
          ) : (
            <Txt tone="muted" style={small}>
              {meFailed ?? '불러오는 중…'}
            </Txt>
          )}
        </Card>

        <Seg cols={3} label="이적시장">
          {MARKET_TABS.map(([k, label]) => (
            <TabOpt
              key={k}
              title={label}
              selected={tab === k}
              testID={`market-tab-${k}`}
              onPress={() => setTab(k)}
            />
          ))}
        </Seg>

        {tab === 'market' ? (
          <Card gap={0} testID="market-list">
            <View style={{ gap: 8, marginBottom: 8 }}>
              <Seg cols={5} label="포지션">
                {MARKET_POS_FILTERS.map((p) => (
                  <TabOpt
                    key={p ?? 'all'}
                    fit
                    title={p ? POS_LABEL[p] : '전체'}
                    selected={pos === p}
                    testID={`market-pos-${p ?? 'all'}`}
                    onPress={() => setPos(p)}
                  />
                ))}
              </Seg>
              <Seg cols={2} label="정렬">
                {SORT_KEYS.map((k) => (
                  <TabOpt
                    key={k}
                    title={MARKET_SORT_LABEL[k]}
                    selected={sort === k}
                    testID={`market-sort-${k}`}
                    onPress={() => setSort(k)}
                  />
                ))}
              </Seg>
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
                  items.map((l) => (
                    <Press
                      key={l.id}
                      scale={0.985}
                      testID={`market-listing-${l.id}`}
                      accessibilityLabel={`${marketName(l.card, local)} 영입 보기`}
                      onPress={() => {
                        setBuying(l);
                        setError(null);
                      }}
                    >
                      <RowFrame>
                        <Ovr value={l.card.peak} />
                        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                          <Txt>
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
                          <Txt tone="muted" style={{ fontSize: rem(0.75) }}>
                            {`${posOf(l.card)} · 기준가 ${fmtValue(l.card.cardValue)}${l.card.transfers ? ` · 이적 ${l.card.transfers}회` : ''}`}
                          </Txt>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 2 }}>
                          <Txt bold num>
                            {fmtValue(l.price)}
                          </Txt>
                          <Txt tone="muted" style={{ fontSize: rem(0.75) }}>
                            {`기준가 ${priceRatio(l.price, l.card.cardValue)}%`}
                          </Txt>
                        </View>
                      </RowFrame>
                    </Press>
                  ))
                ) : (
                  <Txt tone="muted" style={small}>
                    {marketEmptyText(season, !!pos)}
                  </Txt>
                )}
                {hasMore ? (
                  <Btn block style={{ marginTop: 8 }} onPress={() => void loadList(page + 1)}>
                    더 보기
                  </Btn>
                ) : null}
              </>
            )}
          </Card>
        ) : tab === 'mine' ? (
          <Card gap={0} testID="market-mine">
            {team && team.seasons.length > 1 ? (
              <Seg cols={Math.min(team.seasons.length, 3)} label="시즌" style={{ marginBottom: 8 }}>
                {team.seasons.map((o) => (
                  <TabOpt
                    key={o.id}
                    title={o.name}
                    selected={team.season === o.id}
                    testID={`market-season-${o.id}`}
                    onPress={() => {
                      setTeamSeason(o.id);
                      setPicked(new Set());
                    }}
                  />
                ))}
              </Seg>
            ) : null}
            {!team ? (
              <Txt tone="muted" style={small}>
                {teamFailed ? '내 선수를 불러오지 못했어요.' : '불러오는 중…'}
              </Txt>
            ) : (
              <>
                <Txt tone="muted" style={{ ...small, marginBottom: 4 }}>
                  {isCurrent
                    ? '이번 시즌 선수는 시장에 내놓을 수 있어요. 직접 키운 선수는 방출해 자금으로 바꿀 수 있어요.'
                    : '지난 시즌 선수는 시장에 내놓을 수 없어요. 직접 키운 선수는 방출해 자금으로 바꿀 수 있어요.'}
                </Txt>
                {team.players.length ? (
                  team.players.map((p) => {
                    const st = mineState(p, lineup, isCurrent);
                    return (
                      <RowFrame key={p.careerId} testID={`market-mine-${p.careerId}`}>
                        {st.releasable ? (
                          <Check
                            on={picked.has(p.careerId)}
                            label={`${nameOfPlayer(p)} 방출할 선수로 고르기`}
                            testID={`market-pick-${p.careerId}`}
                            onPress={() => togglePick(p.careerId)}
                          />
                        ) : (
                          <View style={{ width: 22, height: 22 }} />
                        )}
                        <Ovr value={p.peak} />
                        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                          <Txt bold>{nameOfPlayer(p)}</Txt>
                          <Txt tone="muted" style={{ fontSize: rem(0.75) }}>
                            {`${posOf(p)}${p.cardValue ? ` · 기준가 ${fmtValue(p.cardValue)}` : ''}${p.raised ? '' : ' · 영입'}${st.starter ? ' · 선발' : ''}${p.listing ? ` · ${fmtValue(p.listing.price)}에 판매 중` : ''}`}
                          </Txt>
                        </View>
                        {p.listing ? (
                          <Btn
                            sm
                            disabled={busy}
                            testID={`market-cancel-${p.careerId}`}
                            onPress={() =>
                              void run(() => cancelListing(p.listing!.id), '판매를 내렸어요.')
                            }
                          >
                            내리기
                          </Btn>
                        ) : st.listable ? (
                          <Btn
                            sm
                            testID={`market-sell-${p.careerId}`}
                            onPress={() => {
                              setSelling(p);
                              setSellInput(toEok(p.cardValue!));
                              setError(null);
                            }}
                          >
                            내놓기
                          </Btn>
                        ) : null}
                      </RowFrame>
                    );
                  })
                ) : (
                  <Txt tone="muted" style={small}>
                    이 시즌에 은퇴한 내 선수가 없어요.
                  </Txt>
                )}
              </>
            )}
          </Card>
        ) : (
          <Card gap={0} testID="market-trades">
            {!me ? (
              <Txt tone="muted" style={small}>
                {meFailed ?? '불러오는 중…'}
              </Txt>
            ) : (
              <>
                <Txt v="h2" accessibilityRole="header" style={{ marginBottom: 4 }}>
                  {`판매 중 ${me.listings.length}/${me.rules.listLimit}`}
                </Txt>
                {me.listings.length ? (
                  me.listings.map((l) => (
                    <RowFrame key={l.id}>
                      <Ovr value={l.card.peak} />
                      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                        <Txt bold>{marketName(l.card, local)}</Txt>
                        <Txt tone="muted" style={{ fontSize: rem(0.75) }}>
                          {`${posOf(l.card)} · ${agoKo(Date.now() - Date.parse(l.createdAt))} 등록`}
                        </Txt>
                      </View>
                      <Txt bold num>
                        {fmtValue(l.price)}
                      </Txt>
                      <Btn
                        sm
                        disabled={busy}
                        testID={`market-unlist-${l.id}`}
                        onPress={() => void run(() => cancelListing(l.id), '판매를 내렸어요.')}
                      >
                        내리기
                      </Btn>
                    </RowFrame>
                  ))
                ) : (
                  <Txt tone="muted" style={small}>
                    판매 중인 선수가 없어요.
                  </Txt>
                )}
                <Txt v="h2" accessibilityRole="header" style={{ marginTop: 12, marginBottom: 4 }}>
                  최근 거래
                </Txt>
                {me.trades.length ? (
                  me.trades.map((t) => (
                    <RowFrame key={t.id} testID={`market-trade-${t.kind}`}>
                      <View style={{ width: 40, alignItems: 'center' }}>
                        <Txt
                          tone={t.kind === 'bought' ? 'bad' : 'good'}
                          style={{ fontSize: rem(0.8125), fontWeight: '700' }}
                        >
                          {TRADE_LABEL[t.kind]}
                        </Txt>
                      </View>
                      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                        <Txt bold>{marketName(t.card, local)}</Txt>
                        <Txt tone="muted" style={{ fontSize: rem(0.75) }}>
                          {`${POS_LABEL[t.card.pos]} · 최고 ${t.card.peak} · ${agoKo(Date.now() - Date.parse(t.at))}`}
                        </Txt>
                      </View>
                      <Txt tone={t.kind === 'bought' ? 'bad' : 'good'} bold num>
                        {tradeAmount(t)}
                      </Txt>
                    </RowFrame>
                  ))
                ) : (
                  <Txt tone="muted" style={small}>
                    아직 거래가 없어요.
                  </Txt>
                )}
              </>
            )}
          </Card>
        )}
      </Screen>

      <MarketSheet open={!!buying && !!me} label="선수 영입" onClose={closeSheets}>
        {buying && me ? (
          <>
            <SheetHead
              eyebrow={`${posOf(buying.card)} · 최고 OVR ${buying.card.peak}`}
              title={marketName(buying.card, local)}
              onClose={closeSheets}
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 4 }}>
              <Cell label="판매가" value={fmtValue(buying.price)} />
              <Cell
                label="기준가"
                value={`${fmtValue(buying.card.cardValue)} (${priceRatio(buying.price, buying.card.cardValue)}%)`}
              />
              <Cell label="레전드 점수" value={String(buying.card.legendScore)} />
              <Cell label="이적" value={`${buying.card.transfers}회`} />
              <Cell
                label="영입 뒤 자금"
                value={
                  me.balance >= buying.price ? fundsText(me.balance - buying.price) : '모자라요'
                }
              />
            </View>
            <Txt tone="muted" style={small}>
              영입한 선수는 바로 팀에 넣을 수 있어요. 다시 팔 수는 있지만 방출할 수는 없어요.
            </Txt>
            {buyBlocked ? (
              <Txt tone="bad" style={{ fontWeight: '600' }}>
                {buyBlocked}
              </Txt>
            ) : null}
            {errText}
            {myListingIds.has(buying.id) ? (
              <Btn
                block
                disabled={busy}
                onPress={() => void run(() => cancelListing(buying.id), '판매를 내렸어요.')}
              >
                판매 내리기
              </Btn>
            ) : (
              <Btn
                block
                kind="primary"
                testID="market-buy"
                disabled={busy || !!buyBlocked}
                onPress={() =>
                  void run(() => buyListing(buying.id, buying.price), '선수를 영입했어요.')
                }
              >
                {`${fmtValue(buying.price)}에 영입하기`}
              </Btn>
            )}
          </>
        ) : null}
      </MarketSheet>

      <MarketSheet open={!!selling && !!me && !!quote} label="선수 내놓기" onClose={closeSheets}>
        {selling && me && quote ? (
          <>
            <SheetHead
              eyebrow={`${posOf(selling)} · 최고 OVR ${selling.peak}`}
              title={nameOfPlayer(selling)}
              onClose={closeSheets}
            />
            <View style={{ gap: 4 }}>
              <Txt style={{ fontWeight: '700' }}>판매가(억)</Txt>
              <TextInput
                testID="market-sell-price"
                accessibilityLabel="판매가(억)"
                value={sellInput}
                onChangeText={setSellInput}
                keyboardType="decimal-pad"
                placeholderTextColor={c.muted}
                style={{
                  borderWidth: 1,
                  borderColor: c.line,
                  backgroundColor: c.surface2,
                  borderRadius: 10,
                  paddingVertical: 11,
                  paddingHorizontal: 12,
                  minHeight: 46,
                  fontSize: 20,
                  color: c.ink,
                }}
              />
            </View>
            <Txt tone="muted" style={small}>
              {`기준가 ${fmtValue(selling.cardValue!)} · ${fmtValue(quote.band.min)}부터 ${fmtValue(quote.band.max)}까지 정할 수 있어요.`}
            </Txt>
            {!Number.isNaN(sellPrice) && !quote.error ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 4 }}>
                <Cell label="수수료" value={fmtValue(quote.fee)} />
                <Cell label="팔리면 받는 돈" value={fmtValue(quote.gets)} />
              </View>
            ) : null}
            {quote.error && sellInput.trim() ? (
              <Txt tone="bad" style={{ fontWeight: '600' }}>
                {quote.error}
              </Txt>
            ) : null}
            {errText}
            <Txt tone="muted" style={small}>
              팔리기 전까지는 팀에서 계속 뛰어요. 팔리면 선발 자리는 유스 선수가 채워요.
            </Txt>
            <Btn
              block
              kind="primary"
              testID="market-list-submit"
              disabled={busy || Number.isNaN(sellPrice) || !!quote.error}
              onPress={() =>
                void run(() => createListing(selling.careerId, sellPrice), '시장에 내놓았어요.')
              }
            >
              시장에 내놓기
            </Btn>
          </>
        ) : null}
      </MarketSheet>

      <MarketSheet open={confirmRelease && !!me} label="선수 방출" onClose={closeSheets}>
        <SheetHead title="선수 방출" onClose={closeSheets} />
        <Txt>{releaseConfirmText(picked.size, pickedAmount)}</Txt>
        {errText}
        <Btn
          block
          kind="accent"
          testID="market-release-confirm"
          disabled={busy}
          onPress={() =>
            void run(() => releaseCards([...picked]), `${picked.size}명을 방출했어요.`)
          }
        >
          {`${picked.size}명 방출하기`}
        </Btn>
      </MarketSheet>
    </>
  );
}
