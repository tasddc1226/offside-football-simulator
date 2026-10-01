// 선수가 뛰는 리그의 순위표(웹 tabs/LeagueTable.svelte, T-10-024). 기본은 상위 3팀 + 내 팀 앞뒤 2팀 + 꼴찌만 접어서 보여
// 주고, '전체 순위'로 모두 펼친다. 접힌 구간은 '⋯' 줄 하나로 표시한다. T-11-025 시즌 탭의 시즌 현황 카드 안에 들어가는
// 한 묶음이라 카드 테두리 없이 작은 제목을 단다. 칸은 순위·팀·경기·승점만(승·무·패는 리포트·시즌 누적 줄에 있다).
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import { leagueOf, leagueTable } from '@offside/game/engine';
import type { GameState } from '@offside/game/types';
import { RANK_SLIDE_MS, rankSlideSpan } from '@offside/app-core/resultTour';
import { alpha } from '../../theme/colors';
import { useColors } from '../../theme/useColors';
import { DISPLAY, rem } from '../../theme/type';
import { Btn } from '../../ui/Btn';
import { ClubBadge } from '../../ui/ClubBadge';
import { Txt } from '../../ui/Txt';

type Row = ReturnType<typeof leagueTable>[number];
type Shown = { gap: true; key: string } | { gap: false; key: string; rank: number; r: Row };

const COL = 32;
const MOVE_EASE = Easing.bezier(0.2, 0.8, 0.2, 1);

/** 순위 변동 연출 요청 — 이전 순위와, 같은 변동을 다시 틀 때 구분할 키. */
export interface RankPlay {
  before: number;
  key: number;
}

