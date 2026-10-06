// T-11-129 홈의 구단 가치 TOP 3(웹 HomeClubValue.svelte). 선발 11명 카드 기준가 합으로 센 라이브 랭킹 첫 페이지(sort=value)를
// 그대로 쓰고(기록실 팀 랭킹과 같은 메모), 줄을 누르면 기록실 팀 랭킹에서 그 팀 프로필을 연다.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { fetchTeamRanking, type TeamRankResponse } from '@offside/app-core/api/team';
import { fmtValue } from '@offside/app-core/format';
import { hofStart } from '@offside/app-core/state';
import { teamAchText as L } from '@offside/app-core/i18n/ko/teamAch';
import { RankBadge } from '../../components/Laurel';
import { TeamLogo } from '../../components/TeamLogo';
import { go } from '../../game/nav';
import { appState } from '../../store';
import { rem } from '../../theme/type';
import { useColors } from '../../theme/useColors';
import { Btn, Card, Press, Txt } from '../../ui';
import { useRefresh } from '../../ui/refresh';

const TOP = 3;

function openRanking(team: string | null = null) {
  appState.hof = { ...hofStart(), tab: 'teams', teamSort: 'value', team };
  go('hof');
}

export function HomeClubValue() {
  const c = useColors();
  const [rows, setRows] = useState<TeamRankResponse['items'] | null>(null);
  const [failed, setFailed] = useState(false);
  const { tick, track } = useRefresh();

  useEffect(() => {
    let live = true;
    setFailed(false);
    void track(fetchTeamRanking(undefined, 'value', 1)).then((r) => {
      if (!live) return;
      if (r.ok) setRows(r.data.items.filter((t) => t.value > 0).slice(0, TOP));
      else setFailed(true);
    });
    return () => {
      live = false;
    };
  }, [tick, track]);

  const note = (text: string) => (
    <Txt tone="muted" style={{ fontSize: rem(0.875), paddingVertical: 8 }}>
      {text}
    </Txt>
  );
  return (
    <Card gap={0}>
      <View
        testID="home-club-value"
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <View style={{ flex: 1 }}>
          <Txt v="eyebrow">Clubs</Txt>
          <Txt v="h2" accessibilityRole="header">
            {L.homeValueTitle}
          </Txt>
          <Txt tone="muted" style={{ fontSize: rem(0.8125), marginBottom: 8 }}>
            {L.homeValueSub}
          </Txt>
        </View>
        <Btn sm testID="club-value-all" onPress={() => openRanking()}>
          {L.homeValueAll}
        </Btn>
      </View>
      {failed
        ? note(L.rankFail)
        : rows === null
          ? note(L.loading)
          : rows.length === 0
            ? note(L.homeValueEmpty)
            : rows.map((t, i) => {
                const value = fmtValue(t.value);
                const [head, sub] = value.split(' ');
                return (
                  <Press
                    key={t.teamId}
                    scale={0.985}
                    testID={`club-value-${t.teamId}`}
                    accessibilityLabel={L.homeValueRowAria({
                      rank: i + 1,
                      name: t.name,
                      manager: t.manager,
                      value,
                    })}
                    onPress={() => openRanking(t.teamId)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      paddingVertical: 10,
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderTopColor: c.line,
                    }}
                  >
                    <RankBadge rank={i + 1} />
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <TeamLogo logo={t.logo} name={t.name} size={20} decorative />
                        <Txt bold numberOfLines={1} style={{ flexShrink: 1 }}>
                          {t.name}
                        </Txt>
                      </View>
                      <Txt tone="muted" numberOfLines={1} style={{ fontSize: rem(0.75) }}>
                        {`${L.profManager}${t.manager} · OVR ${t.ovr}`}
                      </Txt>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Txt num numberOfLines={1} style={{ fontSize: rem(1.0625) }}>
                        {head}
                      </Txt>
                      {sub ? (
                        <Txt tone="muted" numberOfLines={1} style={{ fontSize: rem(0.75) }}>
                          {sub}
                        </Txt>
                      ) : null}
                    </View>
                  </Press>
                );
              })}
    </Card>
  );
}
