// SCR-007 첫 진로 선택. 기존 공통 진로와 배경별 도입 사건에서 범용 이벤트 화면 위에 정찰 범위와
// 실제 previewEffects 비교 카드를 더한다. 확정 로직은 SCR-013과 동일(EventDecisionScreen).
import { CompareCards, type CompareRow } from '@offside/ui';
import { createFileRoute, redirect } from '@tanstack/react-router';
import type { EventDefinition } from '@offside/content';
import { careerQueryOptions } from '../engine/use-career.js';
import { EventDecisionScreen, type EventDecisionContext } from '../shared/event-screen.js';
import { screenForCareer } from '../shared/career-route.js';
import { queryClient } from '../shared/query-client.js';
import { SCREEN_ROUTES } from '../routes.js';

export const Route = createFileRoute('/career/$careerId/path')({
  loader: async ({ params }) => {
    const { state } = await queryClient.ensureQueryData(careerQueryOptions(params.careerId));
    const target = screenForCareer(state);
    if (target.screenId !== 'SCR-007') {
      throw redirect({ to: SCREEN_ROUTES[target.screenId], params: target.params });
    }
  },
  component: PathScreen,
});

const CAPTION_STYLE = {
  fontSize: 'var(--os-fs-caption)',
  lineHeight: 'var(--os-lh-caption)',
} as const;

/** 기존 공통 진로 사건의 제안 범위만 콘텐츠 밖의 확정된 분기표를 사용한다. 배경별 신규 사건은
 * 계약을 약속하지 않으므로 각 선택지에 실제로 정의된 previewEffects만 그대로 비교한다. */
const OFFER_RANGE_BY_CHOICE: Record<string, string> = {
  A: '입단 테스트 결과에 따라 1~3부',
  B: '유스 잔류 계약 1건(고정)',
  C: '2부·3부',
};

function buildCompareRows(definition: EventDefinition): CompareRow[] {
  const choices = definition.choices;
  const previewCount = Math.max(0, ...choices.map((choice) => choice.previewEffects.length));
  const rows: CompareRow[] = Array.from({ length: previewCount }, (_, index) => ({
    id: `preview-${index}`,
    label: `예상 영향 ${index + 1}`,
    cells: choices.map((choice) => ({
      value: choice.previewEffects[index]?.label ?? '추가 영향 없음',
    })),
  }));
  if (definition.id === 'EVT-CON-002') {
    rows.push({
      id: 'offer-range',
      label: '제안 범위',
      cells: choices.map((choice) => ({ value: OFFER_RANGE_BY_CHOICE[choice.id] ?? '정보 없음' })),
    });
  }
  return rows;
}

function renderAbove({ state, definition }: EventDecisionContext) {
  const profile = state.player.profile;
  const scoutRange =
    profile === null ? '—' : `${profile.scoutedPotentialMin}~${profile.scoutedPotentialMax}`;

  return (
    <section className="os-panel flex flex-col gap-os-4" aria-label="진로 선택 참고">
      <div className="flex items-center justify-between gap-os-3">
        <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
          정찰 범위 {scoutRange}
        </p>
        <span className="os-eyebrow">스카우트 리포트</span>
      </div>
      <details>
        <summary className="cursor-pointer font-os font-semibold text-os-text">
          진로별 조건 비교
        </summary>
        <div className="mt-os-4">
          <CompareCards
            cards={definition.choices.map((choice) => ({ id: choice.id, title: choice.label }))}
            rows={buildCompareRows(definition)}
          />
        </div>
      </details>
    </section>
  );
}

function PathScreen() {
  const { careerId } = Route.useParams();
  return <EventDecisionScreen careerId={careerId} screenId="SCR-007" renderAbove={renderAbove} />;
}
