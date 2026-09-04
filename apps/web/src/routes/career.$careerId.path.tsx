// SCR-007 졸업 후 진로 선택. EVT-CON-002 전용 변형: 범용 이벤트 화면 위에 정찰 범위와 세 경로
// 비교 카드를 더한다. 확정 로직은 SCR-013과 동일(EventDecisionScreen).
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

/** EVT-CON-002 전용 데이터: previewEffects는 A·B는 "성장→출전" 순서지만 C는 순서가 다르고
 * "성장 기대" 줄이 아예 없다(콘텐츠 확인 사항, PR 본문에 기록). 제안 범위는 previewEffects에
 * 없어 phase-1-plan.md D-9 분기표(진로 태그 → offerRules)에서 가져온다. */
const OFFER_RANGE_BY_CHOICE: Record<string, string> = {
  A: '입단 테스트 결과에 따라 1~3부',
  B: '유스 잔류 계약 1건(고정)',
  C: '2부·3부',
};

function pickByKeyword(labels: string[], keyword: string): string {
  return labels.find((label) => label.includes(keyword)) ?? '정보 없음';
}

function buildCompareRows(definition: EventDefinition): CompareRow[] {
  const choices = definition.choices;
  return [
    {
      id: 'growth',
      label: '성장 기대',
      cells: choices.map((choice) => ({
        value: pickByKeyword(
          choice.previewEffects.map((preview) => preview.label),
          '성장',
        ),
      })),
    },
    {
      id: 'playing-time',
      label: '출전 기대',
      cells: choices.map((choice) => ({
        value: pickByKeyword(
          choice.previewEffects.map((preview) => preview.label),
          '출전',
        ),
      })),
    },
    {
      id: 'offer-range',
      label: '제안 범위',
      cells: choices.map((choice) => ({ value: OFFER_RANGE_BY_CHOICE[choice.id] ?? '정보 없음' })),
    },
  ];
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
