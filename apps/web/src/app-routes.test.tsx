import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { loadContentPack, loadRuleset } from '@offside/content';
import type { ServiceSeasonCurrent } from '@offside/contracts';
import { MemoryLocalStore, inlineSimulator } from '@offside/engine-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCareer } from './engine/career-actions.js';
import { createAppEngine, getAppEngine, type AppEngine } from './engine/engine.js';
import { routeTree } from './routeTree.gen.js';
import { queryClient } from './shared/query-client.js';
import { useUiStore } from './shared/ui-store.js';
import { careerCardCtaLabel, serviceSeasonBadgeLabel } from './routes/index.js';

/**
 * 컴포넌트 렌더 테스트는 실제 Worker 대신 inlineSimulator + MemoryLocalStore로 만든 테스트
 * 엔진을 getAppEngine() 자리에 주입한다(브리프: jsdom 테스트는 Worker를 피한다).
 */
const engineHolder = vi.hoisted(() => ({ promise: null as Promise<unknown> | null }));

vi.mock('./engine/engine.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./engine/engine.js')>();
  return {
    ...actual,
    getAppEngine: () => engineHolder.promise,
  };
});

function makeIdGenerator(prefix: string): () => string {
  let counter = 0;
  return () => `${prefix}-${counter++}`;
}

function setTestEngine(): AppEngine {
  const engine = createAppEngine({
    store: new MemoryLocalStore(),
    simulator: inlineSimulator,
    ruleset: loadRuleset('1.0.0'),
    pack: loadContentPack('0.1.0'),
    newId: makeIdGenerator('test'),
  });
  engineHolder.promise = Promise.resolve(engine);
  return engine;
}

const currentServiceSeason = {
  id: 'svc-current',
  name: '현재 시즌',
  status: 'ACTIVE',
  isTest: true,
  startsAt: '2026-09-01T00:00:00.000Z',
  endsAt: '2026-12-01T00:00:00.000Z',
  rulesetVersion: '1.1.0',
  contentPackVersion: '0.3.0',
  notice: 'LINE_TEST',
} satisfies ServiceSeasonCurrent;

describe('SCR-001 서비스 시즌 배지', () => {
  it('현재 테스트 시즌에서 만든 커리어만 테스트 시즌으로 표시한다', () => {
    expect(serviceSeasonBadgeLabel('svc-current', currentServiceSeason)).toBe('테스트 시즌');
  });

  it('다른 생성 시즌은 과거 metadata를 추론하지 않고 이전 시즌으로 표시한다', () => {
    expect(serviceSeasonBadgeLabel('svc-kickoff', currentServiceSeason)).toBe('이전 시즌');
  });

  it('현재 시즌 조회 결과가 없으면 배지를 표시하지 않는다', () => {
    expect(serviceSeasonBadgeLabel('svc-kickoff', undefined)).toBeNull();
  });
});

// 이슈 167: 보관함(은퇴·보관) 카드는 "이어하기"가 아니라 "기록 보기"다.
describe('SCR-001 카드 CTA 라벨', () => {
  it('DRAFT·ACTIVE는 이어하기, RETIRED·ARCHIVED는 기록 보기', () => {
    expect(careerCardCtaLabel('DRAFT')).toBe('이어하기');
    expect(careerCardCtaLabel('ACTIVE')).toBe('이어하기');
    expect(careerCardCtaLabel('RETIRED')).toBe('기록 보기');
    expect(careerCardCtaLabel('ARCHIVED')).toBe('기록 보기');
  });
});

function renderAt(path: string) {
  // 한 테스트 안에서 renderAt을 여러 번 부르는 경우(예: 삭제 뒤 딥링크 재방문)를 대비해
  // 이전 렌더를 먼저 걷어낸다. 단일 렌더 테스트에는 영향이 없다.
  cleanup();
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(<RouterProvider router={router} />);
  return router;
}

async function seedDraftCareer(): Promise<void> {
  const engine = await getAppEngine();
  await createCareer(engine, { simulationMode: 'FAST' });
}

async function openCareerDetails(): Promise<void> {
  fireEvent.click(screen.getByRole('link', { name: /선수단 관리/ }));
  fireEvent.click(await screen.findByText('상세 관리', { exact: true }));
  await screen.findByRole('button', { name: '커리어 삭제' });
}

