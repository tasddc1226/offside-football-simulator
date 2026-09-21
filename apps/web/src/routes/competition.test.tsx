import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CompetitionScreen } from './competition.js';
import { apiFetch } from '../api/client.js';

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-router')>('@tanstack/react-router');
  return { ...actual, Link: ({ children }: { children?: ReactNode; [key: string]: unknown }) => <a href="#">{children}</a> };
});
vi.mock('../api/client.js', () => ({ apiFetch: vi.fn() }));

const challenge = {
  id: 'daily-2026-09-21', dayKey: '2026-09-21', weekKey: '2026-09-21',
  startsAt: '2026-09-20T15:00:00.000Z', endsAt: '2026-09-21T15:00:00.000Z',
  rulesetVersion: '3.3.0', contentPackVersion: '0.12.0', scoringPolicyVersion: 'MATCH_EVIDENCE_V1',
  scenario: {
    title: '오늘의 경기 운영', intro: '세 번의 판단으로 실제 경기를 치릅니다.', position: 'CM', opponentName: '상대팀',
    steps: [
      { id: 'approach', title: '경기 접근', prompt: '첫 대응은?', choices: [{ id: 'PRESS_HIGH', label: '전방 압박', description: '체력을 더 씁니다.' }, { id: 'HOLD_SHAPE', label: '간격 유지', description: '안정적으로 지킵니다.' }, { id: 'COUNTER_SPACE', label: '역습 공간', description: '전환을 노립니다.' }] },
      { id: 'training', title: '짧은 훈련', prompt: '어디에 쓸까요?', choices: [{ id: 'RECOVER', label: '회복 우선', description: '체력을 보존합니다.' }, { id: 'SHARPEN', label: '마무리 훈련', description: '숙련을 높입니다.' }, { id: 'STUDY', label: '상대 분석', description: '전술을 읽습니다.' }] },
      { id: 'final-plan', title: '마지막 계획', prompt: '실행 계획은?', choices: [{ id: 'ATTACK_WIDE', label: '측면 전개', description: '전환을 늘립니다.' }, { id: 'PLAY_THROUGH', label: '중앙 연계', description: '연계를 택합니다.' }, { id: 'SET_PIECES', label: '세트피스', description: '역할을 다듬습니다.' }] },
    ],
    scorePolicy: { version: 'MATCH_EVIDENCE_V1', description: '실제 출전 시간·평점·포지션 기록으로 계산합니다.' },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(apiFetch).mockImplementation(async (path, init) => {
    if (path === '/v1/competition/daily') return { ok: true, data: { challenge, entry: null } };
    if (path === '/v1/competition/weekly') return { ok: true, data: { weekKey: challenge.weekKey, rows: [] } };
    if (path === '/v1/competition/history') return { ok: true, data: { entries: [] } };
    if (init?.method === 'POST') return { ok: true, data: { entry: { challengeId: challenge.id, dayKey: challenge.dayKey, weekKey: challenge.weekKey, actionIds: ['PRESS_HIGH'], revision: 1, completed: false, score: null, maxScore: null, verificationStatus: 'IN_PROGRESS', resultHash: null, publicOptIn: false, submittedAt: null, evidence: null, proof: { method: 'SERVER_MATCH', rulesetVersion: '3.3.0', contentPackVersion: '0.12.0', scoringPolicyVersion: 'MATCH_EVIDENCE_V1' } }, nextStepIndex: 1 } };
    return { ok: true, data: { publicOptIn: false } };
  });
});

describe('daily competition screen', () => {
  it('submits one action with a revision and does not expose answer points', async () => {
    render(<QueryClientProvider client={new QueryClient()}><CompetitionScreen /></QueryClientProvider>);
    expect(await screen.findByRole('heading', { name: '오늘의 경기 운영' })).toBeInTheDocument();
    expect(screen.getByText(/실제 출전 시간/)).toBeInTheDocument();
    expect(screen.queryByText(/점$/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('전방 압박'));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(`/v1/competition/challenges/${challenge.id}/actions`, expect.objectContaining({ method: 'POST', body: JSON.stringify({ actionId: 'PRESS_HIGH', expectedRevision: 0 }) }), expect.anything()));
  });
});
