import type { ComponentType, ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Route } from './articles.$articleId.js';

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  load: vi.fn(),
  import: vi.fn(),
  advance: vi.fn(),
  navigate: vi.fn(),
  funnel: vi.fn(),
  track: vi.fn(),
}));
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: unknown) => ({
    options,
    useParams: () => ({ articleId: 'article-id' }),
  }),
  useNavigate: () => mocks.navigate,
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));
vi.mock('../api/client.js', () => ({ apiFetch: (...args: unknown[]) => mocks.api(...args) }));
vi.mock('../api/profile.js', () => ({ ensureProfile: async () => true }));
vi.mock('@offside/engine-client', () => ({
  importCareerFromServer: (...args: unknown[]) => mocks.import(...args),
}));
vi.mock('../engine/engine.js', () => ({
  getAppEngine: async () => ({ store: {}, client: { loadCareer: mocks.load } }),
}));
vi.mock('../engine/career-actions.js', () => ({
  advance: (...args: unknown[]) => mocks.advance(...args),
}));
vi.mock('../engine/funnel.js', () => ({
  startCareerFunnel: mocks.funnel,
  recordFunnelReached: vi.fn(),
}));
vi.mock('../platform/index.js', () => ({ platform: { analytics: { track: mocks.track } } }));
vi.mock('../shared/career-route.js', () => ({
  screenForCareer: () => ({ screenId: 'SCR-007', params: { careerId: 'child' } }),
}));
const article = {
  id: 'article-id',
  playerName: '원본',
  initialPosition: 'ST',
  seasons: 1,
  playedMatches: 3,
  minutes: 100,
  averageRatingTenths: null,
  clubCount: 1,
  highlights: [],
  challenge: { rulesetVersion: '3.2.0', contentPackVersion: '0.11.0', simulationMode: 'CHAPTER' },
};
const start = {
  snapshot: {
    careerId: 'child',
    revision: 3,
    rulesetVersion: '3.2.0',
    contentPackVersion: '0.11.0',
  },
};
const loaded = (revision: number) => ({
  ok: true,
  career: { rulesetVersion: '3.2.0', contentPackVersion: '0.11.0' },
  snapshot: { revision, state: { careerId: 'child' } },
});
function mount() {
  const Component = Route.options.component as ComponentType;
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
      }
    >
      <Component />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.navigate.mockReset();
  mocks.load.mockReset();
  mocks.api.mockImplementation(async (_path: string, init?: RequestInit) => ({
    ok: true,
    data: init?.method === 'POST' ? start : article,
  }));
  mocks.import.mockResolvedValue({ ok: true });
  mocks.advance.mockResolvedValue({ ok: true, domainSnapshot: { state: { careerId: 'child' } } });
});
describe('article challenge retries', () => {
  it('does not create automatically and does not rewind or advance twice after navigation failure', async () => {
    mocks.load
      .mockResolvedValueOnce({ ok: false, error: { code: 'CAREER_NOT_FOUND', message: 'missing' } })
      .mockResolvedValueOnce(loaded(3))
      .mockResolvedValue(loaded(4));
    mocks.navigate.mockRejectedValueOnce(new Error('화면 이동 실패')).mockResolvedValue(undefined);
    mount();
    fireEvent.change(await screen.findByRole('textbox', { name: '새 선수 이름' }), {
      target: { value: '도전자' },
    });
    // The application shell owns the sole main landmark; route content must not nest another.
    expect(screen.queryByRole('main')).not.toBeInTheDocument();
    expect(
      mocks.api.mock.calls.some((call) => (call[1] as RequestInit | undefined)?.method === 'POST'),
    ).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: '같은 조건으로 시작' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('화면 이동 실패');
    fireEvent.click(screen.getByRole('button', { name: '같은 조건으로 시작' }));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledTimes(2));
    expect(mocks.import).toHaveBeenCalledTimes(1);
    expect(mocks.advance).toHaveBeenCalledTimes(1);
    const posts = mocks.api.mock.calls.filter(
      (call) => (call[1] as RequestInit | undefined)?.method === 'POST',
    );
    expect(posts[0]![1]).toEqual(posts[1]![1]);
  });
  it('never imports an initial snapshot over an existing verification failure', async () => {
    mocks.load.mockResolvedValue({
      ok: false,
      error: { code: 'VERIFICATION_FAILED', message: '저장본 검증 실패' },
    });
    mount();
    fireEvent.change(await screen.findByRole('textbox', { name: '새 선수 이름' }), {
      target: { value: '도전자' },
    });
    fireEvent.click(screen.getByRole('button', { name: '같은 조건으로 시작' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('저장본 검증 실패');
    expect(mocks.import).not.toHaveBeenCalled();
    expect(mocks.advance).not.toHaveBeenCalled();
  });
});
