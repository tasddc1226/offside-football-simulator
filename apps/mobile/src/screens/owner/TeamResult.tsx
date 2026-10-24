// 경기 결과(웹 team/Team.svelte 의 view === 'result', 중계가 끝난 뒤) — 스코어 · 득점 · 레이팅 변화.
import { RADIUS } from '@offside/app-core/design-tokens';
import { View } from 'react-native';
import { useColors } from '../../theme/useColors';
import { TeamLogo } from '../../components/TeamLogo';
import type { OwnerTeam, TeamMatch } from '@offside/app-core/api/team';
import { kstMonthDayTime } from '@offside/app-core/boardText';
import { OUTCOME_TITLE, outcomeOf } from '@offside/app-core/teamOwner';
import { teamMatchText as L } from '@offside/app-core/i18n/ko/teamMatch';
import { teamMomentsText as M } from '@offside/app-core/i18n/ko/teamMoments';
import { momentTitle, pickedLabel } from '@offside/app-core/teamMoments';
import { recordText, signedNum } from '@offside/app-core/teamText';
import { DISPLAY, rem } from '../../theme/type';
import { Btn, Card, Press, Txt } from '../../ui';
import { Grid2 } from './TeamParts';
import { TeamReport } from './TeamReport';
import type { ReportLine } from '@offside/contracts/owner-team';