beforeEach(() => {
  sessionStorage.clear();
  setTestEngine();
  queryClient.clear();
  useUiStore.setState({
    theme: 'SYSTEM',
    reducedMotion: 'SYSTEM',
    textScale: 100,
    defaultSimulationMode: 'FAST',
    onboardingSeen: false,
  });
});

describe('SCR-001 공개 소개 → SCR-034 온보딩', () => {
  it('첫 방문이고 커리어가 없으면 공개 소개에서 온보딩을 시작한다', async () => {
    const router = renderAt('/');

    expect(
      await screen.findByRole('heading', { level: 1, name: /이번 생은\s*프리미어리거\./ }),
    ).toBeInTheDocument();
    expect(screen.getByText('19세 유망주에서, 나만의 레전드로.')).toBeInTheDocument();
    expect(screen.getByLabelText('커리어 진행')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');

    fireEvent.click(screen.getByRole('link', { name: '내 선수 만들기' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/onboarding'));
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: '선수 생성',
      }),
    ).toBeInTheDocument();
  });

  it('onboardingSeen=true이면 리다이렉트하지 않고 빈 허브를 보여준다', async () => {
    useUiStore.setState({ onboardingSeen: true });
    const router = renderAt('/');

    expect(
      await screen.findByRole('heading', { level: 2, name: '아직 만든 커리어가 없습니다' }),
    ).toBeInTheDocument();
    expect(screen.getByText('이번 생은 프리미어리거!')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('button', { name: '커리어 시작' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });
});

describe('SCR-034 선수 생성 입구', () => {
  it('안내 슬라이드 없이 폼을 열고 제출 전에는 커리어를 만들지 않는다', async () => {
    const engine = setTestEngine();
    renderAt('/onboarding');
    expect(await screen.findByRole('heading', { name: '선수 생성' })).toBeInTheDocument();
    expect(screen.getByLabelText('이름')).toBeInTheDocument();
    expect(await engine.client.listCareers()).toHaveLength(0);
  });
  it('닫기는 기존 커리어를 유지하고 홈으로 돌아간다', async () => {
    const engine = setTestEngine();
    await seedDraftCareer();
    const router = renderAt('/onboarding');
    fireEvent.click(await screen.findByRole('link', { name: '선수 생성 닫기' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(await engine.client.listCareers()).toHaveLength(1);
  });
  it('동시 제출도 커리어 하나만 만들고 입력한 이름으로 후보 화면을 연다', async () => {
    const engine = setTestEngine();
    const router = renderAt('/onboarding');
    fireEvent.change(await screen.findByLabelText('이름'), { target: { value: '김서준' } });
    const next = screen.getByRole('button', { name: /다음 · 후보 카드 열기/ });
    fireEvent.click(next);
    fireEvent.click(next);
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/career\/.+\/style$/));
    expect(await engine.client.listCareers()).toHaveLength(1);
    expect(useUiStore.getState().onboardingSeen).toBe(true);
    expect(await screen.findByText(/김서준 ·/)).toBeInTheDocument();
  });
});

describe('SCR-001 허브 - 빈 상태', () => {
  it('커리어 시작은 바로 생성 폼으로 이동한다', async () => {
    useUiStore.setState({ onboardingSeen: true });
    const router = renderAt('/');
    fireEvent.click(await screen.findByRole('button', { name: '커리어 시작' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/onboarding'));
    expect(await screen.findByLabelText('이름')).toBeInTheDocument();
  });
});

describe('SCR-001 허브 - 카드', () => {
  beforeEach(() => {
    useUiStore.setState({ onboardingSeen: true });
  });

  it('카드에 "이름 없는 선수"·"만드는 중"을 보여주고 "이어하기"로 SCR-002로 이동한다', async () => {
    await seedDraftCareer();
    const router = renderAt('/');

    expect(
      await screen.findByRole('heading', { level: 2, name: '이름 없는 선수' }),
    ).toBeInTheDocument();
    expect(screen.getByText('만드는 중')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '이어하기' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toMatch(/^\/career\/.+\/create$/);
    });
  });

  it('삭제는 2단계 확인 뒤 카드가 사라지고 Toast를 보여준다', async () => {
    await seedDraftCareer();
    renderAt('/');
    await screen.findByRole('heading', { level: 2, name: '이름 없는 선수' });

    await openCareerDetails();
    fireEvent.click(screen.getByRole('button', { name: '커리어 삭제' }));
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText('이름 없는 선수의 커리어를 삭제하시겠습니까?'),
    ).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: '다음' }));
    expect(
      await within(dialog).findByText('되돌릴 수 없습니다. 정말 삭제할까요?'),
    ).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: '삭제 확정' }));

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { level: 2, name: '이름 없는 선수' }),
      ).not.toBeInTheDocument();
    });
    expect(await screen.findByRole('status')).toHaveTextContent(
      '이름 없는 선수의 커리어를 삭제했습니다',
    );
  });

  it('삭제된 커리어를 딥링크로 다시 열면 캐시된 화면 대신 not-found를 보여준다', async () => {
    const engine = setTestEngine();
    const created = await createCareer(engine, { simulationMode: 'FAST' });
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error('unreachable');
    const careerId = created.snapshot.careerId;

    // SCR-002를 한 번 방문해 ['career', careerId] 쿼리 캐시(staleTime 30s)를 채운다.
    renderAt(`/career/${careerId}/create`);
    await screen.findByRole('heading', { level: 1, name: '선수 생성' });

    renderAt('/');
    await screen.findByRole('heading', { level: 2, name: '이름 없는 선수' });
    await openCareerDetails();
    fireEvent.click(screen.getByRole('button', { name: '커리어 삭제' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: '다음' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '삭제 확정' }));
    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { level: 2, name: '이름 없는 선수' }),
      ).not.toBeInTheDocument();
    });

    // queryClient의 전역 retry:1이 실패한 fetch를 한 번 더 시도(기본 backoff 1s)한 뒤에야
    // reject하므로 기본 waitFor 타임아웃(1s)보다 넉넉하게 잡는다.
    renderAt(`/career/${careerId}/create`);
    expect(
      await screen.findByRole(
        'heading',
        { level: 1, name: '페이지를 찾을 수 없습니다' },
        { timeout: 3000 },
      ),
    ).toBeInTheDocument();
  });

  it('삭제가 실패하면 카드는 남아 있고 실패 Toast를 보여준다', async () => {
    const engine = setTestEngine();
    await createCareer(engine, { simulationMode: 'FAST' });
    const failingEngine: AppEngine = {
      ...engine,
      client: {
        ...engine.client,
        deleteCareer: () => Promise.reject(new Error('삭제 실패(테스트)')),
      },
    };
    engineHolder.promise = Promise.resolve(failingEngine);

    renderAt('/');
    await screen.findByRole('heading', { level: 2, name: '이름 없는 선수' });

    await openCareerDetails();
    fireEvent.click(screen.getByRole('button', { name: '커리어 삭제' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: '다음' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '삭제 확정' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      '이름 없는 선수의 커리어를 삭제하지 못했습니다',
    );
    expect(screen.getByRole('heading', { level: 2, name: '이름 없는 선수' })).toBeInTheDocument();
  });

  it('삭제 다이얼로그는 Esc로 닫히고 포커스가 삭제 버튼으로 돌아온다', async () => {
    const user = userEvent.setup();
    await seedDraftCareer();
    renderAt('/');
    await screen.findByRole('heading', { level: 2, name: '이름 없는 선수' });

    await openCareerDetails();
    const deleteButton = screen.getByRole('button', { name: '커리어 삭제' });
    await user.click(deleteButton);
    await screen.findByRole('dialog');

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(deleteButton).toHaveFocus();
  });
});

