// T-11-269 시즌 통계(웹 team/TeamStats.svelte) — 기록 탭의 통계 카드나 경기 결과의 우리 선수 이름에서 들어온다.
// 선수별 골 · 도움, 날짜별 전적, 상대별 전적을 탭으로 나눠 보여 준다. 랭크 경기만 센다(친선전은 저장하지 않는다).
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import type { TeamStatsResponse } from '@offside/app-core/api/team';
import { teamCoreText as C } from '@offside/app-core/i18n/ko/teamCore';
import { teamMatchText as L } from '@offside/app-core/i18n/ko/teamMatch';
import { statsDayLabel } from '@offside/app-core/teamText';
import { TEAM_STATS_MATCHES_MAX } from '@offside/contracts/owner-team';
import { LoadState, type LoadStatus } from '../../components/LoadState';
import { TeamLogo } from '../../components/TeamLogo';
import { DISPLAY, rem } from '../../theme/type';
import { useColors } from '../../theme/useColors';
import { Btn, Card, Txt } from '../../ui';
import { Seg, TabOpt } from '../board/parts';

type Tab = 'players' | 'days' | 'opponents';

export function TeamStats({
  stats,
  status,
  seasonName,
  focus,
  name,
  reload,
  back,
}: {
  stats: TeamStatsResponse | null;
  status: LoadStatus;
  seasonName: string;
  /** 경기 결과에서 누른 선수(맨 위에 따로 보여 주고 목록에서 강조한다). */
  focus: string | null;
  name: (id: string | null, fallback: string) => string;
  reload: () => void;
  back: () => void;
}) {
  const c = useColors();
  const [tab, setTab] = useState<Tab>('players');
  useEffect(() => {
    if (focus) setTab('players');
  }, [focus]);
  const record = (t: { w: number; d: number; l: number }) => C.record(t);
  const row = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: c.line,
  } as const;
  const num = { width: rem(1) * 3, textAlign: 'right' } as const;
  const s = stats;
  const focused = s && focus ? s.players.findIndex((p) => p.careerId === focus) : -1;
  const right = (main: string, sub: string) => (
    <View style={{ alignItems: 'flex-end' }}>
      <Txt>{main}</Txt>
      <Txt tone="muted" v="xs">
        {sub}
      </Txt>
    </View>
  );
  return (
    <Card gap={12} testID="team-stats-screen">
      <View>
        <Txt v="eyebrow">Stats</Txt>
        <Txt v="h1" accessibilityRole="header">
          {L.statsTitle}
        </Txt>
        {seasonName ? (
          <Txt tone="muted" v="sm">
            {seasonName}
          </Txt>
        ) : null}
      </View>
      <LoadState status={status} failText={L.statsFail} retry={reload}>
        {!s ? null : s.matches === 0 ? (
          <Txt tone="muted">{L.statsEmpty}</Txt>
        ) : (
          <>
            <View
              style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}
            >
              <Txt
                testID="team-stats-total"
                style={{ fontFamily: DISPLAY[700], fontSize: rem(1.5) }}
              >
                {record(s.total)}
              </Txt>
              <Txt tone="muted" v="sm">
                {L.statsGfGa({ gf: s.total.gf, ga: s.total.ga })}
              </Txt>
            </View>
            <Seg cols={3} label={L.statsTabLabel}>
              {(
                [
                  ['players', L.statsTabPlayers],
                  ['days', L.statsTabDays],
                  ['opponents', L.statsTabOpponents],
                ] as const
              ).map(([k, label]) => (
                <TabOpt
                  key={k}
                  tight
                  title={label}
                  selected={tab === k}
                  testID={`team-stats-tab-${k}`}
                  onPress={() => setTab(k)}
                />
              ))}
            </Seg>
            {tab === 'players' ? (
              s.players.length ? (
                <View>
                  {focused >= 0 ? (
                    <View
                      testID="team-stats-focus"
                      style={{
                        padding: 10,
                        borderRadius: 10,
                        backgroundColor: c.surface2,
                        gap: 2,
                        marginBottom: 6,
                      }}
                    >
                      <Txt
                        bold
                      >{`${focused + 1}. ${name(s.players[focused]!.careerId, s.players[focused]!.name)}`}</Txt>
                      <Txt v="sm">{`${L.statsGoals} ${s.players[focused]!.goals} · ${L.statsAssists} ${s.players[focused]!.assists}`}</Txt>
                    </View>
                  ) : null}
                  <View
                    style={[row, { borderTopWidth: 0, paddingBottom: 2 }]}
                    importantForAccessibility="no-hide-descendants"
                  >
                    <View style={{ flex: 1 }} />
                    <Txt tone="muted" v="sm" style={num}>
                      {L.statsGoals}
                    </Txt>
                    <Txt tone="muted" v="sm" style={num}>
                      {L.statsAssists}
                    </Txt>
                  </View>
                  {s.players.map((p, i) => (
                    <View
                      key={p.careerId ?? `anon:${p.name}`}
                      style={[
                        row,
                        i === focused && { backgroundColor: c.surface2, borderRadius: 8 },
                      ]}
                    >
                      <Txt style={{ flex: 1, minWidth: 0 }}>
                        <Txt tone="muted" v="xs">{`${i + 1} `}</Txt>
                        {name(p.careerId, p.name)}
                      </Txt>
                      <Txt num bold style={num}>
                        {String(p.goals)}
                      </Txt>
                      <Txt num bold style={num}>
                        {String(p.assists)}
                      </Txt>
                    </View>
                  ))}
                </View>
              ) : (
                <Txt tone="muted">{L.statsNoScorers}</Txt>
              )
            ) : tab === 'days' ? (
              <View>
                {s.days.map((d) => (
                  <View key={d.day} style={[row, { justifyContent: 'space-between' }]}>
                    <Txt bold>{statsDayLabel(d.day)}</Txt>
                    {right(record(d), L.statsGfGa({ gf: d.gf, ga: d.ga }))}
                  </View>
                ))}
              </View>
            ) : (
              <View>
                {s.opponents.map((o) => (
                  <View key={o.teamId} style={row}>
                    <TeamLogo logo={o.logo} name={o.name} size={28} decorative />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Txt bold>{o.name}</Txt>
                      <Txt tone="muted" v="xs">
                        {L.statsOppOwner({ owner: o.owner, n: o.w + o.d + o.l })}
                      </Txt>
                    </View>
                    {right(record(o), L.statsGfGa({ gf: o.gf, ga: o.ga }))}
                  </View>
                ))}
              </View>
            )}
            <Txt tone="muted" v="xs">
              {s.capped
                ? L.statsCapped({ n: TEAM_STATS_MATCHES_MAX })
                : L.statsNote({ n: s.matches })}
            </Txt>
          </>
        )}
      </LoadState>
      <Btn testID="team-stats-back" onPress={back}>
        {L.backHistory}
      </Btn>
    </Card>
  );
}
