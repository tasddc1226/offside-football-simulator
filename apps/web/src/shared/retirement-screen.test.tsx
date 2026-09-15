import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { CareerArchiveCore, CareerState, Command, LegacyResult } from '@offside/domain';
import { RetirementPage, RetirementScreen } from './retirement-screen.js';

const { navigateMock, getAppEngineMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  getAppEngineMock: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: { children: ReactNode; [key: string]: unknown }) => (
    <a href="#" {...props}>
      {children}
    </a>
  ),
  useNavigate: () => navigateMock,
}));

vi.mock('../engine/engine.js', () => ({ getAppEngine: getAppEngineMock }));

const state = {
  careerId: 'career-test',
  rulesetVersion: '1.5.0',
  contentPackVersion: '0.6.0',
  status: 'RETIRED',
  seasonHistory: [],
  timeline: [],
  season: null,
  pending: null,
  nationalityRuleState: {
    moduleId: 'DEFAULT',
    exceptions: [],
    serviceStatus: 'NOT_APPLICABLE',
    route: null,
    startSeasonIndex: null,
    completedSeasonIndex: null,
  },
  player: {
    profile: {
      name: '공개 선수',
      gender: 'MALE',
      nationalityCode: 'KR',
      preferredFoot: 'RIGHT',
      primaryPosition: 'ST',
      preferredPosition: 'ST',
      archetypeId: 'x',
      backgroundId: 'x',
      baseOvr: 77,
    },
  },
} as unknown as CareerState;
const result = {
  totalScore: 80,
  bandId: 'BAND-ICON',
  endingId: 'END-COMPLETE-SHORT',
  componentScores: { achievement: 1, contribution: 2, longevity: 3, relationship: 4, narrative: 5 },
  topFactors: [],
  missedOpportunity: {
    component: 'achievement',
    sourceIds: [],
    reasonTag: 'LEGACY_ACHIEVEMENT',
    value: 1,
  },
  bestMomentRef: 'retirement',
  percentileHidden: true,
  sources: [],
  tags: [],
  coverage: { income: 'UNAVAILABLE' },
} as unknown as LegacyResult;

const activeState = {
  ...state,
  status: 'ACTIVE',
  age: 24,
  state: { fitness: 80 },
  contract: null,
  relationships: { captain: 0 },
  legacyEvents: { policyVersion: '1.0.0', tournaments: [], mentoredSeasonIndices: [] },
  seasonHistory: [
    {
      index: 0,
      result: {
        playerStats: {
          injuries: 0,
          appearances: { total: 10 },
          minutes: 900,
          ratedMatches: 10,
          ratingSumTenths: 700,
        },
        competitions: [],
        selectionSummary: { possibleMinutes: 900 },
      },
    },
  ],
  season: null,
  pending: null,
} as unknown as CareerState;

