// T-10-076 기록실 '영구결번' 탭(웹 RetiredWall.svelte) — 서버의 모든 결번을 구단별(결번 많은 구단 먼저) 또는 최신순으로 본다.
// 유니폼은 구단 엠블럼 색(rnStyle), 누르면 그 선수의 은퇴 상세.
// T-11-029 결번은 시즌마다 따로 — 개막한 시즌이 둘 이상이면 시즌 탭을 보인다(웹과 같다).
import { memo, useEffect, useId, useMemo, useState } from 'react';
import { View } from 'react-native';
import Svg, { Defs, G, RadialGradient, Rect, Stop } from 'react-native-svg';
import { proxy, useSnapshot } from 'valtio';
import type { CareerPos, RetiredNumbersResponse } from '@offside/contracts';
import {
  displaySeasonAt,
  PRESEASON,
  SERVICE_SEASONS,
  seasonById,
  teamSeasonName,
} from '@offside/contracts/service-seasons';
import { getRetiredNumbers } from '@offside/app-core/api/client';
import { anonName } from '@offside/app-core/format';
import { RN_DEFAULT, rnColors } from '@offside/app-core/rnStyle';
import {
  rnByClub,
  rnClubName as clubName,
  rnDay as day,
  rnLeagueName as leagueOf,
  rnRecent,
} from '@offside/app-core/retiredWall';
import { POS } from '@offside/game/data';
import { loadHOF } from '@offside/game/season';
import { RnShirtShape } from '../../components/RnJersey';
import { openPublicLegendById } from '../../game/host';
import { alpha } from '../../theme/colors';
import { rem } from '../../theme/type';
import { type Colors } from '../../theme/colors';
import { useColors } from '../../theme/useColors';
import { Card } from '../../ui/Card';
import { ClubMark } from '../../ui/ClubBadge';
import { Press } from '../../ui/Press';
import { Txt } from '../../ui/Txt';
import { POS_GROUPS, POS_LABEL } from '@offside/contracts/positions';
import { kstMonthDayHour } from '@offside/app-core/boardText';
import { RecordsSelect, RecordsFilters, RecordsChips } from './RecordsControls';

type Item = RetiredNumbersResponse['items'][number];

// 구단별·최신순, 시즌 선택은 선수 상세에 다녀와도 그대로 둔다(화면이 다시 그려져도 모듈 값은 남는다).
// season이 null이면 지금 시즌(개막 전이면 프리시즌).
const view = proxy<{
  order: 'club' | 'recent';
  season: number | null;
  pos: CareerPos | null;
  clubId: string | null;
}>({
  order: 'club',
  season: null,
  pos: null,
  clubId: null,
});

const GAP = 8;
const MIN_TILE = 90;
/** T-11-081 타일을 한 번에 다 그리면(수백 장 · 장마다 SVG 둘) 앱이 수 초 멈춘다 — 첫 화면만큼 먼저, 나머지는 프레임마다 더 그린다. */
const FIRST_TILES = 24;
const STEP_TILES = 24;
const SHIRT_W = 52;
const SHIRT_H = (SHIRT_W * 124) / 120;

/** 목록(key: 시즌·정렬·필터)이 바뀌면 FIRST_TILES부터 다시, total까지 프레임마다 STEP_TILES씩 늘린다. */
function useTileBudget(key: string, total: number): number {
  const [budget, setBudget] = useState({ key, n: FIRST_TILES });
  // 목록이 바뀐 렌더에서 바로 줄인다(effect로 줄이면 한 번은 전부 그린다).
  const n = budget.key === key ? budget.n : FIRST_TILES;
  if (budget.key !== key) setBudget({ key, n });
  useEffect(() => {
    if (n >= total) return;
    const id = requestAnimationFrame(() => setBudget({ key, n: n + STEP_TILES }));
    return () => cancelAnimationFrame(id);
  }, [key, n, total]);
  return n;
}

