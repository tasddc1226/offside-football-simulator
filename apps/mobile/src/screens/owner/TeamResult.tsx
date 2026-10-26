// 경기 결과(웹 team/Team.svelte 의 view === 'result', 중계가 끝난 뒤) — 스코어 · 득점 · 레이팅 변화.
// T-11-498 위 띠에 승패 · 스코어 · 팀별 득점자를 모으고, 레이팅 · 전적은 그 아래 칩으로, 다시 경기하기 하나만 크게 둔다.
import { FONT, RADIUS } from '@offside/app-core/design-tokens';
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
import { TeamReport } from './TeamReport';
import type { ReportLine } from '@offside/contracts/owner-team';
import { DivisionEmblem } from '../../components/DivisionEmblem';
import { divisionShiftView, type DivisionShift } from '@offside/app-core/teamDivision';

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
  fix,
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
  /** T-11-379 리포트 '고칠 곳' — 내 편성을 고칠 수 있을 때만(웹 TeamResult fix). */
  fix?: ((line: ReportLine) => { pos: string; go: () => void } | null) | undefined;
}) {
  const c = useColors();
  const friendly = !!m.friendly;
  const linkable = (id: string | null): id is string => !!onPlayer && !friendly && !!id;
  const under = { textDecorationLine: 'underline' } as const;
  const gain = m[m.mine].ratingChange;
  const moved = friendly ? null : divisionShiftView(shift);
  const won = outcomeOf(m) === '승'; // i18n-ignore 결과 키
  const record = team && !friendly && m.mine === 'home' ? recordText(team.record) : null;
  const soft = { color: c.onPitch, opacity: 0.72 } as const;
  const side = (s: TeamMatch['home'], mine: boolean) => (
    <View style={{ flex: 1, minWidth: 0, gap: 2, alignItems: 'center' }}>
      <TeamLogo logo={s.logo} name={s.name} size={52} decorative />
      <Txt
        bold
        style={{ textAlign: 'center', marginTop: 4, color: mine ? c.pitchAccent : c.onPitch }}
      >
        {s.name}
      </Txt>
      <Txt v="xs" style={[soft, { textAlign: 'center' }]}>
        {s.owner}
      </Txt>
      <Txt v="xs" style={soft}>{`OVR ${s.ovr}`}</Txt>
    </View>
  );
  const goal = (n: number, mine: boolean) => (
    <Txt
      style={{
        fontFamily: DISPLAY[700],
        fontSize: rem(3.5),
        lineHeight: rem(3.5),
        color: mine ? c.pitchAccent : c.onPitch,
      }}
    >
      {n}
    </Txt>
  );
  const scorers = (s: 'home' | 'away') => {
    const end = s === 'away';
    return (
      <View style={{ flex: 1, minWidth: 0, gap: 6, alignItems: end ? 'flex-end' : 'flex-start' }}>
        {m.events
          .filter((e) => e.side === s)
          .map((e, k) => (
            <View key={k} style={{ alignItems: end ? 'flex-end' : 'flex-start' }}>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  alignItems: 'baseline',
                  justifyContent: end ? 'flex-end' : 'flex-start',
                  columnGap: 5,
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
                    <Txt v="sm" bold style={[under, { color: c.onPitch }]}>
                      {eventName(e.scorerId, e.scorer)}
                    </Txt>
                  </Press>
                ) : (
                  <Txt v="sm" bold style={{ color: c.onPitch }}>
                    {eventName(e.scorerId, e.scorer)}
                  </Txt>
                )}
                {e.slot ? (
                  <Txt v="xs" style={soft} testID="team-slot">
                    {e.slot}
                  </Txt>
                ) : null}
                <Txt v="sm" style={[soft, { fontFamily: DISPLAY[700] }]}>{`${e.minute}'`}</Txt>
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
                    <Txt v="xs" style={[soft, under]}>
                      {L.assist({ name: eventName(e.assistId, e.assist) })}
                    </Txt>
                  </Press>
                ) : (
                  <Txt v="xs" style={soft}>
                    {L.assist({ name: eventName(e.assistId, e.assist) })}
                  </Txt>
                )
              ) : null}
            </View>
          ))}
      </View>
    );
  };
  const chip = (text: string, accent = false, testID?: string) => (
    <View
      testID={testID}
      style={{
        minHeight: 28,
        justifyContent: 'center',
        paddingHorizontal: 10,
        borderRadius: RADIUS.pill,
        borderWidth: 1,
        borderColor: accent ? c.accent : c.line,
        backgroundColor: c.surface2,
      }}
    >
      <Txt v="sm" tone={accent ? 'accent' : 'muted'} bold={accent}>
        {text}
      </Txt>
    </View>
  );
  return (
    <Card gap={14}>
      <View
        testID="team-result"
        style={{
          gap: 14,
          padding: 14,
          paddingTop: 18,
          borderRadius: RADIUS.md,
          backgroundColor: c.pitch,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          <Txt v="eyebrow" style={soft}>
            {friendly ? `Full time · ${L.kindFriendly}` : 'Full time'}
          </Txt>
          <Txt v="xs" style={soft}>
            {kstMonthDayTime(m.createdAt)}
          </Txt>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {side(m.home, m.mine === 'home')}
          <View style={{ alignItems: 'center', gap: 2 }}>
            <Txt
              accessibilityRole="header"
              style={{
                fontFamily: DISPLAY[700],
                fontSize: rem(FONT.title2),
                color: won ? c.pitchAccent : c.onPitch,
              }}
            >
              {OUTCOME_TITLE[outcomeOf(m)]}
            </Txt>
            <View
              accessible
              accessibilityLabel={L.scoreAria({ h: m.home.goals, a: m.away.goals })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
            >
              {goal(m.home.goals, m.mine === 'home')}
              <Txt
                accessible={false}
                style={[soft, { fontFamily: DISPLAY[700], fontSize: rem(2.5) }]}
              >
                :
              </Txt>
              {goal(m.away.goals, m.mine === 'away')}
            </View>
          </View>
          {side(m.away, m.mine === 'away')}
        </View>
        {m.events.length ? (
          <View
            style={{
              flexDirection: 'row',
              gap: 12,
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: c.chalk,
            }}
          >
            {scorers('home')}
            {scorers('away')}
          </View>
        ) : (
          <Txt v="sm" style={[soft, { textAlign: 'center' }]}>
            {L.noGoals}
          </Txt>
        )}
      </View>
      {friendly ? (
        <View style={{ flexDirection: 'row' }} testID="team-friendly-label">
          {chip(L.friendlyNote)}
        </View>
      ) : gain != null || record ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {gain != null ? chip(`${L.ratingChange}${signedNum(gain)}`, true, 'rating-change') : null}
          {record ? chip(L.recordChip({ record })) : null}
        </View>
      ) : null}
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
      <TeamReport m={m} fix={fix} />
      <View style={{ gap: 6 }}>
        <Btn
          block
          kind="primary"
          onPress={again}
          disabled={!friendly && matchesLeft === 0}
          testID="team-again"
          style={{ minHeight: 56 }}
        >
          {friendly
            ? L.again
            : `${L.again} · ${matchesLeft > 0 ? L.againLeft({ n: matchesLeft }) : L.againNone}`}
        </Btn>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <View style={{ flex: 1 }}>
            <Btn block kind="ghost" onPress={replay} testID="team-replay">
              {L.replay}
            </Btn>
          </View>
          <View style={{ flex: 1 }}>
            <Btn block kind="ghost" onPress={toTeam} testID="team-result-team">
              {backLabel}
            </Btn>
          </View>
        </View>
      </View>
    </Card>
  );
}
