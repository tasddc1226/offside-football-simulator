// 경기 결과(웹 team/Team.svelte 의 view === 'result', 중계가 끝난 뒤) — 스코어 · 득점 · 레이팅 변화.
import { View } from 'react-native';
import { TeamLogo } from '../../components/TeamLogo';
import type { OwnerTeam, TeamMatch } from '@offside/app-core/api/team';
import { kstMonthDayTime } from '@offside/app-core/boardText';
import { OUTCOME_TITLE, outcomeOf } from '@offside/app-core/teamOwner';
import { teamMatchText as L } from '@offside/app-core/i18n/ko/teamMatch';
import { recordText, signedNum } from '@offside/app-core/teamText';
import { DISPLAY, rem } from '../../theme/type';
import { Btn, Card, Press, Txt } from '../../ui';
import { Grid2 } from './TeamParts';
import { DivisionEmblem } from '../../components/DivisionEmblem';
import { divisionShiftView, type DivisionShift } from '@offside/app-core/teamDivision';
import { useColors } from '../../theme/useColors';

export function TeamResult({
  m,
  team,
  shift = null,
  eventName,
  matchesLeft,
  toTeam,
  replay,
  again,
  backLabel = L.backDefaultApp,
  onPlayer,
}: {
  m: TeamMatch;
  team: OwnerTeam | null;
  /** T-11-375 방금 치른 경기의 디비전 전후(기록에서 연 경기는 null). */
  shift?: DivisionShift | null;
  eventName: (id: string | null, fallback: string) => string;
  matchesLeft: number;
  toTeam: () => void;
  replay: () => void;
  again: () => void;
  backLabel?: string;
  /** T-11-269 우리 선수 이름을 누르면 시즌 통계의 그 선수 줄로(랭크 경기만, 웹 TeamResult onplayer). */
  onPlayer?: (careerId: string) => void;
}) {
  const friendly = !!m.friendly;
  const linkable = (id: string | null): id is string => !!onPlayer && !friendly && !!id;
  const under = { textDecorationLine: 'underline' } as const;
  const gain = m[m.mine].ratingChange;
  const c = useColors();
  const moved = friendly ? null : divisionShiftView(shift);
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
      {moved ? (
        <View
          accessibilityLiveRegion="polite"
          testID={`division-shift-${moved.up ? 'up' : 'down'}`}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            padding: 12,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: moved.up ? c.accent : c.line,
            backgroundColor: c.surface2,
          }}
        >
          <DivisionEmblem division={moved.division} size={44} />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Txt bold tone={moved.up ? 'accent' : 'bad'}>
              {moved.title}
            </Txt>
            <Txt v="sm" tone="muted">
              {moved.body}
            </Txt>
          </View>
        </View>
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
