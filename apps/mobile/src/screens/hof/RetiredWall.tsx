// T-10-076 기록실 '영구결번' 탭(웹 RetiredWall.svelte) — 서버의 모든 결번을 구단별(결번 많은 구단 먼저) 또는 최신순으로 본다.
// 유니폼은 구단 엠블럼 색(rnStyle), 누르면 그 선수의 은퇴 상세.
// T-11-029 결번은 시즌마다 따로 — 개막한 시즌이 둘 이상이면 시즌 탭을 보인다(웹과 같다).
import { useEffect, useId, useMemo, useState } from 'react';
import { View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { proxy, useSnapshot } from 'valtio';
import type { RetiredNumbersResponse } from '@offside/contracts';
import {
  displaySeasonAt,
  openTeamSeasons,
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
import { RnShirt } from '../../components/RnJersey';
import { openPublicLegendById } from '../../game/host';
import { alpha } from '../../theme/colors';
import { rem } from '../../theme/type';
import { useColors } from '../../theme/useColors';
import { Card } from '../../ui/Card';
import { ClubMark } from '../../ui/ClubBadge';
import { Press } from '../../ui/Press';
import { Txt } from '../../ui/Txt';
import { Seg, SortChips, TabOpt } from '../board/parts';

type Item = RetiredNumbersResponse['items'][number];

// 구단별·최신순, 시즌 선택은 선수 상세에 다녀와도 그대로 둔다(화면이 다시 그려져도 모듈 값은 남는다).
// season이 null이면 지금 시즌(개막 전이면 프리시즌).
const view = proxy<{ order: 'club' | 'recent'; season: number | null }>({
  order: 'club',
  season: null,
});

const GAP = 8;
const MIN_TILE = 90;

/** 유니폼 타일 한 장 — 구단 색이 은은히 비치는 바탕(웹 radial-gradient). */
function Tile({
  it,
  withClub,
  mine,
  width,
}: {
  it: Item;
  withClub: boolean;
  mine: boolean;
  width: number;
}) {
  const c = useColors();
  const gid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const base = (rnColors(it.clubId) ?? RN_DEFAULT).base;
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
      </Svg>
      <View style={{ marginBottom: 4 }}>
        <RnShirt number={it.number} width={52} clubId={it.clubId} />
      </View>
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
      ) : (
        <Txt tone="muted" numberOfLines={1} style={{ fontSize: rem(0.75), maxWidth: '100%' }}>
          {POS[it.pos].label}
        </Txt>
      )}
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
}

/** 웹 grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)). */
function Tiles({
  items,
  withClub,
  myIds,
}: {
  items: Item[];
  withClub: boolean;
  myIds: ReadonlySet<string>;
}) {
  const [w, setW] = useState(0);
  const cols = Math.max(1, Math.floor((w + GAP) / (MIN_TILE + GAP)));
  const tile = (w - GAP * (cols - 1)) / cols;
  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP, paddingBottom: 10 }}
    >
      {w > 0
        ? items.map((it) => (
            <Tile
              key={it.seq}
              it={it}
              withClub={withClub}
              mine={myIds.has(it.careerId)}
              width={tile}
            />
          ))
        : null}
    </View>
  );
}

export default function RetiredWall() {
  const c = useColors();
  const { order, season: picked } = useSnapshot(view);
  const now = useMemo(() => new Date().toISOString(), []);
  const seasons = useMemo(() => openTeamSeasons(now), [now]);
  const season = picked ?? displaySeasonAt(now);
  const [items, setItems] = useState<Item[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setItems(null);
    setFailed(false);
    let live = true; // 더 늦게 고른 시즌의 응답만 쓴다.
    void getRetiredNumbers(season).then((r) => {
      if (!live) return;
      if (r.ok) setItems(r.data.items);
      else setFailed(true);
    });
    return () => {
      live = false;
    };
  }, [season]);

  const myIds = useMemo(() => new Set(loadHOF().flatMap((h) => (h.id ? [h.id] : []))), []);
  const clubs = useMemo(() => rnByClub(items ?? []), [items]);
  const recent = useMemo(() => rnRecent(items ?? []), [items]);

  const empty = (text: string) => (
    <Txt tone="muted" style={{ fontSize: rem(0.875), paddingVertical: 8 }}>
      {text}
    </Txt>
  );
  const summary = (value: string, label: string, small = false) => (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        gap: 2,
        paddingVertical: 10,
        paddingHorizontal: 6,
        borderRadius: 12,
        backgroundColor: c.surface2,
      }}
    >
      <Txt
        num
        style={{
          fontSize: rem(small ? 0.9375 : 1.25),
          lineHeight: small ? rem(1.75) : rem(1.25) * 1.4,
        }}
      >
        {value}
      </Txt>
      <Txt tone="muted" style={{ fontSize: rem(0.75) }}>
        {label}
      </Txt>
    </View>
  );

  return (
    <Card gap={0}>
      <View testID="rn-wall">
        <Txt v="eyebrow">Retired Numbers</Txt>
        <Txt v="h1" accessibilityRole="header" style={{ marginBottom: 6 }}>
          영구결번
        </Txt>
        <Txt tone="muted" style={{ fontSize: rem(0.8125), marginBottom: 14 }}>
          한 구단에서 오래 크게 활약한 선수의 등번호는 그 구단에서 다시 쓰지 않습니다. 구단마다 한
          번호에 한 명뿐입니다.
        </Txt>
      </View>

      {seasons.length > 1 ? (
        <Seg cols={Math.min(seasons.length, 3)} label="시즌" style={{ marginBottom: 10 }}>
          {seasons.map((id) => (
            <TabOpt
              key={id}
              title={teamSeasonName(id)}
              selected={season === id}
              testID={`rn-season-${id}`}
              onPress={() => (view.season = id)}
            />
          ))}
        </Seg>
      ) : null}

      {items === null && !failed ? (
        <Txt
          tone="muted"
          accessibilityLiveRegion="polite"
          style={{ fontSize: rem(0.875), paddingVertical: 8 }}
        >
          불러오는 중…
        </Txt>
      ) : failed ? (
        empty('영구결번을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')
      ) : items?.length ? (
        <>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            {summary(String(items.length), '결번')}
            {summary(String(clubs.length), '구단')}
            {summary(day(recent[0]!.grantedAt), '최근 결번', true)}
          </View>
          <SortChips
            label="정렬"
            testIDPrefix="rn-order"
            value={order}
            onPick={(k) => (view.order = k as 'club' | 'recent')}
            items={[
              { key: 'club', label: '구단별' },
              { key: 'recent', label: '최신순' },
            ]}
          />
          {order === 'club' ? (
            clubs.map((list) => {
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
                  <Tiles items={list} withClub={false} myIds={myIds} />
                </View>
              );
            })
          ) : (
            <Tiles items={recent} withClub myIds={myIds} />
          )}
        </>
      ) : (
        empty(`아직 ${teamSeasonName(season)} 영구결번이 없어요.`)
      )}
    </Card>
  );
}