export function LeagueTable({ s, play }: { s: GameState; play?: RankPlay | null }) {
  const c = useColors();
  const [full, setFull] = useState(false);
  const rowBox = useRef(new Map<string, { y: number; height: number }>());
  const shifts = useRef(new Map<string, Animated.Value>());
  const shift = (k: string) => {
    let v = shifts.current.get(k);
    if (!v) shifts.current.set(k, (v = new Animated.Value(0)));
    return v;
  };
  const [moving, setMoving] = useState(false);
  const [delta, setDelta] = useState<string | null>(null);
  const rows = leagueTable(s);
  const myRank = rows.findIndex((r) => r.me) + 1;
  const keep = (rank: number) => rank <= 3 || Math.abs(rank - myRank) <= 2 || rank === rows.length;
  const shown: Shown[] = [];
  rows.forEach((r, i) => {
    const rank = i + 1;
    // 구단 이름은 유저가 겹치게 바꿀 수 있다(T-10-034) — 키는 순위로 잡는다.
    if (full || keep(rank)) shown.push({ gap: false, key: `row-${rank}`, rank, r });
    else if (!shown.at(-1)?.gap) shown.push({ gap: true, key: `gap-${rank}` });
  });
  const folded = shown.some((x) => x.gap);

  // T-11-025 순위 변동 연출(웹 LeagueTable playRank): 내 팀 줄이 이전 순위 자리에서 지금 자리로 미끄러지고, 그사이 지나친
  // 줄들은 한 칸씩 반대로 밀려난다. 접힌 표에서는 보이는 줄 안에서 이전 순위에 가장 가까운 자리부터 움직인다.
  // 시즌 탭 결과 안내가 시즌 현황 카드를 비출 때 play를 넘긴다.
  useEffect(() => {
    if (!play) return;
    const span = rankSlideSpan(
      shown.map((x) => (x.gap ? {} : { rank: x.rank, me: x.r.me })),
      play.before,
      myRank,
    );
    if (!span) return;
    const { me, from, up } = span;
    const a = rowBox.current.get(shown[me]!.key);
    const b = rowBox.current.get(shown[from]!.key);
    if (!a || !b) return;
    const runs: Animated.CompositeAnimation[] = [];
    for (let i = Math.min(me, from); i <= Math.max(me, from); i++) {
      const v = shift(shown[i]!.key);
      v.setValue(i === me ? b.y - a.y : up ? -a.height : a.height);
      runs.push(
        Animated.timing(v, {
          toValue: 0,
          duration: RANK_SLIDE_MS,
          easing: MOVE_EASE,
          useNativeDriver: true,
        }),
      );
    }
    setMoving(true);
    setDelta(`${up ? '▲' : '▼'}${Math.abs(play.before - myRank)}`);
    const anim = Animated.parallel(runs);
    anim.start(() => setMoving(false));
    const id = setTimeout(() => setDelta(null), RANK_SLIDE_MS + 2400);
    return () => {
      anim.stop();
      clearTimeout(id);
    };
    // 같은 연출 요청(key)마다 한 번만 튼다.
  }, [play?.key]);

  const head = (t: string, team = false) => (
    <Txt
      key={t}
      tone="muted"
      style={[
        { fontSize: rem(0.6875), fontWeight: '600', textAlign: team ? 'left' : 'center' },
        team ? { flex: 1, paddingLeft: 6 } : { width: COL },
      ]}
    >
      {t}
    </Txt>
  );
  return (
    <View testID="league-table" style={{ gap: 10 }}>
      <View
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}
      >
        <SubTitle>{`${leagueOf(s.leagueId).name} 순위`}</SubTitle>
        {s.season.played && (folded || full) ? (
          <Btn
            sm
            testID="table-toggle"
            accessibilityLabel={full ? '순위표 접기' : '전체 순위 보기'}
            onPress={() => setFull(!full)}
          >
            {full ? '접기' : '전체 순위'}
          </Btn>
        ) : null}
      </View>
      {s.season.played ? (
        <View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 4,
              paddingHorizontal: 2,
              borderBottomWidth: 1,
              borderBottomColor: c.line,
            }}
          >
            {head('#')}
            {head('팀', true)}
            {['경기', '승점'].map((t) => head(t))}
          </View>
          {shown.map((x) => (
            <Animated.View
              key={x.key}
              onLayout={(e) => rowBox.current.set(x.key, e.nativeEvent.layout)}
              style={[
                { transform: [{ translateY: shift(x.key) }] },
                // 움직이는 내 팀 줄은 지나치는 줄들 위로 — 반투명 강조색 아래에 카드 바탕을 깐다.
                !x.gap && x.r.me && { backgroundColor: c.surface },
                !x.gap && x.r.me && moving && { zIndex: 1, elevation: 3 },
              ]}
            >
              {x.gap ? (
                <View
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={{
                    padding: 2,
                    alignItems: 'center',
                    borderBottomWidth: 1,
                    borderBottomColor: c.line,
                  }}
                >
                  <Txt tone="muted" style={{ lineHeight: rem(1) }}>
                    ⋯
                  </Txt>
                </View>
              ) : (
                <View
                  accessible
                  accessibilityLabel={`${x.rank}위 ${x.r.name} ${x.r.p}경기 ${x.r.w}승 ${x.r.d}무 ${x.r.l}패 승점 ${x.r.pts}${x.r.me ? ', 내 팀' : ''}`}
                  style={[
                    {
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 7,
                      paddingHorizontal: 2,
                      borderBottomWidth: 1,
                      borderBottomColor: c.line,
                    },
                    x.r.me && {
                      backgroundColor: alpha(c.pitch, 0.1),
                      borderLeftWidth: 3,
                      borderLeftColor: c.accent,
                    },
                  ]}
                >
                  <View style={{ width: COL, flexDirection: 'row', justifyContent: 'center' }}>
                    <Cell
                      bold={x.r.me || x.rank === 1}
                      color={x.rank === 1 ? c.accentText : undefined}
                      width={x.r.me && delta ? 'auto' : COL}
                    >
                      {x.rank}
                    </Cell>
                    {x.r.me && delta ? (
                      <Txt
                        style={{
                          fontSize: rem(0.625),
                          fontWeight: '700',
                          color: delta.startsWith('▲') ? c.good : c.bad,
                        }}
                      >
                        {delta}
                      </Txt>
                    ) : null}
                  </View>
                  <View
                    style={{
                      flex: 1,
                      minWidth: 0,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      paddingLeft: 6,
                    }}
                  >
                    {x.r.id ? <ClubBadge club={{ id: x.r.id, name: x.r.name }} size={16} /> : null}
                    <Txt
                      numberOfLines={1}
                      style={{
                        flex: 1,
                        fontSize: rem(0.8125),
                        fontWeight: x.r.me ? '700' : '400',
                      }}
                    >
                      {x.r.name}
                    </Txt>
                  </View>
                  <Cell bold={x.r.me}>{x.r.p}</Cell>
                  <Cell bold>{x.r.pts}</Cell>
                </View>
              )}
            </Animated.View>
          ))}
        </View>
      ) : (
        <Txt tone="muted" style={{ fontSize: rem(0.8125) }}>
          {`개막하면 ${rows.length}개 팀 순위표가 채워져요.`}
        </Txt>
      )}
    </View>
  );
}

/** 카드 안 작은 묶음 제목(웹 .sub-title). */
export function SubTitle({ children }: { children: string }) {
  return (
    <Txt accessibilityRole="header" style={{ fontSize: rem(0.9375), fontWeight: '700' }}>
      {children}
    </Txt>
  );
}

/** 표 숫자 칸(웹 td.num — 숫자 서체 0.9375rem, 가운데 정렬. 굵기는 행이 정한다). */
function Cell({
  children,
  bold,
  color,
  width = COL,
}: {
  children: number;
  bold?: boolean | undefined;
  color?: string | undefined;
  width?: number | 'auto';
}) {
  return (
    <Txt
      style={[
        {
          width,
          textAlign: 'center',
          fontFamily: bold ? DISPLAY[700] : DISPLAY[400],
          fontSize: rem(0.9375),
          fontVariant: ['tabular-nums'],
        },
        color ? { color } : null,
      ]}
    >
      {children}
    </Txt>
  );
}
