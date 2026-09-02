import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { loadContentPack, loadRuleset } from '@offside/content';
import { MemoryLocalStore, inlineSimulator } from '@offside/engine-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCareer } from './engine/career-actions.js';
import { createAppEngine, getAppEngine, type AppEngine } from './engine/engine.js';
import { routeTree } from './routeTree.gen.js';
import { queryClient } from './shared/query-client.js';
import { useUiStore } from './shared/ui-store.js';

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

beforeEach(() => {
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

describe('SCR-001 허브 → SCR-034 온보딩 리다이렉트', () => {
  it('첫 방문(onboardingSeen=false)이고 커리어가 없으면 /onboarding으로 리다이렉트한다', async () => {
    const router = renderAt('/');

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/onboarding');
    });
    expect(
      await screen.findByRole('heading', { level: 1, name: 'OVR 하나가 아니라 여러 수치로 성장합니다' }),
    ).toBeInTheDocument();
  });

  it('onboardingSeen=true이면 리다이렉트하지 않고 빈 허브를 보여준다', async () => {
    useUiStore.setState({ onboardingSeen: true });
    const router = renderAt('/');

    expect(await screen.findByRole('heading', { level: 1, name: '아직 만든 커리어가 없습니다' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '커리어 시작' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });
});

describe('SCR-034 온보딩', () => {
  it('"다음"으로 3장을 모두 이동하고 마지막 장에서 KICKOFF 버튼과 복구 코드 문구를 보여준다', async () => {
    renderAt('/onboarding');
    await screen.findByRole('heading', { level: 1, name: 'OVR 하나가 아니라 여러 수치로 성장합니다' });

    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    expect(await screen.findByRole('heading', { level: 1, name: '선택은 되돌릴 수 없습니다' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    expect(await screen.findByRole('heading', { level: 1, name: '복구 코드가 유일한 열쇠입니다' })).toBeInTheDocument();
    expect(screen.getByText('커리어에는 VAR이 없다')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'KICKOFF' })).toBeInTheDocument();
  });

  it('"건너뛰기"는 onboardingSeen을 저장하고 허브로 이동한다', async () => {
    const router = renderAt('/onboarding');
    await screen.findByRole('heading', { level: 1, name: 'OVR 하나가 아니라 여러 수치로 성장합니다' });

    fireEvent.click(screen.getByRole('button', { name: '건너뛰기' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
    });
    expect(useUiStore.getState().onboardingSeen).toBe(true);
  });

  it('마지막 장의 KICKOFF는 커리어를 만들고 SCR-002 자리표시로 이동한다', async () => {
    const router = renderAt('/onboarding');
    await screen.findByRole('heading', { level: 1, name: 'OVR 하나가 아니라 여러 수치로 성장합니다' });

    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    fireEvent.click(screen.getByRole('button', { name: 'KICKOFF' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toMatch(/^\/career\/.+\/create$/);
    });
    expect(useUiStore.getState().onboardingSeen).toBe(true);
    expect(await screen.findByRole('heading', { level: 1, name: '선수 정보를 입력하세요' })).toBeInTheDocument();
  });
});

describe('SCR-001 허브 - 빈 상태', () => {
  beforeEach(() => {
    useUiStore.setState({ onboardingSeen: true });
  });

  it('"커리어 시작" 클릭 시 커리어를 만들고 SCR-002 자리표시로 이동한다', async () => {
    const router = renderAt('/');
    await screen.findByRole('button', { name: '커리어 시작' });

    fireEvent.click(screen.getByRole('button', { name: '커리어 시작' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toMatch(/^\/career\/.+\/create$/);
    });
  });

  it('같은 틱에 두 번 클릭해도 커리어를 하나만 만든다', async () => {
    const engine = setTestEngine();
    renderAt('/');
    const button = await screen.findByRole('button', { name: '커리어 시작' });

    fireEvent.click(button);
    fireEvent.click(button);

    await waitFor(async () => {
      expect(await engine.client.listCareers()).toHaveLength(1);
    });
  });
});

describe('SCR-001 허브 - 카드', () => {
  beforeEach(() => {
    useUiStore.setState({ onboardingSeen: true });
  });

  it('카드에 "이름 없는 선수"·"만드는 중"을 보여주고 "이어하기"로 SCR-002로 이동한다', async () => {
    await seedDraftCareer();
    const router = renderAt('/');

    expect(await screen.findByRole('heading', { level: 2, name: '이름 없는 선수' })).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole('button', { name: '삭제' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('이름 없는 선수의 커리어를 삭제하시겠습니까?')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: '다음' }));
    expect(await within(dialog).findByText('되돌릴 수 없습니다. 정말 삭제할까요?')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: '삭제 확정' }));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { level: 2, name: '이름 없는 선수' })).not.toBeInTheDocument();
    });
    expect(await screen.findByRole('status')).toHaveTextContent('이름 없는 선수의 커리어를 삭제했습니다');
  });

  it('삭제된 커리어를 딥링크로 다시 열면 캐시된 화면 대신 not-found를 보여준다', async () => {
    const engine = setTestEngine();
    const created = await createCareer(engine, { simulationMode: 'FAST' });
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error('unreachable');
    const careerId = created.snapshot.careerId;

    // SCR-002를 한 번 방문해 ['career', careerId] 쿼리 캐시(staleTime 30s)를 채운다.
    renderAt(`/career/${careerId}/create`);
    await screen.findByRole('heading', { level: 1, name: '선수 정보를 입력하세요' });

    renderAt('/');
    await screen.findByRole('heading', { level: 2, name: '이름 없는 선수' });
    fireEvent.click(screen.getByRole('button', { name: '삭제' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: '다음' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '삭제 확정' }));
    await waitFor(() => {
      expect(screen.queryByRole('heading', { level: 2, name: '이름 없는 선수' })).not.toBeInTheDocument();
    });

    // queryClient의 전역 retry:1이 실패한 fetch를 한 번 더 시도(기본 backoff 1s)한 뒤에야
    // reject하므로 기본 waitFor 타임아웃(1s)보다 넉넉하게 잡는다.
    renderAt(`/career/${careerId}/create`);
    expect(
      await screen.findByRole('heading', { level: 1, name: '찾을 수 없는 화면입니다' }, { timeout: 3000 }),
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

    fireEvent.click(screen.getByRole('button', { name: '삭제' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: '다음' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '삭제 확정' }));

    expect(await screen.findByRole('status')).toHaveTextContent('이름 없는 선수의 커리어를 삭제하지 못했습니다');
    expect(screen.getByRole('heading', { level: 2, name: '이름 없는 선수' })).toBeInTheDocument();
  });

  it('삭제 다이얼로그는 Esc로 닫히고 포커스가 삭제 버튼으로 돌아온다', async () => {
    const user = userEvent.setup();
    await seedDraftCareer();
    renderAt('/');
    await screen.findByRole('heading', { level: 2, name: '이름 없는 선수' });

    const deleteButton = screen.getByRole('button', { name: '삭제' });
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

  it('시뮬레이션 기본 모드를 챕터로 바꾸면 즉시 반영된다', async () => {
    renderAt('/settings');
    await screen.findByRole('heading', { level: 1, name: '설정' });

    fireEvent.click(screen.getByRole('radio', { name: '챕터로 자세히' }));

    await waitFor(() => {
      expect(useUiStore.getState().defaultSimulationMode).toBe('CHAPTER');
    });
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

afterEach(() => {
  useUiStore.setState({
    theme: 'SYSTEM',
    reducedMotion: 'SYSTEM',
    textScale: 100,
    defaultSimulationMode: 'FAST',
    onboardingSeen: false,
  });
});
