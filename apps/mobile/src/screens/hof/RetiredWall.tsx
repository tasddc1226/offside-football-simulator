// T-10-076 기록실 '영구결번' 탭(웹 RetiredWall.svelte) — 결번을 구단별로 보고, 구단을 고르면 그 구단의 결번 타일을 본다.
// 유니폼은 구단 엠블럼 색(rnStyle), 누르면 그 선수의 은퇴 상세.
// T-11-029 결번은 시즌마다 따로 — 개막한 시즌이 둘 이상이면 시즌 탭을 보인다(웹과 같다).
// T-11-101 열 때는 요약(구단별 수 + 최근 8개)만 받는다. 타일은 구단을 고르거나 최신순 전체를 열 때 그 몫만 받는다.
import { memo, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Defs, G, RadialGradient, Rect, Stop } from 'react-native-svg';
import { proxy, useSnapshot } from 'valtio';
import type { CareerPos, RetiredNumbersResponse, RetiredNumbersSummary } from '@offside/contracts';
import {
  displaySeasonAt,
  PRESEASON,
  SERVICE_SEASONS,
  seasonById,
  teamSeasonName,
} from '@offside/contracts/service-seasons';
import {
  getRetiredNumbersOfClub,
  getRetiredNumbersPage,
  getRetiredNumbersSummary,
} from '@offside/app-core/api/client';
import { anonName } from '@offside/app-core/format';
import { RN_DEFAULT, rnColors } from '@offside/app-core/rnStyle';
import {
  type RnClubOrder,
  rnByLeague,
  rnClubName as clubName,
  rnDay as day,
  rnLeagueName as leagueOf,
} from '@offside/app-core/retiredWall';
import { POS } from '@offside/game/data';
import { loadHOF } from '@offside/game/season';
import { RnShirtShape } from '../../components/RnJersey';
import { openPublicLegendById } from '../../game/host';
import { alpha } from '../../theme/colors';
import { rem } from '../../theme/type';
import { type Colors } from '../../theme/colors';
import { useColors } from '../../theme/useColors';
import { Btn } from '../../ui/Btn';
import { Card } from '../../ui/Card';
import { ClubMark } from '../../ui/ClubBadge';
import { Press } from '../../ui/Press';
import { Txt } from '../../ui/Txt';
import { POS_GROUPS, POS_LABEL } from '@offside/contracts/positions';
import { kstMonthDayHour } from '@offside/app-core/boardText';
import { RecordsSelect, RecordsChips, RECORDS_TOUCH } from './RecordsControls';
import { useSeasonNow } from '../../ui/useSeasonNow';

type Item = RetiredNumbersResponse['items'][number];
type ClubSum = RetiredNumbersSummary['clubs'][number];

// 화면(첫 화면·구단·최신순 전체)·구단 정렬·시즌 선택은 선수 상세에 다녀와도 그대로 둔다(화면이 다시 그려져도 모듈 값은 남는다).
// season이 null이면 지금 시즌(개막 전이면 프리시즌). 포지션 필터는 구단 화면에서만 쓴다.
const view = proxy<{
  season: number | null;
  screen: 'home' | 'club' | 'recent';
  clubId: string | null;
  clubOrder: RnClubOrder;
  pos: CareerPos | null;
}>({
  season: null,
  screen: 'home',
  clubId: null,
  clubOrder: 'count',
  pos: null,
});

const GAP = 8;
const MIN_TILE = 90;
const SHIRT_W = 52;
const SHIRT_H = (SHIRT_W * 124) / 120;

type TileOpts = {
  c: Colors;
  width: number;
  myIds: ReadonlySet<string>;
  filteredPos: boolean;
};

/** 유니폼 타일 한 장 — 구단 색이 은은히 비치는 바탕(웹 radial-gradient). 바탕과 유니폼을 한 Svg에 그리고, 색·필터 상태는
 * 부모가 넘긴다(수백 장이라 타일마다 Svg를 하나 더 두거나 구독하지 않게). */
