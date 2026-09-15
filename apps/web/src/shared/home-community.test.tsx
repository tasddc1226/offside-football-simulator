import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Notice } from '@offside/contracts';

const { getNoticesMock } = vi.hoisted(() => ({ getNoticesMock: vi.fn() }));
vi.mock('../api/client.js', () => ({ getNotices: getNoticesMock }));

// engine/notices.ts의 kv-store 저장·조회를 흉내 내는 최소 메모리 구현. put/get 왕복만 필요하다.
const kvStore = new Map<string, unknown>();
vi.mock('../engine/engine.js', () => ({
  getAppEngine: () =>
    Promise.resolve({
      store: {
        transaction: (_mode: 'readonly' | 'readwrite', run: (tx: unknown) => unknown) =>
          run({
            kv: {
              get: (key: string) => Promise.resolve(kvStore.get(key)),
              put: (key: string, value: unknown) => {
                kvStore.set(key, value);
                return Promise.resolve();
              },
            },
          }),
      },
    }),
}));

import { FEEDBACK_EMAIL, HomeCommunity } from './home-community.js';

const NOTICES: Notice[] = [
  {
    id: 'app-experience-2026-09-06',
    title: '화면과 이동 경험을 개선했습니다',
    body: [
      '선택지에 더 빨리 도달할 수 있도록 화면 구조와 정보 밀도를 다듬었습니다.',
      '직접 서명과 상단 고정 메뉴를 적용하고, 밝은 화면과 어두운 화면의 가독성을 함께 개선했습니다.',
    ],
    publishedAt: '2026-09-06T10:00:00Z',
  },
  {
    id: 'domain-and-save',
    title: '새 주소와 게임 기록 저장 안내',
    body: [
      'OFFSIDE의 현재 주소는 offside-lab.com입니다.',
      '다른 기기에서 기록을 이어가려면 기존 기기에서 동기화를 확인한 뒤 Google 계정을 연결하거나 복구 코드를 발급해 주세요. 동기화되지 않은 기기 데이터는 자동으로 옮겨지지 않습니다.',
    ],
    publishedAt: '2026-09-06T09:00:00Z',
  },
];

function renderHomeCommunity() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <HomeCommunity />
    </QueryClientProvider>,
  );
}

describe('HomeCommunity', () => {
  beforeEach(() => {
    kvStore.clear();
    getNoticesMock.mockReset();
    getNoticesMock.mockResolvedValue({ ok: true, data: { items: NOTICES } });
  });

  it('공지 상세를 열고 닫는다', async () => {
    const user = userEvent.setup();
    renderHomeCommunity();

    await user.click(await screen.findByRole('button', { name: /화면과 이동 경험을 개선했습니다/ }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/선택지에 더 빨리 도달/)).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /화면과 이동 경험을 개선했습니다/ })).toHaveFocus();
  });

  it('개수 배지는 실제 공지 개수를 보여준다', async () => {
    renderHomeCommunity();

    await waitFor(() => expect(screen.getByText('2개')).toBeInTheDocument());
  });

  it('공지가 없으면 자리표시 문구를 보여준다', async () => {
    getNoticesMock.mockResolvedValue({ ok: true, data: { items: [] } });
    renderHomeCommunity();

    await waitFor(() => expect(screen.getByText('아직 공지가 없습니다.')).toBeInTheDocument());
    expect(screen.getByText('0개')).toBeInTheDocument();
  });

  it('네트워크 실패면(캐시 없음) 오류 대신 빈 목록 문구를 보여준다', async () => {
    getNoticesMock.mockResolvedValue({ ok: false, error: { code: 'NETWORK_ERROR', message: '실패', retryable: true } });
    renderHomeCommunity();

    await waitFor(() => expect(screen.getByText('아직 공지가 없습니다.')).toBeInTheDocument());
  });

  it('자동 접수로 오해하지 않도록 메일 앱 링크와 평문 주소를 함께 제공한다', () => {
    renderHomeCommunity();
    const link = screen.getByRole('link', { name: '버그·의견 보내기' });
    expect(link).toHaveAttribute('href', expect.stringContaining(`mailto:${FEEDBACK_EMAIL}`));
    expect(screen.getByText(/메일 앱이 열리며 자동 전송되지 않습니다/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(FEEDBACK_EMAIL))).toBeInTheDocument();
  });
});