export function TeamResult({
  m,
  team,
  eventName,
  matchesLeft,
  toTeam,
  replay,
  again,
  backLabel = L.backDefaultApp,
  onPlayer,
  fix,
}: {
  m: TeamMatch;
  team: OwnerTeam | null;
  eventName: (id: string | null, fallback: string) => string;
  matchesLeft: number;
  toTeam: () => void;
  replay: () => void;
  again: () => void;
  backLabel?: string;
  /** T-11-269 우리 선수 이름을 누르면 시즌 통계의 그 선수 줄로(랭크 경기만, 웹 TeamResult onplayer). */
  onPlayer?: (careerId: string) => void;
  /** T-11-379 리포트 '고칠 곳' — 내 편성을 고칠 수 있을 때만(웹 TeamResult fix). */
  fix?: ((line: ReportLine) => { pos: string; go: () => void } | null) | undefined;
}) {
  const c = useColors();
  const friendly = !!m.friendly;
  const linkable = (id: string | null): id is string => !!onPlayer && !friendly && !!id;
  const under = { textDecorationLine: 'underline' } as const;
  const gain = m[m.mine].ratingChange;
  const side = (s: TeamMatch['home'], away: boolean, mine: boolean) => (
    <View style={{ flex: 1, minWidth: 0, gap: 2, alignItems: away ? 'flex-end' : 'flex-start' }}>
      <TeamLogo logo={s.logo} name={s.name} size={40} decorative />
      <Txt bold tone={mine ? 'accent' : 'ink'} style={{ textAlign: away ? 'right' : 'left' }}>
        {s.name}
      </Txt>
      <Txt tone="muted" v="xs" style={{ textAlign: away ? 'right' : 'left' }}>
        {`${s.owner} · OVR ${s.ovr}`}
      </Txt>
    </View>
  );
  const goalStyle = {
    fontFamily: DISPLAY[700],
    fontSize: rem(2.5),
    lineHeight: rem(2.5),
  } as const;
  return (
    <Card gap={14}>
      <View testID="team-result">
        <Txt v="eyebrow">Full time</Txt>
        <Txt v="h1" accessibilityRole="header">
          {OUTCOME_TITLE[outcomeOf(m)]}
        </Txt>
        {friendly ? (
          <Txt v="sm" tone="accent" bold testID="team-friendly-label">
            {L.kindFriendly}
          </Txt>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {side(m.home, false, m.mine === 'home')}
        <View
          accessible
          accessibilityLabel={L.scoreAria({ h: m.home.goals, a: m.away.goals })}
          style={{ flexDirection: 'row', gap: 8 }}
        >
          <Txt style={goalStyle}>{m.home.goals}</Txt>
          <Txt accessible={false} style={goalStyle}>
            :
          </Txt>
          <Txt style={goalStyle}>{m.away.goals}</Txt>
        </View>
        {side(m.away, true, m.mine === 'away')}
      </View>
      {m.events.length ? (
        <View style={{ gap: 8 }}>
          {m.events.map((e, k) => (
            <View
              key={k}
              style={{
                flexDirection: e.side === 'away' ? 'row-reverse' : 'row',
                gap: 10,
                alignItems: 'baseline',
              }}
            >
              <Txt
                tone="muted"
                style={{
                  minWidth: rem(1) * 2.2,
                  fontFamily: DISPLAY[700],
                  textAlign: e.side === 'away' ? 'right' : 'left',
                }}
              >{`${e.minute}'`}</Txt>
              <View style={{ alignItems: e.side === 'away' ? 'flex-end' : 'flex-start' }}>
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    alignItems: 'baseline',
                    justifyContent: e.side === 'away' ? 'flex-end' : 'flex-start',
                    columnGap: 6,
                  }}
                >
                  {linkable(e.scorerId) ? (
                    <Press
                      onPress={() => onPlayer!(e.scorerId!)}
                      accessibilityRole="button"
                      accessibilityLabel={L.playerStatsAria({
                        name: eventName(e.scorerId, e.scorer),
                      })}
                      testID="team-player-stats"
                    >
                      <Txt bold style={under}>
                        {eventName(e.scorerId, e.scorer)}
                      </Txt>
                    </Press>
                  ) : (
                    <Txt bold>{eventName(e.scorerId, e.scorer)}</Txt>
                  )}
                  {e.slot ? (
                    <Txt tone="muted" v="xs" testID="team-slot">
                      {e.slot}
                    </Txt>
                  ) : null}
                </View>
                {e.assist ? (
                  linkable(e.assistId) ? (
                    <Press
                      onPress={() => onPlayer!(e.assistId!)}
                      accessibilityRole="button"
                      accessibilityLabel={L.playerStatsAria({
                        name: eventName(e.assistId, e.assist),
                      })}
                    >
                      <Txt tone="muted" v="xs" style={under}>
                        {L.assist({ name: eventName(e.assistId, e.assist) })}
                      </Txt>
                    </Press>
                  ) : (
                    <Txt tone="muted" v="xs">
                      {L.assist({ name: eventName(e.assistId, e.assist) })}
                    </Txt>
                  )
                ) : null}
              </View>
            </View>
          ))}
        </View>
      ) : (
        <Txt tone="muted">{L.noGoals}</Txt>
      )}
      {m.moments?.length ? (
        <View style={{ gap: 6 }} testID="team-moments">
          <Txt v="eyebrow">{M.recordTitle}</Txt>
          {m.moments.map((x) => (
            <View
              key={x.index}
              style={{
                gap: 2,
                paddingVertical: 8,
                paddingHorizontal: 10,
                borderRadius: RADIUS.sm,
                backgroundColor: c.surface2,
                borderLeftWidth: 3,
                borderLeftColor: x.ok ? c.pitch2 : c.line,
                opacity: x.ok ? 1 : 0.7,
              }}
            >
              <Txt bold v="sm">
                {momentTitle(x)}
              </Txt>
              <Txt v="sm">
                {M.recordLine({
                  minute: x.minute,
                  name: `${eventName(x.actor.id, x.actor.name)}(${x.actor.slot})`,
                  choice: pickedLabel(x, eventName),
                  ok: !!x.ok,
                })}
              </Txt>
            </View>
          ))}
        </View>
      ) : null}
      <TeamReport m={m} fix={fix} />
      <Txt tone="muted" v="sm">
        {`${kstMonthDayTime(m.createdAt)}${team && !friendly && m.mine === 'home' ? L.resultRecord({ record: recordText(team.record) }) : ''}`}
      </Txt>
      {gain != null ? (
        <Txt v="sm" testID="rating-change">
          {L.ratingChange}
          <Txt v="sm" bold>
            {signedNum(gain)}
          </Txt>
        </Txt>
      ) : null}
      <Grid2>
        <Btn block onPress={toTeam} testID="team-result-team">
          {backLabel}
        </Btn>
        <Btn block onPress={replay} testID="team-replay">
          {L.replay}
        </Btn>
        <Btn
          block
          kind="primary"
          onPress={again}
          disabled={!friendly && matchesLeft === 0}
          testID="team-again"
        >
          {L.again}
        </Btn>
      </Grid2>
    </Card>
  );
}
