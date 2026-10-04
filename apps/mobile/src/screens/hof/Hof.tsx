// 기록실(하단 메뉴, 웹 Hof.svelte) — 명예의 전당 전체 보기(100명씩 페이지 → 앱은 10명씩)와 영구결번(T-10-076), 라이브 랭킹(팀 랭킹,
// T-10-092), 구단주 랭킹(T-11-028)을 탭으로 오간다. 팀 프로필을 열면 아래 고정 막대에 '← 이전으로'(웹 TeamProfile의 BackBar, 탭바 위)를 둔다.
import { useSnapshot } from 'valtio';
import type { HofTab } from '@offside/app-core/state';
import { AdSlot } from '../../components/AdSlot';
import { HallOfFame } from '../../components/HallOfFame';
import { appState } from '../../store';
import { BackBar } from '../../ui/ActionBar';
import { Screen } from '../../ui/Screen';
import { Topbar } from '../../ui/Topbar';
import { View } from 'react-native';
import { Press } from '../../ui/Press';
import { Txt } from '../../ui/Txt';
import { useColors } from '../../theme/useColors';
import { RECORDS_TOUCH } from './RecordsControls';
import RetiredWall from './RetiredWall';
import AchievementRanking from './team/AchievementRanking';
import TeamRanking from './team/TeamRanking';

const TABS: Record<HofTab, string> = {
  legends: '명예의 전당',
  rn: '영구결번',
  teams: '팀 랭킹',
  ach: '구단주 랭킹',
};

export default function Hof() {
  const c = useColors();
  const { hof } = useSnapshot(appState);
  const profile = hof.tab === 'teams' && !!hof.team;
  return (
    <Screen
      footer={
        profile ? (
          <BackBar
            testID="team-profile-back"
            fallback={() => (appState.hof = { ...appState.hof, team: null })}
          />
        ) : undefined
      }
    >
      <Topbar />
      <View
        accessibilityRole="tablist"
        accessibilityLabel="기록실"
        style={{
          flexDirection: 'row',
          marginBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: c.line,
        }}
      >
        {(Object.entries(TABS) as [HofTab, string][]).map(([key, label]) => (
          <Press
            key={key}
            testID={`hof-tab-${key}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: hof.tab === key }}
            scale={1}
            onPress={() => {
              appState.hof.tab = key;
            }}
            style={{
              flex: 1,
              minHeight: RECORDS_TOUCH,
              justifyContent: 'center',
              paddingVertical: 10,
              borderBottomWidth: 2,
              borderBottomColor: hof.tab === key ? c.tabOn : 'transparent',
            }}
          >
            <Txt
              center
              style={{
                fontSize: 12,
                fontWeight: hof.tab === key ? '700' : '500',
                color: hof.tab === key ? c.ink : c.muted,
              }}
            >
              {label}
            </Txt>
          </Press>
        ))}
      </View>
      {hof.tab === 'rn' ? (
        <RetiredWall />
      ) : hof.tab === 'teams' ? (
        <>
          <TeamRanking />
          {profile ? null : <AdSlot place="records-bottom" />}
        </>
      ) : hof.tab === 'ach' ? (
        <AchievementRanking />
      ) : (
        <>
          <HallOfFame full />
          <AdSlot place="records-bottom" />
        </>
      )}
    </Screen>
  );
}
