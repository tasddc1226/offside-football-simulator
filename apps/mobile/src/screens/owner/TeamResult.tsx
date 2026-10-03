// 경기 결과(웹 team/Team.svelte 의 view === 'result', 중계가 끝난 뒤) — 스코어 · 득점 · 레이팅 변화.
import { View } from 'react-native';
import type { OwnerTeam, TeamMatch } from '@offside/app-core/api/team';
import { kstMonthDayTime } from '@offside/app-core/boardText';
import { OUTCOME_TITLE, outcomeOf } from '@offside/app-core/teamOwner';
import { recordText, signedNum } from '@offside/app-core/teamText';
import { DISPLAY, rem } from '../../theme/type';
import { Btn, Card, Txt } from '../../ui';
import { Grid2 } from './TeamParts';

export function TeamResult({
  m,
  team,
  eventName,
  matchesLeft,
  toTeam,
  replay,
  again,
  backLabel = '내 팀',
}: {
  m: TeamMatch;
  team: OwnerTeam | null;
  eventName: (id: string | null, fallback: string) => string;
  matchesLeft: number;
  toTeam: () => void;
  replay: () => void;
  again: () => void;
  backLabel?: string;
}) {
  const gain = m[m.mine].ratingChange;
  const side = (s: TeamMatch['home'], away: boolean, mine: boolean) => (
    <View style={{ flex: 1, minWidth: 0, gap: 2, alignItems: away ? 'flex-end' : 'flex-start' }}>
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
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {side(m.home, false, m.mine === 'home')}
        <View
          accessible
          accessibilityLabel={`${m.home.goals} 대 ${m.away.goals}`}
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
                <Txt bold>{eventName(e.scorerId, e.scorer)}</Txt>
                {e.assist ? (
                  <Txt tone="muted" v="xs">{`도움 ${eventName(e.assistId, e.assist)}`}</Txt>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      ) : (
        <Txt tone="muted">골 없이 비겼어요.</Txt>
      )}
      <Txt tone="muted" v="sm">
        {`${kstMonthDayTime(m.createdAt)}${team && m.mine === 'home' ? ` · 내 팀 ${recordText(team.record)}` : ''}`}
      </Txt>
      {gain != null ? (
        <Txt v="sm" testID="rating-change">
          {'내 팀 레이팅 '}
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
          중계 다시 보기
        </Btn>
        <Btn block kind="primary" onPress={again} disabled={matchesLeft === 0} testID="team-again">
          다시 경기하기
        </Btn>
      </Grid2>
    </Card>
  );
}
