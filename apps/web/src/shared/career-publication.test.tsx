import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CareerArticle } from '@offside/contracts';
import { CareerPublication } from './career-publication.js';
import { CareerArticleView } from './career-article.js';
import { apiFetch } from '../api/client.js';

const { flush, track } = vi.hoisted(() => ({ flush: vi.fn(), track: vi.fn() }));
vi.mock('../api/client.js', () => ({ apiFetch: vi.fn() }));
vi.mock('../engine/sync.js', () => ({ getSyncClient: async () => ({ flush }) }));
vi.mock('../platform/index.js', () => ({ platform: { analytics: { track } } }));
const article: CareerArticle = {
  id: 'f857c950-f1b1-4f40-8a16-a447b7b80605',
  playerName: '테스트 선수',
  initialPosition: 'ST',
  seasons: 2,
  playedMatches: 12,
  minutes: 800,
  averageRatingTenths: 65,
  clubCount: 2,
  highlights: [{ kind: 'GOALS', total: 4 }],
  publishedAt: '2026-09-21',
  challenge: {
    seed: 'test',
    rulesetVersion: '3.2.0',
    contentPackVersion: '0.11.0',
    simulationMode: 'CHAPTER',
    draft: {
      gender: 'UNSPECIFIED',
      nationalityCode: 'KR',
      preferredFoot: 'RIGHT',
      position: 'ST',
      archetypeId: 'test',
      backgroundId: 'test',
    },
  },
};
beforeEach(() => {
  vi.clearAllMocks();
});
describe('career article publication UI', () => {
  it('renders only saved facts without fictional trophies or verified claims', () => {
    render(<CareerArticleView article={article} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('테스트 선수, 2시즌');
    expect(screen.getByText('기록에 남은 4골')).toBeInTheDocument();
    expect(screen.getByText(/2개 팀을 거치며 총 12경기/)).toBeInTheDocument();
    expect(screen.queryByText(/우승|발롱도르|세계 최고/)).not.toBeInTheDocument();
  });
  it('does not auto-publish, requires consent, flushes before publishing, and exposes revoke', async () => {
    vi.mocked(apiFetch).mockImplementation(async (_path, init) =>
      init?.method === 'POST'
        ? { ok: true, data: article }
        : init?.method === 'DELETE'
          ? { ok: true, data: undefined }
          : { ok: true, data: { article: null } },
    );
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <CareerPublication careerId="career" />
      </QueryClientProvider>,
    );
    const publish = await screen.findByRole('button', { name: '기사 공개하기' });
    expect(publish).toBeDisabled();
    expect(vi.mocked(apiFetch).mock.calls.some((call) => call[1]?.method === 'POST')).toBe(false);
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(publish);
    expect(await screen.findByRole('button', { name: '공개 취소' })).toBeInTheDocument();
    expect(flush).toHaveBeenCalledWith('career');
    expect(screen.getByRole('textbox', { name: '공유 링크' })).toHaveValue(
      `${window.location.origin}/articles/${article.id}`,
    );
    expect(track).toHaveBeenCalledWith('growth_action', { action: 'ARTICLE_PUBLISHED' });
    fireEvent.click(screen.getByRole('button', { name: '공개 취소' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '기사 공개하기' })).toBeDisabled(),
    );
    expect(track).toHaveBeenCalledWith('growth_action', { action: 'ARTICLE_REVOKED' });
  });
});