describe('SCR-030 설정', () => {
  it('테마를 다크로 바꾸면 즉시 useUiStore에 반영된다', async () => {
    renderAt('/settings');
    await screen.findByRole('heading', { level: 1, name: '설정' });

    fireEvent.click(screen.getByRole('radio', { name: '다크' }));

    await waitFor(() => {
      expect(useUiStore.getState().theme).toBe('DARK');
    });
    expect(screen.getByRole('radio', { name: '다크' })).toHaveAttribute('aria-checked', 'true');
  });

  // 사용자 결정(2026-09-13, D-77): 원작(SLB)에는 시뮬레이션 모드가 없어 제거했다 — "화면·플레이
  // 설정"에는 더 이상 모드 컨트롤이 없고 요약줄도 테마·텍스트 크기만 보여준다.
  it('시뮬레이션 모드 컨트롤이 없고 화면·플레이 설정 요약줄에 모드가 없다', async () => {
    renderAt('/settings');
    await screen.findByRole('heading', { level: 1, name: '설정' });

    fireEvent.click(screen.getByText('화면·플레이 설정', { exact: true }));

    expect(await screen.findByText('시스템 · 100%')).toBeInTheDocument();
    expect(screen.queryByText('시뮬레이션 기본 모드')).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: '빠르게' })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: '챕터로 자세히' })).not.toBeInTheDocument();
  });
});

