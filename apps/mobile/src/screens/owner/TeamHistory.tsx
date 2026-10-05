// 최근 경기(웹 team/Team.svelte 의 view === 'history') — 누르면 그 경기 결과로.
import { View } from 'react-native';
import { TeamLogo } from '../../components/TeamLogo';
import type { TeamMatch } from '@offside/app-core/api/team';
import { kstMonthDayTime } from '@offside/app-core/boardText';
import { outcomeOf } from '@offside/app-core/teamOwner';
import { LoadState, type LoadStatus } from '../../components/LoadState';
import { useColors } from '../../theme/useColors';
import { Card, Press, Txt } from '../../ui';

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
          {out}
        </Txt>
      </View>
      <TeamLogo logo={opp.logo} name={opp.name} size={28} decorative />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Txt bold>{`${m[m.mine].goals} : ${opp.goals} ${opp.name}`}</Txt>
        <Txt tone="muted" v="sm">
          {`${m.friendly ? '친선전' : m.mine === 'home' ? '도전' : '도전받음'} · ${opp.owner} · ${kstMonthDayTime(m.createdAt)}`}
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
}: {
  history: TeamMatch[];
  status: LoadStatus;
  reload: () => void;
  open: (m: TeamMatch) => void;
}) {
  return (
    <Card gap={12}>
      <View>
        <Txt v="eyebrow">Matches</Txt>
        <Txt v="h1" accessibilityRole="header">
          최근 경기
        </Txt>
      </View>
      <LoadState status={status} failText="경기 기록을 불러오지 못했어요." retry={reload}>
        {history.length ? (
          history.map((m) => <MatchRow key={m.id} m={m} open={open} />)
        ) : (
          <Txt tone="muted">아직 치른 경기가 없어요.</Txt>
        )}
      </LoadState>
    </Card>
  );
}
