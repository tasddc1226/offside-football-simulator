// 레이아웃 라우트(SCR ID 없음). loader가 useCareer 데이터를 준비하고, 커리어가 없으면 notFound().
// 깊은 링크가 커리어 단계와 맞지 않을 때의 리다이렉트는 각 화면 작업이 screenForCareer로 처리한다.
import { createFileRoute, notFound, Outlet } from '@tanstack/react-router';
import { careerQueryOptions } from '../engine/use-career.js';
import { queryClient } from '../shared/query-client.js';

export const Route = createFileRoute('/career/$careerId')({
  loader: async ({ params }) => {
    try {
      await queryClient.ensureQueryData(careerQueryOptions(params.careerId));
    } catch {
      throw notFound();
    }
  },
  component: () => <Outlet />,
});
