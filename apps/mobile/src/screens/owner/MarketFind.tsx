// T-11-500 이적시장 '국적 · 팀으로 찾기' 시트(시안 A, 웹 ui/MarketFind.svelte와 같은 모양). 열 때 고를 거리(매물이 있는
// 국적 · 리그 · 클럽과 수)를 한 번 받고(1분 메모), 검색창은 받은 목록을 기기 안에서만 좁힌다. 고르면 바로 목록에 걸고 닫는다.
import { FONT, RADIUS } from '@offside/app-core/design-tokens';
import { useEffect, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSnapshot } from 'valtio';
import { fetchMarketFacets, type MarketFacetsResponse } from '@offside/app-core/api/market';
import {
  clubName,
  findClubs,
  findLeagueOf,
  findLeagues,
  findNations,
  leagueName,
  nationName,
  type FindItem,
  type MarketFilter,
} from '@offside/app-core/market';
import { marketText as L } from '@offside/app-core/i18n/ko/market';
import { intlLocale } from '@offside/app-core/i18n/core';
import { prefs } from '../../store';
import { useColors } from '../../theme/useColors';
import { DISPLAY, rem } from '../../theme/type';
import { Btn, Press, Txt } from '../../ui';
import { ClubMark } from '../../ui/ClubBadge';
import { Skeleton } from '../../ui/Skeleton';

const fmt = (n: number) => n.toLocaleString(intlLocale());

