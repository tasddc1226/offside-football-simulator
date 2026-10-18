// T-11-269 시즌 통계(웹 team/TeamStats.svelte) — 기록 탭의 통계 카드나 경기 결과의 우리 선수 이름에서 들어온다.
// 선수별 골 · 도움, 날짜별 전적, 상대별 전적을 탭으로 나눠 보여 준다. 랭크 경기만 센다(친선전은 저장하지 않는다).
// T-11-358 흐름 요약(최근 흐름 · 연속 기록 · 도전/도전받음 · 가장 큰 승패)과 경기 종류별 전적(랭크 · 친선 · 컵)을 위에 둔다.
// 남의 팀 프로필에서도 같은 화면을 쓴다(embedded: 제목을 h2로, 돌아가기 대신 닫기).
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import type { TeamStatsResponse } from '@offside/app-core/api/team';
import { teamCoreText as C } from '@offside/app-core/i18n/ko/teamCore';
import { teamMatchText as L } from '@offside/app-core/i18n/ko/teamMatch';
import { statsDayLabel } from '@offside/app-core/teamText';
import {
  bigMatchLine,
  formAria,
  formLetter,
  statsKindRows,
  streakText,
  type StatsKindRow,
} from '@offside/app-core/teamStats';
import { TEAM_STATS_MATCHES_MAX } from '@offside/contracts/owner-team';
import { LoadState, type LoadStatus } from '../../components/LoadState';
import { TeamLogo } from '../../components/TeamLogo';
import { DISPLAY, rem } from '../../theme/type';
import { useColors } from '../../theme/useColors';
import { Btn, Card, Txt } from '../../ui';
import { Seg, TabOpt } from '../board/parts';
import { TeamSeasonReport } from './TeamReport';

type Tab = 'players' | 'days' | 'opponents';

export function TeamStats({
  stats,
  status,
  seasonName,
  focus,
  name,
  reload,
  back,
  backText = L.backHistory,
  embedded = false,
}: {
  stats: TeamStatsResponse | null;
  status: LoadStatus;
  seasonName: string;
  /** 경기 결과에서 누른 선수(맨 위에 따로 보여 주고 목록에서 강조한다). */
  focus: string | null;
  name: (id: string | null, fallback: string) => string;
  reload: () => void;
  back: () => void;
  backText?: string;
  embedded?: boolean;
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
  const sub = (text: string) => (
    <Txt v="h3" accessibilityRole="header">
      {text}
    </Txt>
  );
  const kindList = (kinds: StatsKindRow[]) =>
    kinds.length ? (
      <View style={{ gap: 6 }} testID="team-stats-kinds">
        {sub(L.statsKindsTitle)}
        <View>
          {kinds.map((k) => (
            <View
              key={k.key}
              testID={`team-stats-kind-${k.key}`}
              style={[row, { justifyContent: 'space-between' }]}
            >
              <Txt bold>{k.label}</Txt>
              {k.record ? (
                right(record(k.record), L.statsGfGa({ gf: k.record.gf, ga: k.record.ga }))
              ) : (
                <Txt tone="muted">{L.statsKindNone}</Txt>
              )}
            </View>
          ))}
        </View>
        <Txt tone="muted" v="xs">
          {L.statsKindNote}
        </Txt>
      </View>
    ) : null;
  const formColor = (r: 'w' | 'd' | 'l') => (r === 'w' ? c.good : r === 'd' ? c.muted : c.bad);
  const pair = (label: string, value: string, testID?: string) => (
    <View style={{ flexBasis: '45%', flexGrow: 1, minWidth: 0 }} testID={testID}>
      <Txt tone="muted" v="xs">
        {label}
      </Txt>
      <Txt>{value}</Txt>
    </View>
  );
  const flow = (f: NonNullable<TeamStatsResponse['summary']>) => {
    const streak = streakText(f.streak);
    return (
      <View style={{ gap: 8 }} testID="team-stats-flow">
        {sub(L.statsFlowTitle)}
        {f.form.length ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Txt tone="muted" v="xs">
              {L.statsFormLabel({ n: f.form.length })}
            </Txt>
            <View
              accessible
              accessibilityLabel={formAria(f.form)}
              testID={`team-stats-form-${f.form.join('')}`}
              style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}
            >
              {f.form.map((r, i) => (
                <View
                  key={i}
                  style={{
                    minWidth: rem(1.6),
                    height: rem(1.6),
                    paddingHorizontal: 3,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: formColor(r),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Txt bold v="xs" style={{ color: formColor(r) }}>
                    {formLetter(r)}
                  </Txt>
                </View>
              ))}
            </View>
          </View>
        ) : null}
        <Txt tone="muted" v="sm">
          {`${streak ? `${streak} · ` : ''}${L.statsBestWinStreak({ n: f.bestWinStreak })}`}
        </Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {pair(L.kindChallenge, record(f.home))}
          {pair(L.kindChallenged, record(f.away))}
          {f.biggestWin
            ? pair(L.statsBiggestWin, bigMatchLine(f.biggestWin), 'team-stats-big-win')
            : null}
          {f.biggestLoss
            ? pair(L.statsBiggestLoss, bigMatchLine(f.biggestLoss), 'team-stats-big-loss')
            : null}
        </View>
      </View>
    );
  };
  return (
    <Card gap={12} testID="team-stats-screen">
      <View>
        <Txt v="eyebrow">Stats</Txt>
        <Txt v={embedded ? 'h2' : 'h1'} accessibilityRole="header">
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
          <>
            <Txt tone="muted">{L.statsEmpty}</Txt>
            {kindList(statsKindRows(s))}
          </>
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
            {s.summary ? flow(s.summary) : null}
            {kindList(statsKindRows(s))}
            <TeamSeasonReport report={s.report} />
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
        {backText}
      </Btn>
    </Card>
  );
}