type TileOpts = {
  c: Colors;
  width: number;
  myIds: ReadonlySet<string>;
  filteredPos: boolean;
  filteredClub: boolean;
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
  filteredClub,
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
      {withClub && !filteredClub ? (
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

export default function RetiredWall() {
  const c = useColors();
  const { order, season: picked, pos, clubId } = useSnapshot(view);
  const now = useMemo(() => new Date().toISOString(), []);
  const seasons = [PRESEASON, ...SERVICE_SEASONS];
  const [filtering, setFiltering] = useState(false);
  const season = picked ?? displaySeasonAt(now);
  const selectedSeason = seasonById(season);
  const upcoming = selectedSeason && selectedSeason.startsAt > now ? selectedSeason : undefined;
  const [items, setItems] = useState<Item[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setItems(null);
    setFailed(false);
    if (upcoming) return;
    let live = true; // 더 늦게 고른 시즌의 응답만 쓴다.
    void getRetiredNumbers(season).then((r) => {
      if (!live) return;
      if (r.ok) setItems(r.data.items);
      else setFailed(true);
    });
    return () => {
      live = false;
    };
  }, [season, upcoming]);

  const myIds = useMemo(() => new Set(loadHOF().flatMap((h) => (h.id ? [h.id] : []))), []);
  const clubOptions = useMemo(
    () =>
      rnByClub(items ?? [])
        .map((list) => list[0]!)
        .sort((a, b) => clubName(a).localeCompare(clubName(b), 'ko')),
    [items],
  );
  const filtered = useMemo(
    () =>
      (items ?? []).filter((it) => (!pos || pos === it.pos) && (!clubId || clubId === it.clubId)),
    [items, pos, clubId],
  );
  const clubs = useMemo(() => rnByClub(filtered), [filtered]);
  const recent = useMemo(() => rnRecent(filtered), [filtered]);
  const budget = useTileBudget(`${season}|${order}|${pos}|${clubId}`, filtered.length);
  const [w, setW] = useState(0);
  const cols = Math.max(1, Math.floor((w + GAP) / (MIN_TILE + GAP)));
  // Android의 소수점 너비 반올림으로 마지막 열이 다음 줄로 밀리지 않게 한다.
  const tileW = Math.floor((w - GAP * (cols - 1)) / cols);
  const tileOpts = { c, width: tileW, myIds, filteredPos: !!pos, filteredClub: !!clubId };
  let left = budget; // 구단별: 앞 구단부터 그릴 몫을 나눠 쓴다

  const empty = (text: string) => (
    <Txt tone="muted" style={{ fontSize: rem(0.875), paddingVertical: 8 }}>
      {text}
    </Txt>
  );
  return (
    <Card gap={0}>
      <View testID="rn-wall">
        <RecordsFilters
          testID="rn-filters"
          open={filtering}
          onToggle={() => setFiltering(!filtering)}
          label={[
            clubOptions.find((it) => it.clubId === clubId)
              ? clubName(clubOptions.find((it) => it.clubId === clubId)!)
              : '',
            pos ? POS_LABEL[pos] : '',
            order === 'club' ? '구단별' : '최신순',
          ]
            .filter(Boolean)
            .join(' · ')}
          season={
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
                view.clubId = null;
              }}
            />
          }
        >
          {!upcoming ? (
            <>
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
              <RecordsSelect
                label="구단"
                testID="rn-club-select"
                value={clubId ?? 'all'}
                onChange={(id) => {
                  view.clubId = id === 'all' ? null : id;
                }}
                options={[
                  { value: 'all', label: '전체 구단' },
                  ...clubOptions.map((it) => ({ value: it.clubId, label: clubName(it) })),
                ]}
              />
              <RecordsChips
                label="정렬"
                testIDPrefix="rn-order"
                value={order}
                onPick={(key) => {
                  view.order = key as 'club' | 'recent';
                  setFiltering(false);
                }}
                items={[
                  { key: 'club', label: '구단별' },
                  { key: 'recent', label: '최신순' },
                ]}
              />
            </>
          ) : null}
        </RecordsFilters>
      </View>

      {upcoming ? (
        empty(`${upcoming.name}은 ${kstMonthDayHour(upcoming.startsAt)}(한국 시각)에 개막해요.`)
      ) : items === null && !failed ? (
        <Txt
          tone="muted"
          accessibilityLiveRegion="polite"
          style={{ fontSize: rem(0.875), paddingVertical: 8 }}
        >
          불러오는 중…
        </Txt>
      ) : failed ? (
        empty('영구결번을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')
      ) : filtered.length ? (
        <View onLayout={(e) => setW(e.nativeEvent.layout.width)}>
          <Txt
            tone="muted"
            style={{ fontSize: 12, marginBottom: 10 }}
          >{`${filtered.length}개 결번 · ${clubs.length}개 구단${pos || clubId ? ` · 전체 ${items?.length ?? 0}개` : ''}`}</Txt>
          {w === 0 ? null : order === 'club' ? (
            clubs.map((list) => {
              if (left <= 0) return null;
              const part = list.slice(0, left);
              left -= part.length;
              const first = list[0]!;
              return (
                <View
                  key={first.clubId}
                  testID={`rn-club-${first.clubId}`}
                  style={{
                    paddingTop: 14,
                    paddingBottom: 4,
                    borderTopWidth: 1,
                    borderTopColor: c.line,
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      marginBottom: 10,
                      minWidth: 0,
                    }}
                  >
                    <ClubMark name={first.club} id={first.clubId} size={22} />
                    <Txt bold numberOfLines={1} style={{ flexShrink: 1 }}>
                      {clubName(first)}
                    </Txt>
                    <Txt tone="muted" style={{ fontSize: rem(0.75) }}>
                      {leagueOf(first.clubId)}
                    </Txt>
                    <View
                      style={{
                        marginLeft: 'auto',
                        paddingVertical: 1,
                        paddingHorizontal: 9,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: c.accent,
                        backgroundColor: alpha(c.accent, 0.16),
                      }}
                    >
                      <Txt
                        num
                        style={{
                          fontSize: rem(0.8125),
                          lineHeight: rem(0.8125) * 1.5,
                          fontWeight: '700',
                        }}
                      >
                        {list.length}
                      </Txt>
                    </View>
                  </View>
                  <Tiles items={part} withClub={false} {...tileOpts} />
                </View>
              );
            })
          ) : (
            <Tiles items={recent.slice(0, budget)} withClub {...tileOpts} />
          )}
        </View>
      ) : (
        empty(
          pos || clubId
            ? '선택한 조건의 영구결번이 없어요.'
            : `아직 ${teamSeasonName(season)} 영구결번이 없어요.`,
        )
      )}
    </Card>
  );
}
