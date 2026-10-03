// 기록실(하단 메뉴, 웹 Hof.svelte) — 명예의 전당 전체 보기(100명씩 페이지 → 앱은 10명씩)와 영구결번(T-10-076), 라이브 랭킹(팀 랭킹,
// T-10-092), 구단주 랭킹(T-11-028)을 탭으로 오간다. 팀 프로필을 열면 아래 고정 막대에 '← 이전으로'(웹 TeamProfile의 BackBar, 탭바 위)를 둔다.
import { useSnapshot } from 'valtio';
import type { HofTab } from '@offside/app-core/state';
import { HallOfFame } from '../../components/HallOfFame';
import { appState } from '../../store';
import { BackBar } from '../../ui/ActionBar';
import { Screen } from '../../ui/Screen';
import { Topbar } from '../../ui/Topbar';
import { Seg, TabOpt } from '../board/parts';
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
      <Seg cols={4} label="기록실" style={{ marginBottom: 12 }}>
        {(Object.entries(TABS) as [HofTab, string][]).map(([k, label]) => (
          <TabOpt
            key={k}
            title={label}
            selected={hof.tab === k}
            testID={`hof-tab-${k}`}
            fit
            onPress={() => (appState.hof.tab = k)}
          />
        ))}
      </Seg>
      {hof.tab === 'rn' ? (
        <RetiredWall />
      ) : hof.tab === 'teams' ? (
        <TeamRanking />
      ) : hof.tab === 'ach' ? (
        <AchievementRanking />
      ) : (
        <HallOfFame full />
      )}
    </Screen>
  );
}
