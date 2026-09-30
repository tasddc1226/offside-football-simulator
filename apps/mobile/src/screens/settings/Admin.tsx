// T-10-016 운영 도구(관리자 전용, 웹 Admin.svelte). 관리자 여부는 서버가 요청마다 다시 확인한다 — 여기서는 화면만 가린다.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { fetchBoardViewer } from '@offside/app-core/api/boards';
import { appState } from '../../store';
import { BackBar } from '../../ui/ActionBar';
import { Card } from '../../ui/Card';
import { Screen } from '../../ui/Screen';
import { Topbar } from '../../ui/Topbar';
import { Txt } from '../../ui/Txt';
import { Seg, TabOpt } from '../board/parts';
import AdminAutomation from './admin/AdminAutomation';
import AdminBalance from './admin/AdminBalance';
import AdminComments from './admin/AdminComments';
import AdminNameReports from './admin/AdminNameReports';
import AdminDashboard from './admin/AdminDashboard';

const TABS = [
  { id: 'dashboard', label: '대시보드' },
  { id: 'comments', label: '신고·댓글' },
  { id: 'balance', label: '밸런스' },
  { id: 'automation', label: '자동 플레이' },
] as const;

export default function Admin() {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('dashboard');
  const [admin, setAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    let live = true;
    void fetchBoardViewer().then((r) => live && setAdmin(r.ok && r.data.admin));
    return () => {
      live = false;
    };
  }, []);

  return (
    <Screen footer={<BackBar testID="owner" fallback={() => (appState.screen = 'owner')} />}>
      <Topbar />
      <Card gap={14}>
        <View>
          <Txt v="eyebrow">Admin</Txt>
          <Txt v="h1" accessibilityRole="header">
            운영 도구
          </Txt>
        </View>
        {admin === null ? (
          <Txt tone="muted" accessibilityLiveRegion="polite">
            확인하는 중…
          </Txt>
        ) : !admin ? (
          <Txt tone="muted">운영자 계정으로 로그인해야 볼 수 있어요.</Txt>
        ) : (
          <>
            <Seg cols={TABS.length} label="운영 도구">
              {TABS.map((t) => (
                <TabOpt
                  key={t.id}
                  tight
                  title={t.label}
                  selected={tab === t.id}
                  testID={`admin-tab-${t.id}`}
                  onPress={() => setTab(t.id)}
                />
              ))}
            </Seg>
            {tab === 'dashboard' ? (
              <AdminDashboard />
            ) : tab === 'comments' ? (
              <>
                <AdminNameReports />
                <AdminComments />
              </>
            ) : tab === 'automation' ? (
              <AdminAutomation />
            ) : (
              <AdminBalance />
            )}
          </>
        )}
      </Card>
    </Screen>
  );
}
