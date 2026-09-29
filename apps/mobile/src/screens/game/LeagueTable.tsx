// 선수가 뛰는 리그의 순위표(웹 tabs/LeagueTable.svelte, T-10-024). 기본은 상위 3팀 + 내 팀 앞뒤 2팀 + 꼴찌만 접어서 보여
// 주고, '전체 순위'로 모두 펼친다. 접힌 구간은 '⋯' 줄 하나로 표시한다.
import { useState } from 'react';
import { View } from 'react-native';
import { leagueOf, leagueTable } from '@offside/game/engine';
import type { GameState } from '@offside/game/types';
import { alpha } from '../../theme/colors';
import { useColors } from '../../theme/useColors';
import { DISPLAY, rem } from '../../theme/type';
import { Btn } from '../../ui/Btn';
import { Card } from '../../ui/Card';
import { ClubBadge } from '../../ui/ClubBadge';
import { Txt } from '../../ui/Txt';

type Row = ReturnType<typeof leagueTable>[number];
type Shown = { gap: true; key: string } | { gap: false; key: string; rank: number; r: Row };

const COL = 32;

export function LeagueTable({ s }: { s: GameState }) {
  const c = useColors();
  const [full, setFull] = useState(false);
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
    <Card gap={10}>
      <View testID="league-table" style={{ gap: 10 }}>
        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}
        >
          <View>
            <Txt v="eyebrow">League Table</Txt>
            <Txt v="h2" accessibilityRole="header">{`${leagueOf(s.leagueId).name} 순위`}</Txt>
          </View>
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
              {['경기', '승', '무', '패', '승점'].map((t) => head(t))}
            </View>
            {shown.map((x) =>
              x.gap ? (
                <View
                  key={x.key}
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
                  key={x.key}
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
                  <Cell
                    bold={x.r.me || x.rank === 1}
                    color={x.rank === 1 ? c.accentText : undefined}
                  >
                    {x.rank}
                  </Cell>
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
                  <Cell bold={x.r.me}>{x.r.w}</Cell>
                  <Cell bold={x.r.me}>{x.r.d}</Cell>
                  <Cell bold={x.r.me}>{x.r.l}</Cell>
                  <Cell bold>{x.r.pts}</Cell>
                </View>
              ),
            )}
          </View>
        ) : (
          <Txt tone="muted" style={{ fontSize: rem(0.8125) }}>
            {`개막하면 ${rows.length}개 팀 순위표가 채워져요.`}
          </Txt>
        )}
      </View>
    </Card>
  );
}

/** 표 숫자 칸(웹 td.num — 숫자 서체 0.9375rem, 가운데 정렬. 굵기는 행이 정한다). */
function Cell({
  children,
  bold,
  color,
}: {
  children: number;
  bold?: boolean | undefined;
  color?: string | undefined;
}) {
  return (
    <Txt
      style={[
        {
          width: COL,
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
