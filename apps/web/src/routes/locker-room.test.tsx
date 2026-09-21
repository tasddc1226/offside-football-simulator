import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LockerPlayer, LockerTeam } from '@offside/contracts';
import { TeamEditor } from './locker-room.js';
import { apiFetch } from '../api/client.js';
vi.mock('../api/client.js', () => ({ apiFetch: vi.fn(), getProfile: vi.fn() }));
const players: LockerPlayer[] = [
  {
    careerId: 'striker',
    name: '김공격',
    position: 'ST',
    ovr: 80,
    age: 26,
    status: 'RETIRED',
    seasons: 8,
    isTest: false,
    peakOvr: 84,
    peakAge: 24,
    bestSeasonIndex: 5,
    note: null,
  },
  {
    careerId: 'keeper',
    name: '박골키퍼',
    position: 'GK',
    ovr: 72,
    age: 21,
    status: 'ACTIVE',
    seasons: 2,
    isTest: false,
    peakOvr: null,
    peakAge: null,
    bestSeasonIndex: null,
    note: null,
  },
];
function editor(team?: LockerTeam) {
  const onSaved = vi.fn();
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}
    >
      <TeamEditor
        players={players}
        teams={team ? [team] : []}
        team={team}
        onSelect={vi.fn()}
        onSaved={onSaved}
        onDeleted={vi.fn()}
      />
    </QueryClientProvider>,
  );
  return onSaved;
}
beforeEach(() => vi.clearAllMocks());
describe('locker team editor', () => {
  it('moves a selected player rather than duplicating them, and saves a partial formation', async () => {
    const saved = {
      id: 'team',
      name: '나의 첫 팀',
      formation: '3-5-2',
      lineup: Array<string | null>(18).fill(null),
      revision: 1,
      updatedAt: '2026-09-21T00:00:00Z',
    };
    vi.mocked(apiFetch).mockResolvedValue({ ok: true, data: saved });
    const onSaved = editor();
    fireEvent.click(screen.getByRole('button', { name: 'ST · 빈자리 선수 선택' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /김공격/ }));
    fireEvent.click(screen.getByRole('button', { name: '후보 1 · 빈자리 선수 선택' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /김공격/ }));
    expect(screen.getByRole('button', { name: 'ST · 빈자리 선수 선택' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '후보 1 · 김공격 선수 선택' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: '포메이션' }), {
      target: { value: '3-5-2' },
    });
    fireEvent.click(screen.getByRole('button', { name: '팀 저장' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const call = vi.mocked(apiFetch).mock.calls[0]!;
    const body = JSON.parse(call[1]!.body as string) as {
      formation: string;
      lineup: (string | null)[];
    };
    expect(body.formation).toBe('3-5-2');
    expect(body.lineup.filter(Boolean)).toEqual(['striker']);
    expect(body.lineup[11]).toBe('striker');
  });
  it('filters goalkeeper slots and retains edits on failed saves', async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      ok: false,
      error: { code: 'NETWORK_ERROR', message: '연결을 확인해 주세요.', retryable: true },
    });
    const onSaved = editor();
    fireEvent.click(screen.getByRole('button', { name: 'GK · 빈자리 선수 선택' }));
    expect(
      within(screen.getByRole('dialog')).queryByRole('button', { name: /김공격/ }),
    ).not.toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /박골키퍼/ }));
    fireEvent.change(screen.getByRole('textbox', { name: '팀 이름' }), {
      target: { value: '실패해도 남는 팀' },
    });
    fireEvent.click(screen.getByRole('button', { name: '팀 저장' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('연결을 확인해 주세요.');
    expect(screen.getByRole('textbox', { name: '팀 이름' })).toHaveValue('실패해도 남는 팀');
    expect(screen.getByRole('button', { name: 'GK · 박골키퍼 선수 선택' })).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '변경 되돌리기' }));
    expect(screen.getByRole('textbox', { name: '팀 이름' })).toHaveValue('나의 첫 팀');
  });
});