describe('RetirementScreen terminal public views', () => {
  it('hides retirement actions and renders public profile fields and four navigation links', () => {
    const { rerender } = render(
      <RetirementScreen state={state} result={result} mode="final-profile" />,
    );
    expect(screen.queryByRole('button', { name: /은퇴/ })).not.toBeInTheDocument();
    expect(screen.getByText('공개 선수')).toBeInTheDocument();
    expect(screen.getByText(/최종 포지션 스트라이커 · 선호 스트라이커/)).toBeInTheDocument();
    expect(screen.getByText('짧았지만 완결된 커리어')).toBeInTheDocument();
    expect(screen.getByText('라인을 넘지 못한 날도 그의 축구였다')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Legacy Score' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '연대기' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '최종 프로필' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '통산 기록' })).toBeInTheDocument();
    expect(screen.queryByText(/potential|잠재력/i)).not.toBeInTheDocument();

    const retrospectiveState = {
      ...state,
      age: 35,
      simulationMode: 'FAST',
      contract: null,
      state: { fitness: 80 },
      timeline: [
        { revision: 12, kind: 'SEASON_SETTLED', age: 34, step: 12 },
        { revision: 20, kind: 'RETIRED', refId: 'RETIRE', age: 35, step: 12 },
      ],
      seasonHistory: [
        {
          index: 1,
          teamId: 'TEAM-1',
          settledAtRevision: 12,
          result: {
            competitions: [],
            chapters: [],
            playerStats: {
              group: 'FW',
              appearances: { total: 60, started: 55, sub: 0, zeroMinute: 5, out: 5 },
              minutes: 4_950,
              ratedMatches: 55,
              ratingSumTenths: 3_850,
              totals: { group: 'FW', goals: 12, assists: 4, xgCenti: 1_000, shots: 60, offsides: 8 },
            },
            stateDeltas: { managerTrust: { after: 75 } },
            selectionSummary: { possibleMinutes: 5_400 },
          },
        },
      ],
    } as unknown as CareerState;
    const retrospectiveResult = {
      ...result,
      bestMomentRef: 'season:1:performance',
      international: { seniorCaps: 0, youthAppearances: 0, tournaments: [] },
      nationality: { serviceStatus: 'NOT_APPLICABLE' },
      sources: [
        { sourceId: 'season:1:performance', revision: 12, seasonIndex: 1, kind: 'SEASON' },
        { sourceId: 'season:1:relationships', revision: 12, seasonIndex: 1, kind: 'SEASON' },
        { sourceId: 'season:1:duration', revision: 12, seasonIndex: 1, kind: 'SEASON' },
      ],
    } as unknown as LegacyResult;
    const archive = {
      records: {
        totals: { seasons: 1, playedMatches: 55, minutes: 4_950, averageRatingTenths: 70 },
        clubs: [],
        positions: [
          {
            group: 'FW',
            totals: { minutes: 4_950 },
            statistics: { group: 'FW', goals: 12 },
          },
        ],
        sources: [{ seasonIndex: 1, settledAtRevision: 12 }],
      },
    } as unknown as CareerArchiveCore;

    rerender(
      <RetirementScreen
        state={retrospectiveState}
        result={retrospectiveResult}
        archive={archive}
        retrospective="moment-2"
      />,
    );
    expect(screen.getByLabelText('커리어 돌아보기 2 / 5 단계')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '시즌 기여 기록' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '전체 건너뛰기' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '최종 기록 바로 보기' })).toBeInTheDocument();

    rerender(
      <RetirementScreen
        state={retrospectiveState}
        result={{ ...retrospectiveResult, sources: [] } as unknown as LegacyResult}
        archive={archive}
        retrospective="moment-1"
      />,
    );
    expect(screen.getByLabelText('커리어 돌아보기 1 / 2 단계')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '짧았지만 완결된 커리어' })).toBeInTheDocument();

    document.documentElement.dataset.inputModality = 'keyboard';
    rerender(
      <RetirementScreen state={retrospectiveState} result={retrospectiveResult} archive={archive} />,
    );
    expect(screen.getByRole('link', { name: '커리어 돌아보기' })).toBeInTheDocument();
    expect(screen.getByText('통산 출전 50경기')).toBeInTheDocument();
    expect(screen.getByText('공격수 통산 득점 10골')).toBeInTheDocument();
    expect(screen.getByText(/언제든 이 화면에서 다시 볼 수 있습니다/)).toBeInTheDocument();

    const laterSeason = {
      ...retrospectiveState.seasonHistory[0],
      index: 2,
      settledAtRevision: 18,
      result: {
        ...retrospectiveState.seasonHistory[0]!.result,
        playerStats: {
          ...retrospectiveState.seasonHistory[0]!.result.playerStats,
          appearances: { total: 1, started: 1, sub: 0, zeroMinute: 0, out: 0 },
          minutes: 90,
          ratedMatches: 1,
          ratingSumTenths: 70,
          totals: { group: 'FW', goals: 1, assists: 0, xgCenti: 50, shots: 2, offsides: 0 },
        },
      },
    };
    rerender(
      <RetirementScreen
        state={{
          ...retrospectiveState,
          seasonHistory: [...retrospectiveState.seasonHistory, laterSeason],
        } as unknown as CareerState}
        result={retrospectiveResult}
        archive={{
          ...archive,
          records: {
            ...archive.records,
            sources: [...archive.records.sources, { seasonIndex: 2, settledAtRevision: 18 }],
          },
        } as unknown as CareerArchiveCore}
      />,
    );
    expect(screen.getAllByText('2026 시즌 달성')).toHaveLength(2);
    expect(screen.queryByText('2027 시즌 달성')).not.toBeInTheDocument();
    delete document.documentElement.dataset.inputModality;
  });
});