// 설정의 이용약관·개인정보 처리방침은 더 이상 /legal/*로 이동하지 않고 같은 화면 위에 시트로
// 뜬다(?legal= 검색 파라미터). 열림·닫힘 자체는 여기서, "같은 본문을 보여준다"는 위 법적 문서
// 라우트 테스트가 이미 확인한다.
describe('SCR-030 설정: 서비스 정책 시트', () => {
  it('?legal=terms로 렌더하면 대화상자가 열려 약관 제목·본문을 보여준다', async () => {
    // 대화상자가 처음 렌더부터 열려 있어 Radix가 배경(설정 화면의 h1 포함)을 곧장
    // aria-hidden 처리한다 — 그래서 배경 제목이 아니라 대화상자 쪽을 기다린다.
    const router = renderAt('/settings?legal=terms');

    const dialog = await screen.findByRole('dialog', { name: '이용약관' });
    expect(
      within(dialog).getByRole('heading', { level: 2, name: '서비스 정의' }),
    ).toBeInTheDocument();
    expect(router.state.location.search).toEqual({ legal: 'terms' });
  });

  it('닫기 버튼을 누르면 대화상자가 닫히고 legal 파라미터가 사라진다', async () => {
    const router = renderAt('/settings?legal=privacy');
    await screen.findByRole('dialog', { name: '개인정보 처리방침' });

    fireEvent.click(screen.getByRole('button', { name: '닫기' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(router.state.location.search).toEqual({});
  });
});

describe('법적 문서 라우트', () => {
  it('/legal/terms를 렌더한다', async () => {
    renderAt('/legal/terms');

    expect(await screen.findByRole('heading', { level: 1, name: '이용약관' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '서비스 정의' })).toBeInTheDocument();
  });

  it('/legal/privacy를 렌더한다', async () => {
    renderAt('/legal/privacy');

    expect(
      await screen.findByRole('heading', { level: 1, name: '개인정보 처리방침' }),
    ).toBeInTheDocument();
  });
});

describe('D-78 상단 네비바 "N명 플레이 중" 배지', () => {
  it('presence 쿼리에 데이터가 없으면 배지를 렌더하지 않는다', async () => {
    renderAt('/');
    await screen.findByRole('navigation', { name: '게임 메뉴' });
    expect(screen.queryByText(/명 플레이 중/)).not.toBeInTheDocument();
  });

  it('playingNow: 12를 시딩하면 "12명 플레이 중"을 보여준다', async () => {
    queryClient.setQueryData(['presence', 'live'], {
      playingNow: 12,
      windowMinutes: 5,
      sampledAt: '2026-09-14T00:00:00.000Z',
    });
    renderAt('/');
    expect(await screen.findByText('12명 플레이 중')).toBeInTheDocument();
  });
});

describe('존재하지 않는 경로', () => {
  it('이슈 155: 앱 셸 안에서 not-found 안내를 렌더하고 허브로 가는 링크·문서 제목을 제공한다', async () => {
    renderAt('/no-such-route');

    expect(
      await screen.findByRole('heading', { level: 1, name: '페이지를 찾을 수 없습니다' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '허브로' })).toBeInTheDocument();
    // 앱 셸(게임 메뉴 nav)이 함께 그려진다.
    expect(screen.getByRole('navigation', { name: '게임 메뉴' })).toBeInTheDocument();
    await waitFor(() => {
      expect(document.title).toBe('페이지를 찾을 수 없습니다 — OFFSIDE');
    });
  });
});

afterEach(() => {
  useUiStore.setState({
    theme: 'SYSTEM',
    reducedMotion: 'SYSTEM',
    textScale: 100,
    defaultSimulationMode: 'FAST',
    onboardingSeen: false,
  });
});
