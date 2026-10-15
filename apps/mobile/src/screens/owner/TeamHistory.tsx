// 기록 탭(웹 team/TeamHistory.svelte) — 맨 위 시즌 통계 카드(T-11-269)와 경기 목록. 경기를 누르면 그 경기 결과로,
// '더 보기'로 지난 경기를 이어 받는다.
import { View } from 'react-native';
import { TeamLogo } from '../../components/TeamLogo';
import type { TeamMatch, TeamRecord } from '@offside/app-core/api/team';
import { kstMonthDayTime } from '@offside/app-core/boardText';
import { outcomeLabel, outcomeOf } from '@offside/app-core/teamOwner';
import { teamMatchText as L } from '@offside/app-core/i18n/ko/teamMatch';
import { recordText } from '@offside/app-core/teamText';
import { LoadState, type LoadStatus } from '../../components/LoadState';
import { useColors } from '../../theme/useColors';
import { Btn, Card, Press, Txt } from '../../ui';

/** 경기 한 줄(최근 경기 · 친선전 목록이 같이 쓴다). 친선전은 '도전' 대신 '친선전'으로 적는다. */
export function MatchRow({ m, open }: { m: TeamMatch; open: (m: TeamMatch) => void }) {
  const c = useColors();
  const opp = m[m.mine === 'home' ? 'away' : 'home'];
  const out = outcomeOf(m);
  return (
    <Press
      scale={0.985}
      testID={`team-match-${m.id}`}
      onPress={() => open(m)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: c.line,
        minHeight: 52,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          backgroundColor: c.surface2,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Txt bold style={{ color: out === '승' ? c.good : out === '패' ? c.bad : c.ink }}>
          {outcomeLabel(out)}
        </Txt>
      </View>
      <TeamLogo logo={opp.logo} name={opp.name} size={28} decorative />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Txt bold>{`${m[m.mine].goals} : ${opp.goals} ${opp.name}`}</Txt>
        <Txt tone="muted" v="sm">
          {`${m.friendly ? L.kindFriendly : m.mine === 'home' ? L.kindChallenge : L.kindChallenged} · ${opp.owner} · ${kstMonthDayTime(m.createdAt)}`}
        </Txt>
      </View>
    </Press>
  );
}

export function TeamHistory({
  history,
  status,
  reload,
  open,
  record,
  seasonName,
  more,
  moreStatus,
  onMore,
  onStats,
}: {
  history: TeamMatch[];
  status: LoadStatus;
  reload: () => void;
  open: (m: TeamMatch) => void;
  record: TeamRecord | null;
  seasonName: string;
  more: boolean;
  moreStatus: 'idle' | 'loading' | 'error';
  onMore: () => void;
  onStats: () => void;
}) {
  return (
    <>
      <Press scale={0.985} testID="team-stats" accessibilityLabel={L.statsOpen} onPress={onStats}>
        <Card gap={12} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Txt v="eyebrow">Stats</Txt>
            <Txt bold>{L.statsCardTitle}</Txt>
            {record ? (
              <Txt v="sm">
                {L.statsCardRecord({ season: seasonName, record: recordText(record) })}
              </Txt>
            ) : null}
            <Txt tone="muted" v="sm">
              {L.statsCardLead}
            </Txt>
          </View>
          <Txt tone="muted" style={{ fontSize: 24 }}>
            ›
          </Txt>
        </Card>
      </Press>
      <Card gap={12}>
        <View>
          <Txt v="eyebrow">Matches</Txt>
          <Txt v="h1" accessibilityRole="header">
            {L.historyTitle}
          </Txt>
        </View>
        <LoadState status={status} failText={L.historyFail} retry={reload}>
          {history.length ? (
            history.map((m) => <MatchRow key={m.id} m={m} open={open} />)
          ) : (
            <Txt tone="muted">{L.historyEmpty}</Txt>
          )}
          {more ? (
            <View style={{ gap: 6, marginTop: 4 }}>
              {moreStatus === 'error' ? (
                <Txt tone="muted" v="sm" accessibilityRole="alert">
                  {L.historyMoreFail}
                </Txt>
              ) : null}
              <Btn testID="team-history-more" disabled={moreStatus === 'loading'} onPress={onMore}>
                {moreStatus === 'loading' ? L.historyMoreLoading : L.historyMore}
              </Btn>
            </View>
          ) : null}
        </LoadState>
      </Card>
    </>
  );
}
