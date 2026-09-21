import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FriendlyReceipt, LockerRoom } from '@offside/contracts';
import { FriendliesScreen } from './friendlies.js';
import { apiFetch, getProfile } from '../api/client.js';
vi.mock('../api/client.js', () => ({ apiFetch: vi.fn(), getProfile: vi.fn() }));
vi.mock('../platform/index.js', () => ({ platform: { analytics: { track: vi.fn() } } }));
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => () => ({}),
  Link: ({ children }: { children: React.ReactNode }) => <a href="/locker-room">{children}</a>,
}));
const room: LockerRoom = {
  profileId: 'owner',
  players: [],
  teams: [
    {
      id: 'team',
      name: '은퇴 팀',
      formation: '4-3-3',
      lineup: ['retired', ...Array<null>(17).fill(null)],
      revision: 2,
      updatedAt: '2026-09-21T00:00:00Z',
    },
  ],
};
const receipt: FriendlyReceipt = {
  id: 'match',
  teamId: 'deleted-team',
  teamName: '저장된 우리 팀',
  teamRevision: 1,
  createdAt: '2026-09-21T00:00:00Z',
  input: {
    version: 'FRIENDLY_V1',
    seed: 'test',
    formation: '4-3-3',
    tactic: 'BALANCED',
    lineup: Array<null>(18).fill(null),
  },
  result: {
    version: 'FRIENDLY_V1',
    homeGoals: 1,
    awayGoals: 0,
    strengths: [],
    away: [],
    home: [
      {
        id: 'retired',
        name: '은퇴 공격수',
        position: 'ST',
        slot: 9,
        basic: false,
        fromMinute: 0,
        toMinute: 90,
        fitPercent: 100,
        goals: 1,
        assists: 0,
        saves: 0,
      },
    ],
    moments: [
      {
        minute: 12,
        side: 'HOME',
        shooterId: 'retired',
        providerId: 'retired',
        keeperId: 'away',
        outcome: 'GOAL',
        goalChancePercent: 30,
      },
    ],
  },
};
function mount(
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  }),
) {
  return render(
    <QueryClientProvider client={client}>
      <FriendliesScreen />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getProfile).mockResolvedValue({ ok: true, data: { id: 'owner' } } as Awaited<
    ReturnType<typeof getProfile>
  >);
});
describe('friendly match screen', () => {
  it('removes private receipt and pending old-owner results when profile changes', async () => {
    let finish: ((value: Awaited<ReturnType<typeof apiFetch>>) => void) | undefined;
    vi.mocked(apiFetch).mockImplementation(async (path, init) => {
      if (init?.method === 'POST')
        return new Promise((resolve) => {
          finish = resolve;
        });
      return { ok: true, data: path === '/v1/locker-room' ? room : { matches: [] } };
    });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    mount(client);
    fireEvent.change(await screen.findByLabelText('저장한 팀'), { target: { value: 'team' } });
    fireEvent.click(screen.getByRole('button', { name: '친선 경기 시작' }));
    await waitFor(() => expect(finish).toBeDefined());
    expect(screen.getByLabelText('저장한 팀')).toBeDisabled();
    await act(async () => {
      client.setQueryData(['profile'], { id: 'other-owner' });
    });
    await waitFor(() => expect(screen.getByLabelText('저장한 팀')).toHaveValue(''));
    await act(async () => {
      finish!({ ok: true, data: receipt });
    });
    expect(screen.queryByLabelText('최종 점수 1 대 0')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '친선 경기 시작' })).toBeDisabled();
  });
  it('requires explicit team selection, preserves request key on failed retry, renders saved result', async () => {
    let attempts = 0;
    vi.mocked(apiFetch).mockImplementation(async (path, init) => {
      if (init?.method === 'POST') {
        attempts++;
        return attempts === 1
          ? { ok: false, error: { code: 'NETWORK_ERROR', message: '연결 오류', retryable: true } }
          : { ok: true, data: receipt };
      }
      return { ok: true, data: path === '/v1/locker-room' ? room : { matches: [] } };
    });
    mount();
    expect(await screen.findByRole('button', { name: '친선 경기 시작' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('저장한 팀'), { target: { value: 'team' } });
    fireEvent.click(screen.getByRole('radio', { name: /압박/ }));
    fireEvent.click(screen.getByRole('button', { name: '친선 경기 시작' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('연결 오류');
    fireEvent.click(screen.getByRole('button', { name: '같은 경기 다시 요청' }));
    expect(await screen.findByLabelText('최종 점수 1 대 0')).toBeInTheDocument();
    const calls = vi.mocked(apiFetch).mock.calls.filter(([, init]) => init?.method === 'POST');
    expect(calls).toHaveLength(2);
    expect(calls[0]![1]!.headers).toEqual(calls[1]![1]!.headers);
    expect(JSON.parse(calls[0]![1]!.body as string)).toEqual({ revision: 2, tactic: 'PRESS' });
    expect(screen.getByText('득점 1 · 도움 0 · 선방 0')).toBeInTheDocument();
  });
  it('changes request key when tactical intent changes after error', async () => {
    vi.mocked(apiFetch).mockImplementation(async (path, init) =>
      init?.method === 'POST'
        ? {
            ok: false,
            error: {
              code: 'VALIDATION_FAILED',
              message: '현역 선수는 출전할 수 없습니다.',
              retryable: false,
            },
          }
        : { ok: true, data: path === '/v1/locker-room' ? room : { matches: [] } },
    );
    mount();
    fireEvent.change(await screen.findByLabelText('저장한 팀'), { target: { value: 'team' } });
    fireEvent.click(screen.getByRole('button', { name: '친선 경기 시작' }));
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('radio', { name: /역습/ }));
    fireEvent.click(screen.getByRole('button', { name: '친선 경기 시작' }));
    await waitFor(() =>
      expect(
        vi.mocked(apiFetch).mock.calls.filter(([, init]) => init?.method === 'POST'),
      ).toHaveLength(2),
    );
    const calls = vi.mocked(apiFetch).mock.calls.filter(([, init]) => init?.method === 'POST');
    expect(calls[0]![1]!.headers).not.toEqual(calls[1]![1]!.headers);
  });
  it('restores server history even without a saved team, and fetches immutable receipt on replay', async () => {
    vi.mocked(apiFetch).mockImplementation(async (path) => ({
      ok: true,
      data:
        path === '/v1/locker-room'
          ? { ...room, teams: [] }
          : path.endsWith('/match')
            ? receipt
            : { matches: [receipt] },
    }));
    const view = mount();
    expect(await screen.findByLabelText('최종 점수 1 대 0')).toBeInTheDocument();
    expect(screen.getByText(/아직 저장한 팀이 없습니다/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /저장된 우리 팀 1:0 연습팀/ }));
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        '/v1/locker-room/friendlies/match',
        { cache: 'no-store' },
        expect.anything(),
      ),
    );
    expect(vi.mocked(apiFetch).mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
    view.unmount();
    mount();
    expect(await screen.findByLabelText('최종 점수 1 대 0')).toBeInTheDocument();
  });
  it('shows history errors independently and retries missing or inaccessible receipts without kickoff', async () => {
    vi.mocked(apiFetch).mockImplementation(async (path) =>
      path.endsWith('/match')
        ? {
            ok: false,
            error: { code: 'VALIDATION_FAILED', message: '경기를 찾을 수 없습니다.', retryable: false },
          }
        : { ok: true, data: path === '/v1/locker-room' ? room : { matches: [receipt] } },
    );
    mount();
    fireEvent.click(await screen.findByRole('button', { name: /저장된 우리 팀 1:0 연습팀/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('경기를 찾을 수 없습니다.');
    expect(vi.mocked(apiFetch).mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });
});
