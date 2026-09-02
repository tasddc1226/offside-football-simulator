import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { describe, expect, it } from 'vitest';
import { routeTree } from './routeTree.gen.js';

function renderAt(path: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(<RouterProvider router={router} />);
  return router;
}

describe('SCR-001 허브', () => {
  it('h1과 "커리어 시작" 버튼, 법적 링크 2개를 렌더한다', async () => {
    renderAt('/');

    expect(await screen.findByRole('heading', { level: 1, name: '아직 만든 커리어가 없습니다' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '커리어 시작' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '이용약관' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '개인정보 처리방침' })).toBeInTheDocument();
  });

  it('"커리어 시작" 클릭 시 /career/new로 이동한다', async () => {
    const router = renderAt('/');
    await screen.findByRole('link', { name: '커리어 시작' });

    const link = screen.getByRole('link', { name: '커리어 시작' });
    link.click();

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/career/new');
    });
    expect(
      await screen.findByRole('heading', { level: 1, name: '커리어 생성은 다음 단계에서 열립니다' }),
    ).toBeInTheDocument();
  });
});

describe('법적 문서 라우트', () => {
  it('/legal/terms를 렌더한다', async () => {
    renderAt('/legal/terms');

    expect(await screen.findByRole('heading', { level: 1, name: '이용약관' })).toBeInTheDocument();
    expect(screen.getByText('문서 준비 중입니다.')).toBeInTheDocument();
  });

  it('/legal/privacy를 렌더한다', async () => {
    renderAt('/legal/privacy');

    expect(await screen.findByRole('heading', { level: 1, name: '개인정보 처리방침' })).toBeInTheDocument();
  });
});

describe('존재하지 않는 경로', () => {
  it('not-found 안내를 렌더하고 허브로 돌아가는 링크를 제공한다', async () => {
    renderAt('/no-such-route');

    expect(await screen.findByRole('heading', { level: 1, name: '찾을 수 없는 화면입니다' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '허브로 돌아가기' })).toBeInTheDocument();
  });
});