export function MarketFind({
  open,
  filter,
  onPick,
  onClose,
}: {
  open: boolean;
  filter: MarketFilter;
  onPick: (next: MarketFilter) => void;
  onClose: () => void;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { motionOK } = useSnapshot(prefs);
  const [tab, setTab] = useState<'nation' | 'team'>('nation');
  const [query, setQuery] = useState('');
  const [league, setLeague] = useState<string | undefined>(undefined);
  const [facets, setFacets] = useState<MarketFacetsResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const load = async () => {
    setFailed(false);
    const r = await fetchMarketFacets();
    if (r.ok) setFacets(r.data);
    else setFailed(true);
  };
  // 열 때마다 처음 탭 · 검색어로 돌리고 고를 거리를 받는다(메모가 있으면 다시 부르지 않는다). 열릴 때 한 번만 본다.
  useEffect(() => {
    if (!open) return;
    setTab(filter.league || filter.club ? 'team' : 'nation');
    setQuery('');
    setLeague(undefined);
    void load();
  }, [open]);

  const pick = (next: MarketFilter) => {
    onPick(next);
    onClose();
  };
  const openLeague = league ?? findLeagueOf(filter, facets);
  const nations = facets ? findNations(facets, query) : [];
  const leagues = facets ? findLeagues(facets, tab === 'team' ? query : '') : [];
  const clubs = facets ? findClubs(facets, openLeague, query) : [];
  const leagueN = facets?.leagues.find((l) => l.id === openLeague)?.n ?? 0;
  const small = { fontSize: rem(FONT.caption) };

  const option = (
    x: FindItem,
    on: boolean,
    testID: string,
    onPress: () => void,
    lead?: ReactNode,
    strong = false,
  ) => (
    <Press
      key={testID}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: 48,
        paddingHorizontal: 4,
        borderBottomWidth: 1,
        borderBottomColor: c.line,
      }}
    >
      {lead}
      <Txt
        numberOfLines={1}
        style={{
          flexShrink: 1,
          color: on || strong ? c.accentText : c.ink,
          fontWeight: on || strong ? '700' : '400',
        }}
      >
        {x.name}
      </Txt>
      <Txt
        num
        accessibilityLabel={L.findCount({ n: x.n })}
        style={{
          marginLeft: 'auto',
          fontFamily: DISPLAY[600],
          fontSize: rem(FONT.label),
          color: on || strong ? c.accentText : c.muted,
        }}
      >
        {fmt(x.n)}
      </Txt>
    </Press>
  );
  const caption = (text: string, clear?: { label: string; testID: string; next: MarketFilter }) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Txt tone="muted" style={small}>
        {text}
      </Txt>
      {clear ? (
        <Press
          testID={clear.testID}
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => pick(clear.next)}
        >
          <Txt tone="accent" style={small}>
            {clear.label}
          </Txt>
        </Press>
      ) : null}
    </View>
  );
  const tabBtn = (t: 'nation' | 'team', label: string) => (
    <Press
      testID={`market-find-tab-${t}`}
      accessibilityRole="tab"
      accessibilityState={{ selected: tab === t }}
      onPress={() => {
        setTab(t);
        setQuery('');
      }}
      style={{
        flex: 1,
        minHeight: 38,
        borderRadius: RADIUS.sm,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 6,
        backgroundColor: tab === t ? c.surface2 : 'transparent',
      }}
    >
      <Txt
        numberOfLines={1}
        tone={tab === t ? 'ink' : 'muted'}
        style={{ fontSize: rem(FONT.label), fontWeight: tab === t ? '700' : '400' }}
      >
        {label}
      </Txt>
    </Press>
  );

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
          accessibilityLabel={L.findClose}
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
          testID="market-find"
          accessibilityViewIsModal
          accessibilityLabel={L.findTitle}
          style={{
            height: '88%',
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            overflow: 'hidden',
            backgroundColor: c.surface,
            paddingTop: 12,
            paddingHorizontal: 16,
            gap: 12,
          }}
        >
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Txt v="h2" accessibilityRole="header">
              {L.findTitle}
            </Txt>
            <Press
              testID="market-find-close"
              accessibilityRole="button"
              accessibilityLabel={L.findClose}
              onPress={onClose}
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M6 6l12 12M18 6 6 18"
                  stroke={c.muted}
                  strokeWidth={2.2}
                  strokeLinecap="round"
                />
              </Svg>
            </Press>
          </View>
          <View
            accessibilityRole="tablist"
            style={{
              flexDirection: 'row',
              gap: 4,
              padding: 4,
              borderRadius: RADIUS.md,
              backgroundColor: c.bg,
            }}
          >
            {tabBtn(
              'nation',
              filter.nation
                ? L.findTabNationOn({ name: nationName(filter.nation) })
                : L.findTabNation,
            )}
            {tabBtn(
              'team',
              filter.club
                ? L.findTabTeamOn({ name: clubName(filter.club) })
                : filter.league
                  ? L.findTabTeamOn({ name: leagueName(filter.league) })
                  : L.findTabTeam,
            )}
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              minHeight: 46,
              paddingHorizontal: 14,
              borderRadius: RADIUS.md,
              borderWidth: 1,
              borderColor: c.line,
              backgroundColor: c.bg,
            }}
          >
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Circle cx={11} cy={11} r={7} stroke={c.muted} strokeWidth={2.2} />
              <Path d="m20 20-3.5-3.5" stroke={c.muted} strokeWidth={2.2} strokeLinecap="round" />
            </Svg>
            <TextInput
              testID="market-find-query"
              value={query}
              onChangeText={setQuery}
              placeholder={tab === 'nation' ? L.findNationSearch : L.findTeamSearch}
              placeholderTextColor={c.muted}
              accessibilityLabel={tab === 'nation' ? L.findNationSearch : L.findTeamSearch}
              autoCorrect={false}
              returnKeyType="search"
              style={{ flex: 1, color: c.ink, fontSize: rem(FONT.body), paddingVertical: 10 }}
            />
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 10, paddingBottom: 16 + insets.bottom }}
          >
            {failed ? (
              <View style={{ gap: 10 }}>
                <Txt tone="muted">{L.findFailed}</Txt>
                <Btn onPress={() => void load()}>{L.reload}</Btn>
              </View>
            ) : !facets ? (
              <Skeleton rows={6} />
            ) : tab === 'nation' ? (
              <>
                {caption(
                  L.findNationCaption({ n: facets.nations.length }),
                  filter.nation
                    ? {
                        label: L.findClearNation,
                        testID: 'market-find-clear-nation',
                        next: { nation: undefined },
                      }
                    : undefined,
                )}
                <View>
                  {nations.length ? (
                    nations.map((x) =>
                      option(
                        x,
                        filter.nation === x.id,
                        `market-find-nation-${x.id}`,
                        () => pick({ nation: x.id }),
                        <View
                          style={{
                            minWidth: 34,
                            paddingVertical: 2,
                            paddingHorizontal: 4,
                            borderRadius: 4,
                            backgroundColor: c.surface2,
                            alignItems: 'center',
                          }}
                        >
                          <Txt
                            tone="muted"
                            style={{ fontSize: rem(FONT.caption2), fontWeight: '700' }}
                          >
                            {x.id.replace('GB-', '')}
                          </Txt>
                        </View>,
                      ),
                    )
                  ) : (
                    <Txt tone="muted" style={{ paddingVertical: 16 }}>
                      {L.findNone}
                    </Txt>
                  )}
                </View>
              </>
            ) : (
              <>
                {caption(
                  L.findLeagueCaption,
                  filter.league || filter.club
                    ? {
                        label: L.findClearTeam,
                        testID: 'market-find-clear-team',
                        next: { league: undefined, club: undefined },
                      }
                    : undefined,
                )}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {leagues.map((x) => {
                    const on = openLeague === x.id;
                    return (
                      <Press
                        key={x.id}
                        testID={`market-find-league-${x.id}`}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                        onPress={() => {
                          setLeague(x.id);
                          setQuery('');
                        }}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                          minHeight: 34,
                          paddingHorizontal: 12,
                          borderRadius: RADIUS.pill,
                          borderWidth: 1,
                          borderColor: on ? c.ink : c.line,
                          backgroundColor: on ? c.ink : c.bg,
                        }}
                      >
                        <Txt
                          style={{
                            fontSize: rem(FONT.label),
                            color: on ? c.surface : c.ink,
                            fontWeight: on ? '600' : '400',
                          }}
                        >
                          {x.name}
                        </Txt>
                        <Txt
                          num
                          style={{
                            fontFamily: DISPLAY[600],
                            fontSize: rem(FONT.label),
                            color: on ? c.surface : c.muted,
                          }}
                        >
                          {fmt(x.n)}
                        </Txt>
                      </Press>
                    );
                  })}
                </View>
                {caption(L.findClubCaption)}
                <View>
                  {!query && openLeague
                    ? option(
                        {
                          id: openLeague,
                          n: leagueN,
                          name: L.findLeagueAll({ name: leagueName(openLeague) }),
                        },
                        filter.league === openLeague,
                        `market-find-league-all-${openLeague}`,
                        () => pick({ league: openLeague }),
                        undefined,
                        true,
                      )
                    : null}
                  {clubs.map((x) =>
                    option(
                      x,
                      filter.club === x.id,
                      `market-find-club-${x.id}`,
                      () => pick({ club: x.id }),
                      <View style={{ width: 22, alignItems: 'center' }}>
                        <ClubMark name={x.name} id={x.id} size={22} />
                      </View>,
                    ),
                  )}
                  {query && !clubs.length ? (
                    <Txt tone="muted" style={{ paddingVertical: 16 }}>
                      {L.findNone}
                    </Txt>
                  ) : null}
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
