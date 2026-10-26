// 기록실(하단 메뉴, 웹 Hof.svelte) — 명예의 전당 전체 보기(100명씩 페이지 → 앱은 10명씩)와 영구결번(T-10-076), 라이브 랭킹(팀 랭킹,
// T-10-092), 구단주 랭킹(T-11-028), 시즌 BEST 11(T-11-463)을 탭으로 오간다. 팀 프로필에서는 뒤로 가기(T-11-213 스와이프·Android 뒤로)로 돌아온다.
import { useSnapshot } from 'valtio';
import type { HofTab } from '@offside/app-core/state';
import { AdSlot } from '../../components/AdSlot';
import { HallOfFame } from '../../components/HallOfFame';
import { appState } from '../../store';
import { Screen } from '../../ui/Screen';
import { Topbar } from '../../ui/Topbar';
import { View } from 'react-native';
import { Press } from '../../ui/Press';
import { Txt } from '../../ui/Txt';
import { useColors } from '../../theme/useColors';
import { RECORDS_TOUCH } from './RecordsControls';
import RetiredWall from './RetiredWall';
import { hofText as L } from '@offside/app-core/i18n/ko/hof';
import { best11Text as B } from '@offside/app-core/i18n/ko/best11';
import Best11 from './Best11';
import AchievementRanking from './team/AchievementRanking';
import TeamRanking from './team/TeamRanking';

// 문구는 그릴 때 읽어야 해서(언어 등록 뒤) 함수로 둔다.
const tabs = (): Record<HofTab, string> => ({
  legends: L.tabLegends,
  best11: B.tab,
  rn: L.tabRn,
  teams: L.tabTeams,
  ach: L.tabAch,
});

export default function Hof() {
  const c = useColors();
  const { hof } = useSnapshot(appState);
  return (
    <Screen>
      <Topbar />
      <View
        accessibilityRole="tablist"
        accessibilityLabel={L.tabsLabel}
        style={{
          flexDirection: 'row',
          marginBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: c.line,
        }}
      >
        {(Object.entries(tabs()) as [HofTab, string][]).map(([key, label]) => (
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
      ) : hof.tab === 'best11' ? (
        <Best11 />
      ) : hof.tab === 'teams' ? (
        <>
          <TeamRanking />
          {hof.team ? null : <AdSlot place="records-bottom" />}
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