describe('RetirementScreen active confirmation', () => {
  it('does not expose retirement from a DRAFT career with no settled season', () => {
    render(
      <RetirementScreen
        state={{ ...activeState, status: 'DRAFT', seasonHistory: [] } as unknown as CareerState}
        onCommand={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: '선수 생활 마무리' })).not.toBeInTheDocument();
    expect(screen.getByText('진행 중인 시즌과 계약 선택을 마친 뒤 은퇴할 수 있어요.')).toBeInTheDocument();
  });

  it('confirms RETIRE, allows cancellation, and prevents duplicate commits while busy', async () => {
    const user = userEvent.setup();
    let resolve!: () => void;
    const onCommand = vi.fn<(command: Command) => Promise<void>>(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    );
    render(<RetirementScreen state={activeState} onCommand={onCommand} />);

    await user.click(screen.getByRole('button', { name: '선수 생활 마무리' }));
    expect(screen.getByRole('heading', { name: '마지막 휘슬을 불까요?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '은퇴 확정' }));
    expect(onCommand).toHaveBeenCalledTimes(1);
    expect(onCommand).toHaveBeenCalledWith({ type: 'RETIRE', payload: { choice: 'RETIRE' } });
    expect(screen.getByRole('button', { name: '은퇴 확정' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '은퇴 확정' }));
    expect(onCommand).toHaveBeenCalledTimes(1);
    resolve();
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: '마지막 휘슬을 불까요?' }),
      ).not.toBeInTheDocument(),
    );
  });

  it('keeps the confirmation open while an irreversible request is pending', async () => {
    const user = userEvent.setup();
    let resolve!: () => void;
    const onCommand = vi.fn<(command: Command) => Promise<void>>(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    );
    render(<RetirementScreen state={activeState} onCommand={onCommand} />);

    await user.click(screen.getByRole('button', { name: '선수 생활 마무리' }));
    await user.click(screen.getByRole('button', { name: '은퇴 확정' }));
    await user.keyboard('{Escape}');
    expect(screen.getByRole('heading', { name: '마지막 휘슬을 불까요?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '취소' }));
    expect(screen.getByRole('heading', { name: '마지막 휘슬을 불까요?' })).toBeInTheDocument();
    const overlay = document.querySelector('.os-dialog-overlay');
    expect(overlay).not.toBeNull();
    await user.click(overlay!);
    expect(screen.getByRole('heading', { name: '마지막 휘슬을 불까요?' })).toBeInTheDocument();

    resolve();
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: '마지막 휘슬을 불까요?' }),
      ).not.toBeInTheDocument(),
    );
  });

  it('cancels without a command and surfaces a failed confirmation', async () => {
    const user = userEvent.setup();
    const onCommand = vi
      .fn<(command: Command) => Promise<void>>()
      .mockRejectedValue(new Error('저장 실패'));
    render(<RetirementScreen state={activeState} onCommand={onCommand} />);

    await user.click(screen.getByRole('button', { name: '선수 생활 마무리' }));
    await user.click(screen.getByRole('button', { name: '취소' }));
    expect(onCommand).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('heading', { name: '마지막 휘슬을 불까요?' }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '선수 생활 마무리' }));
    await user.click(screen.getByRole('button', { name: '지도자 에필로그로 마무리' }));
    await waitFor(() =>
      expect(screen.getByRole('alert', { hidden: true })).toHaveTextContent('저장 실패'),
    );
    expect(screen.getByRole('button', { name: '은퇴 확정' })).not.toBeDisabled();
    expect(onCommand).toHaveBeenCalledWith({
      type: 'RETIRE',
      payload: { choice: 'COACH_EPILOGUE' },
    });
  });
});

describe('RetirementPage route guard', () => {
  it.each(['retirement', 'legacy', 'timeline', 'final-profile'] as const)(
    'redirects a DRAFT career away from the %s route',
    async (mode) => {
      navigateMock.mockClear();
      const draftState = {
        ...activeState,
        status: 'DRAFT',
        player: {
          ...activeState.player,
          draft: {
            name: null,
            gender: null,
            nationalityCode: null,
            preferredFoot: null,
            position: null,
            archetypeId: null,
            backgroundId: null,
          },
        },
      } as unknown as CareerState;
      getAppEngineMock.mockResolvedValue({
        client: {
          loadCareer: vi.fn().mockResolvedValue({
            ok: true,
            snapshot: { state: draftState },
            career: { ownerProfileId: 'profile-test' },
          }),
        },
      });
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

      render(
        <QueryClientProvider client={client}>
          <RetirementPage careerId="career-test" mode={mode} />
        </QueryClientProvider>,
      );

      await waitFor(() =>
        expect(navigateMock).toHaveBeenCalledWith({
          to: '/career/$careerId/create',
          params: { careerId: 'career-test' },
          replace: true,
        }),
      );
    },
  );
});
