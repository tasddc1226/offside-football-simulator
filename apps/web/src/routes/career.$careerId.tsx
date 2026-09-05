// 레이아웃 라우트(SCR ID 없음). loader가 useCareer 데이터를 준비하고, 커리어가 없으면 notFound().
// 깊은 링크가 커리어 단계와 맞지 않을 때의 리다이렉트는 각 화면 작업이 screenForCareer로 처리한다.
// T-1-011: 이 커리어의 동기화 배지·충돌 대화상자를 여기 둔다(모든 하위 화면이 공유).
import { useState } from 'react';
import { createFileRoute, notFound, Outlet, useRouterState } from '@tanstack/react-router';
import { Toast } from '@offside/ui';
import { careerQueryOptions } from '../engine/use-career.js';
import { useSyncState } from '../engine/use-sync.js';
import { queryClient } from '../shared/query-client.js';
import { SyncBadge } from '../shared/SyncBadge.js';
import { SyncConflictDialog, type SyncToast } from '../shared/SyncConflictDialog.js';

export const Route = createFileRoute('/career/$careerId')({
  loader: async ({ params }) => {
    try {
      await queryClient.ensureQueryData(careerQueryOptions(params.careerId));
    } catch {
      throw notFound();
    }
  },
  component: CareerLayout,
});

function CareerLayout() {
  const { careerId } = Route.useParams();
  const syncState = useSyncState(careerId);
  const isPlayerForm = useRouterState({ select: (state) => state.location.pathname.endsWith('/create') });
  const [toast, setToast] = useState<SyncToast | null>(null);

  return (
    <div className="flex flex-col gap-os-3">
      <div className="flex flex-wrap items-center justify-end gap-os-2">
        {isPlayerForm ? (
          <span className="font-os text-os-text-2" style={{ fontSize: 'var(--os-fs-caption)' }}>
            저장한 기록
          </span>
        ) : null}
        <SyncBadge state={syncState} />
      </div>
      <Outlet />
      <SyncConflictDialog careerId={careerId} state={syncState} onToast={setToast} />
      {toast ? <Toast variant={toast.variant} message={toast.message} onDismiss={() => setToast(null)} /> : null}
    </div>
  );
}
