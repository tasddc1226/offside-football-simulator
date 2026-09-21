import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CompetitionScreen } from './competition.js';
import { apiFetch } from '../api/client.js';

vi.mock('@tanstack/react-router', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-router')>('@tanstack/react-router');
  return {
    ...actual,
    Link: ({ children }: { children?: ReactNode; [key: string]: unknown }) => (
      <a href="#">{children}</a>
    ),
  };
});
vi.mock('../api/client.js', () => ({ apiFetch: vi.fn() }));

const challenge = {
  id: 'daily-2026-09-21',
  dayKey: '2026-09-21',
  weekKey: '2026-09-21',
  startsAt: '2026-09-20T15:00:00.000Z',
  endsAt: '2026-09-21T15:00:00.000Z',
  rulesetVersion: '3.3.0',
  contentPackVersion: '0.12.0',
  scoringPolicyVersion: 'SUM_ACTION_POINTS_V1',
  scenario: {
    title: '오늘의 경기 운영',
    intro: '세 번의 판단으로 흐름을 바꿔 보세요.',
    steps: [
      {
        id: 'opening',
        title: '첫 압박',
        prompt: '첫 대응은?',
        choices: [
          {
            id: 'PRESS',
            label: '전방 압박',
            description: '선택지를 줄입니다.',
            points: 35,
            outcome: '늦췄습니다.',
          },
          {
            id: 'HOLD',
            label: '대형 유지',
            description: '간격을 지킵니다.',
            points: 25,
            outcome: '안정됐습니다.',
          },
          {
            id: 'COUNTER',
            label: '역습 대기',
            description: '전환을 노립니다.',
            points: 30,
            outcome: '준비했습니다.',
          },
        ],
      },
      {
        id: 'chance',
        title: '결정적 기회',
        prompt: '마무리는?',
        choices: [
          {
            id: 'FIRST_TOUCH',
            label: '첫 터치 슈팅',
            description: '바로 마무리합니다.',
            points: 40,
            outcome: '슈팅했습니다.',
          },
          {
            id: 'CUTBACK',
            label: '뒤로 내주기',
            description: '동료를 찾습니다.',
            points: 30,
            outcome: '찾았습니다.',
          },
          {
            id: 'RECYCLE',
            label: '공 소유 유지',
            description: '공격을 다시 만듭니다.',
            points: 20,
            outcome: '설계했습니다.',
          },
        ],
      },
      {
        id: 'closing',
        title: '마지막 수비',
        prompt: '마지막 지시는?',
        choices: [
          {
            id: 'COMPACT',
            label: '중앙 봉쇄',
            description: '위험 지역을 닫습니다.',
            points: 35,
            outcome: '차단했습니다.',
          },
          {
            id: 'STEP',
            label: '한 발 전진',
            description: '라인을 올립니다.',
            points: 30,
            outcome: '줄였습니다.',
          },
          {
            id: 'WIDE',
            label: '측면 유도',
            description: '바깥으로 몰아냅니다.',
            points: 25,
            outcome: '돌렸습니다.',
          },
        ],
      },
    ],
    scorePolicy: {
      version: 'SUM_ACTION_POINTS_V1',
      description: '선택 점수 합산',
    },
  },
};
const entry = {
  challengeId: challenge.id,
  dayKey: challenge.dayKey,
  weekKey: challenge.weekKey,
  actionIds: ['PRESS', 'FIRST_TOUCH', 'COMPACT'],
  score: 110,
  maxScore: 110,
  verificationStatus: 'VERIFIED' as const,
  resultHash: 'a'.repeat(64),
  publicOptIn: false,
  submittedAt: '2026-09-21T03:00:00.000Z',
  proof: {
    method: 'SERVER_REPLAY' as const,
    rulesetVersion: '3.3.0',
    contentPackVersion: '0.12.0',
    scoringPolicyVersion: 'SUM_ACTION_POINTS_V1',
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(apiFetch).mockImplementation(async (path, init) => {
    if (path === '/v1/competition/daily') return { ok: true, data: { challenge, entry: null } };
    if (path === '/v1/competition/weekly')
      return { ok: true, data: { weekKey: challenge.weekKey, rows: [] } };
    if (init?.method === 'POST') return { ok: true, data: entry };
    return { ok: true, data: { publicOptIn: false } };
  });
});

describe('daily competition screen', () => {
  it('submits the selected equal-condition actions and explains server proof', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CompetitionScreen />
      </QueryClientProvider>,
    );
    expect(await screen.findByRole('heading', { name: '오늘의 경기 운영' })).toBeInTheDocument();
    expect(screen.getByText(/서버가 선택과 점수를 다시 계산합니다/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('전방 압박'));
    fireEvent.click(screen.getByText('첫 터치 슈팅'));
    fireEvent.click(screen.getByText('중앙 봉쇄'));
    fireEvent.click(screen.getByRole('button', { name: '기록 제출' }));
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        `/v1/competition/challenges/${challenge.id}/entries`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ actionIds: entry.actionIds, publicOptIn: false }),
        }),
        expect.anything(),
      ),
    );
    expect(await screen.findByText(/서버 재경기 검증 완료/)).toBeInTheDocument();
  });
});