const Tile = memo(function Tile({
  it,
  withClub,
  mine,
  c,
  width,
  filteredPos,
}: Omit<TileOpts, 'myIds'> & { it: Item; withClub: boolean; mine: boolean }) {
  const gid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const col = rnColors(it.clubId) ?? RN_DEFAULT;
  const base = col.base;
  const name = it.name ?? anonName(it.pos, it.number);
  return (
    <Press
      scale={0.985}
      testID={`rn-tile-${it.seq}`}
      onPress={() => void openPublicLegendById(it.careerId)}
      accessibilityLabel={`${name} ${it.number}번 · ${withClub ? clubName(it) : POS[it.pos].label}`}
      style={{
        width,
        alignItems: 'center',
        gap: 2,
        paddingTop: 10,
        paddingBottom: 8,
        paddingHorizontal: 4,
        borderWidth: 1,
        borderColor: c.line,
        borderRadius: 14,
        backgroundColor: c.surface,
        overflow: 'hidden',
      }}
    >
      <Svg
        pointerEvents="none"
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
        width="100%"
        height="100%"
      >
        <Defs>
          <RadialGradient id={gid} cx="50%" cy="30%" rx="90%" ry="60%">
            <Stop offset="0" stopColor={base} stopOpacity={0.22} />
            <Stop offset="1" stopColor={base} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${gid})`} />
        {/* 유니폼: 아래 자리(paddingTop 10, 가운데)에 맞춰 120×124 도안을 줄여 그린다. */}
        <G transform={`translate(${(width - SHIRT_W) / 2} 10) scale(${SHIRT_W / 120})`}>
          <RnShirtShape number={it.number} col={col} />
        </G>
      </Svg>
      <View style={{ width: SHIRT_W, height: SHIRT_H, marginBottom: 4 }} />
      <Txt
        bold
        numberOfLines={1}
        style={{ maxWidth: '100%', fontSize: rem(0.875), lineHeight: rem(0.875) * 1.5 }}
      >
        {name}
      </Txt>
      {withClub ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%' }}>
          <ClubMark name={it.club} id={it.clubId} size={14} />
          <Txt tone="muted" numberOfLines={1} style={{ fontSize: rem(0.75), flexShrink: 1 }}>
            {clubName(it)}
          </Txt>
        </View>
      ) : !filteredPos ? (
        <Txt tone="muted" numberOfLines={1} style={{ fontSize: rem(0.75), maxWidth: '100%' }}>
          {POS[it.pos].label}
        </Txt>
      ) : null}
      <Txt
        tone="muted"
        num={400}
        numberOfLines={1}
        style={{ fontSize: rem(0.75), maxWidth: '100%' }}
      >
        {`${it.seq}번째 · ${day(it.grantedAt)}`}
      </Txt>
      {mine ? (
        <View
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            paddingHorizontal: 6,
            borderRadius: 999,
            backgroundColor: c.surface2,
            borderWidth: 1,
            borderColor: c.line,
          }}
        >
          {/* T-11-038 한 줄 고정, 확대 1.2배까지(큰 글씨에서 꺾여 이름을 덮지 않게). */}
          <Txt
            numberOfLines={1}
            maxFontSizeMultiplier={1.2}
            style={{
              fontSize: rem(0.625),
              lineHeight: rem(0.625) * 1.6,
              fontWeight: '600',
              color: c.muted,
            }}
          >
            내 선수
          </Txt>
        </View>
      ) : null}
    </Press>
  );
});

/** 웹 grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)) — 타일 폭은 벽에서 한 번 정한다. */
function Tiles({ items, withClub, ...o }: TileOpts & { items: Item[]; withClub: boolean }) {
  const { myIds, ...rest } = o;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP, paddingBottom: 10 }}>
      {items.map((it) => (
        <Tile key={it.seq} it={it} withClub={withClub} mine={myIds.has(it.careerId)} {...rest} />
      ))}
    </View>
  );
}

/** 타일 폭을 벽에서 한 번 정한다(웹 auto-fill 열 수). 폭을 재기 전(0)에는 타일을 그리지 않는다. */
function useTileOpts(c: Colors, filteredPos: boolean, myIds: ReadonlySet<string>) {
  const [w, setW] = useState(0);
  const cols = Math.max(1, Math.floor((w + GAP) / (MIN_TILE + GAP)));
  // Android의 소수점 너비 반올림으로 마지막 열이 다음 줄로 밀리지 않게 한다.
  const tileW = Math.floor((w - GAP * (cols - 1)) / cols);
  return {
    ready: w > 0,
    onLayout: (e: { nativeEvent: { layout: { width: number } } }) =>
      setW(e.nativeEvent.layout.width),
    opts: { c, width: tileW, myIds, filteredPos } satisfies TileOpts,
  };
}

const Message = ({ text, live }: { text: string; live?: boolean }) => (
  <Txt
    tone="muted"
    accessibilityLiveRegion={live ? 'polite' : undefined}
    style={{ fontSize: rem(0.875), paddingVertical: 8 }}
  >
    {text}
  </Txt>
);

const CountPill = ({ c, count }: { c: Colors; count: number }) => (
  <View
    style={{
      paddingVertical: 1,
      paddingHorizontal: 9,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.accent,
      backgroundColor: alpha(c.accent, 0.16),
    }}
  >
    <Txt num style={{ fontSize: rem(0.8125), lineHeight: rem(0.8125) * 1.5, fontWeight: '700' }}>
      {count}
    </Txt>
  </View>
);

const SectionTitle = ({ children, right }: { children: string; right?: ReactNode }) => (
  <View
    style={{
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 32,
      marginBottom: 6,
    }}
  >
    <Txt bold accessibilityRole="header">
      {children}
    </Txt>
    {right}
  </View>
);

function BackButton() {
  return (
    <Press
      testID="rn-back"
      scale={1}
      accessibilityLabel="구단 목록으로 돌아가기"
      onPress={() => {
        view.screen = 'home';
        view.clubId = null;
        view.pos = null;
      }}
      style={{ minHeight: RECORDS_TOUCH, justifyContent: 'center', alignSelf: 'flex-start' }}
    >
      <Txt tone="muted" style={{ fontSize: rem(0.875) }}>
        ← 구단 목록
      </Txt>
    </Press>
  );
}

function ClubRow({ c, club, showLeague }: { c: Colors; club: ClubSum; showLeague: boolean }) {
  const name = clubName(club);
  const league = leagueOf(club.clubId);
  return (
    <Press
      testID={`rn-club-${club.clubId}`}
      scale={0.985}
      accessibilityLabel={`${name}${league ? ` ${league}` : ''} 영구결번 ${club.count}개`}
      onPress={() => {
        view.clubId = club.clubId;
        view.pos = null;
        view.screen = 'club';
      }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        minHeight: RECORDS_TOUCH,
        paddingVertical: 6,
        minWidth: 0,
        borderTopWidth: 1,
        borderTopColor: c.line,
      }}
    >
      <ClubMark name={club.club} id={club.clubId} size={22} />
      <Txt bold numberOfLines={1} style={{ flexShrink: 1 }}>
        {name}
      </Txt>
      {showLeague && league ? (
        <Txt tone="muted" numberOfLines={1} style={{ fontSize: rem(0.75) }}>
          {league}
        </Txt>
      ) : null}
      <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <CountPill c={c} count={club.count} />
        <Txt accessible={false} tone="muted">
          ›
        </Txt>
      </View>
    </Press>
  );
}

/** 첫 화면 — 요약(구단별 결번 수 + 최근 8개)만 받는다. */
function Home({ season, myIds }: { season: number; myIds: ReadonlySet<string> }) {
  const c = useColors();
  const { clubOrder } = useSnapshot(view);
  const [summary, setSummary] = useState<RetiredNumbersSummary | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setSummary(null);
    setFailed(false);
    let live = true; // 더 늦게 고른 시즌의 응답만 쓴다.
    void getRetiredNumbersSummary(season).then((r) => {
      if (!live) return;
      if (r.ok) setSummary(r.data);
      else setFailed(true);
    });
    return () => {
      live = false;
    };
  }, [season]);
  const { ready, onLayout, opts } = useTileOpts(c, false, myIds);
  const groups = useMemo(() => (summary ? rnByLeague(summary.clubs) : []), [summary]);

  if (failed) return <Message text="영구결번을 불러오지 못했어요. 잠시 후 다시 시도해 주세요." />;
  if (!summary) return <Message live text="불러오는 중…" />;
  if (!summary.total) return <Message text={`아직 ${teamSeasonName(season)} 영구결번이 없어요.`} />;
  return (
    <View onLayout={onLayout}>
      <Txt tone="muted" style={{ fontSize: 12, marginBottom: 10 }}>
        {`${summary.total}개 결번 · ${summary.clubs.length}개 구단 · 최근 ${day(summary.recent[0]!.grantedAt)}`}
      </Txt>
      <SectionTitle
        right={
          <Press
            testID="rn-recent-all"
            scale={1}
            accessibilityLabel="최근 결번 전체 보기"
            onPress={() => {
              view.screen = 'recent';
            }}
            style={{ minHeight: RECORDS_TOUCH, justifyContent: 'center' }}
          >
            <Txt tone="muted" style={{ fontSize: rem(0.8125) }}>
              전체 보기 ›
            </Txt>
          </Press>
        }
      >
        최근 결번
      </SectionTitle>
      {ready ? <Tiles items={summary.recent} withClub {...opts} /> : null}
      <SectionTitle>구단</SectionTitle>
      <RecordsChips
        label="구단 정렬"
        testIDPrefix="rn-club-order"
        value={clubOrder}
        onPick={(key) => {
          view.clubOrder = key as RnClubOrder;
        }}
        items={[
          { key: 'count', label: '결번 많은 순' },
          { key: 'league', label: '리그별' },
        ]}
      />
      {clubOrder === 'count' ? (
        <View>
          {summary.clubs.map((club) => (
            <ClubRow key={club.clubId} c={c} club={club} showLeague />
          ))}
        </View>
      ) : (
        groups.map((g) => (
          <View key={g.league}>
            <Txt tone="muted" style={{ fontSize: rem(0.75), paddingTop: 12, paddingBottom: 4 }}>
              {`${g.league} · ${g.count}`}
            </Txt>
            {g.clubs.map((club) => (
              <ClubRow key={club.clubId} c={c} club={club} showLeague={false} />
            ))}
          </View>
        ))
      )}
    </View>
  );
}

/** 구단 화면 — 그 구단의 결번만 받는다(서버가 번호 순으로). 포지션은 받은 목록에서 거른다. */
function ClubScreen({
  season,
  clubId,
  myIds,
}: {
  season: number;
  clubId: string;
  myIds: ReadonlySet<string>;
}) {
  const c = useColors();
  const { pos } = useSnapshot(view);
  const [items, setItems] = useState<Item[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setItems(null);
    setFailed(false);
    let live = true;
    void getRetiredNumbersOfClub(season, clubId).then((r) => {
      if (!live) return;
      if (r.ok) setItems(r.data.items);
      else setFailed(true);
    });
    return () => {
      live = false;
    };
  }, [season, clubId]);

  const filtered = useMemo(
    () => (items ?? []).filter((it) => !pos || pos === it.pos),
    [items, pos],
  );
  const { ready, onLayout, opts } = useTileOpts(c, !!pos, myIds);
  // 이름·개수는 받은 목록에서(서버가 그 구단 결번을 모두 준다).
  const head = items?.[0] ? { club: items[0].club, count: items.length } : null;

  return (
    <View>
      <BackButton />
      {head ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            marginBottom: 10,
            minWidth: 0,
          }}
        >
          <ClubMark name={head.club} id={clubId} size={28} />
          <Txt bold numberOfLines={1} style={{ flexShrink: 1 }}>
            {clubName({ clubId, club: head.club })}
          </Txt>
          <Txt tone="muted" numberOfLines={1} style={{ fontSize: rem(0.75) }}>
            {leagueOf(clubId)}
          </Txt>
          <View style={{ marginLeft: 'auto' }}>
            <CountPill c={c} count={head.count} />
          </View>
        </View>
      ) : null}
      <RecordsChips
        label="포지션"
        testIDPrefix="rn-pos"
        value={pos ?? 'all'}
        onPick={(key) => {
          view.pos = key === 'all' ? null : (key as CareerPos);
        }}
        items={[
          { key: 'all', label: '전체' },
          ...POS_GROUPS.map((key) => ({ key, label: POS_LABEL[key] })),
        ]}
      />
      {failed ? (
        <Message text="영구결번을 불러오지 못했어요. 잠시 후 다시 시도해 주세요." />
      ) : items === null ? (
        <Message live text="불러오는 중…" />
      ) : filtered.length ? (
        <View onLayout={onLayout} style={{ marginTop: 6 }}>
          {ready ? <Tiles items={filtered} withClub={false} {...opts} /> : null}
        </View>
      ) : (
        <Message
          text={
            pos
              ? '선택한 조건의 영구결번이 없어요.'
              : `아직 ${teamSeasonName(season)} 영구결번이 없어요.`
          }
        />
      )}
    </View>
  );
}

/** 최신순 전체 — 24개씩 이어 받는다. */
function RecentScreen({ season, myIds }: { season: number; myIds: ReadonlySet<string> }) {
  const c = useColors();
  const [items, setItems] = useState<Item[] | null>(null);
  const [next, setNext] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [more, setMore] = useState<'idle' | 'loading' | 'failed'>('idle');
  const gen = useRef(0); // 시즌이 바뀌거나 화면을 떠난 뒤 늦게 온 응답을 버린다.
  useEffect(() => {
    const mine = ++gen.current;
    setItems(null);
    setNext(null);
    setFailed(false);
    setMore('idle');
    void getRetiredNumbersPage(season, 0).then((r) => {
      if (mine !== gen.current) return;
      if (r.ok) {
        setItems(r.data.items);
        setNext(r.data.next ?? null);
      } else setFailed(true);
    });
    return () => {
      gen.current++;
    };
  }, [season]);
  const loadMore = () => {
    if (next === null || more === 'loading') return;
    const mine = gen.current;
    setMore('loading');
    void getRetiredNumbersPage(season, next).then((r) => {
      if (mine !== gen.current) return;
      if (r.ok) {
        setItems((prev) => [...(prev ?? []), ...r.data.items]);
        setNext(r.data.next ?? null);
        setMore('idle');
      } else setMore('failed');
    });
  };
  const { ready, onLayout, opts } = useTileOpts(c, false, myIds);

  return (
    <View>
      <BackButton />
      <SectionTitle>최신순 전체</SectionTitle>
      {failed ? (
        <Message text="영구결번을 불러오지 못했어요. 잠시 후 다시 시도해 주세요." />
      ) : items === null ? (
        <Message live text="불러오는 중…" />
      ) : items.length ? (
        <View onLayout={onLayout}>
          {ready ? <Tiles items={items} withClub {...opts} /> : null}
          {next !== null ? (
            <Btn
              block
              testID="rn-more"
              disabled={more === 'loading'}
              accessibilityLabel="결번 더 보기"
              onPress={loadMore}
            >
              {more === 'loading'
                ? '불러오는 중…'
                : more === 'failed'
                  ? '불러오지 못했어요. 다시 시도'
                  : '더 보기'}
            </Btn>
          ) : null}
        </View>
      ) : (
        <Message text={`아직 ${teamSeasonName(season)} 영구결번이 없어요.`} />
      )}
    </View>
  );
}

export default function RetiredWall() {
  const { season: picked, screen, clubId } = useSnapshot(view);
  const now = useSeasonNow();
  const seasons = [PRESEASON, ...SERVICE_SEASONS];
  const season = picked ?? displaySeasonAt(now);
  const selectedSeason = seasonById(season);
  const upcoming = selectedSeason && selectedSeason.startsAt > now ? selectedSeason : undefined;
  // 내 선수 배지 — 화면을 오갈 때마다 기록을 다시 읽지 않게 벽에서 한 번.
  const myIds = useMemo(() => new Set(loadHOF().flatMap((h) => (h.id ? [h.id] : []))), []);

  return (
    <Card gap={0}>
      <View testID="rn-wall" style={{ flexDirection: 'row', marginBottom: 12 }}>
        <RecordsSelect
          label="시즌"
          testID="rn-season-select"
          value={season}
          options={seasons.map((s) => ({
            value: s.id,
            label: `${s.name}${s.startsAt > now ? ' (개막 예정)' : ''}`,
          }))}
          onChange={(id) => {
            view.season = id;
            view.screen = 'home';
            view.clubId = null;
            view.pos = null;
          }}
        />
      </View>
      {upcoming ? (
        <Message
          text={`${upcoming.name}은 ${kstMonthDayHour(upcoming.startsAt)}(한국 시각)에 개막해요.`}
        />
      ) : screen === 'club' && clubId ? (
        <ClubScreen season={season} clubId={clubId} myIds={myIds} />
      ) : screen === 'recent' ? (
        <RecentScreen season={season} myIds={myIds} />
      ) : (
        <Home season={season} myIds={myIds} />
      )}
    </Card>
  );
}
