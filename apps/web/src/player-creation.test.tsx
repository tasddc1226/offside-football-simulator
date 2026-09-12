// SCR-002·003·004 통합 테스트. app-routes.test.tsx와 같은 harness(getAppEngine 자리에
// inlineSimulator + MemoryLocalStore 테스트 엔진 주입)를 쓰고, 이 파일만 src/api/client.js를
// 함께 모킹해 복구 코드 단계의 분기(미발급/이미 발급/API 실패)를 검증한다.
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { MemoryLocalStore, inlineSimulator } from '@offside/engine-client';
import type { IssueRecoveryCodeResponse, Profile } from '@offside/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiResult } from './api/client.js';
import { advance, confirmPlayer, createCareer, updateDraft } from './engine/career-actions.js';
import { createAppEngine, type AppEngine } from './engine/engine.js';
import { careerQueryOptions } from './engine/use-career.js';
import { routeTree } from './routeTree.gen.js';
import { queryClient } from './shared/query-client.js';
import { useUiStore } from './shared/ui-store.js';
import {
  seedTestServiceSeason,
  testContentPack,
  testRuleset,
  TEST_CONTENT_PACK_VERSION,
  TEST_RULESET_VERSION,
} from './test/content-fixtures.js';

const engineHolder = vi.hoisted(() => ({ promise: null as Promise<unknown> | null }));
const apiHolder = vi.hoisted(() => ({ getProfile: vi.fn(), issueRecoveryCode: vi.fn() }));

vi.mock('./engine/engine.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./engine/engine.js')>();
  return { ...actual, getAppEngine: () => engineHolder.promise };
});

vi.mock('./api/client.js', () => ({
  API_BASE_URL: 'http://localhost:8787',
  getProfile: () => apiHolder.getProfile(),
  issueRecoveryCode: () => apiHolder.issueRecoveryCode(),
  deleteCareerOnServer: () => Promise.resolve({ ok: true, data: undefined }),
}));

function makeIdGenerator(prefix: string): () => string {
  let counter = 0;
  return () => `${prefix}-${counter++}`;
}

function setTestEngine(): AppEngine {
  const engine = createAppEngine({
    store: new MemoryLocalStore(),
    simulator: inlineSimulator,
    ruleset: testRuleset,
    pack: testContentPack,
    newId: makeIdGenerator('test'),
  });
  engineHolder.promise = Promise.resolve(engine);
  seedTestServiceSeason();
  return engine;
}

function renderAt(path: string) {
  cleanup();
  const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: [path] }) });
  render(<RouterProvider router={router} />);
  return router;
}

async function createDraftCareer(engine: AppEngine): Promise<string> {
  const created = await createCareer(engine, { simulationMode: 'FAST' });
  if (!created.ok) throw new Error('unreachable');
  return created.snapshot.careerId;
}

const UNISSUED_PROFILE: Profile = {
  id: 'prf_1',
  settings: { reducedMotion: 'SYSTEM', textScale: 100, theme: 'SYSTEM', defaultSimulationMode: 'FAST' },
  linked: { google: false, toss: false },
  recoveryCodeIssuedAt: null,
  createdAt: '2026-09-01T00:00:00Z',
  googleEmailMasked: null,
  pendingMerge: null,
};

beforeEach(() => {
  sessionStorage.clear();
  setTestEngine();
  queryClient.clear();
  useUiStore.setState({
    theme: 'SYSTEM',
    reducedMotion: 'SYSTEM',
    textScale: 100,
    defaultSimulationMode: 'FAST',
    onboardingSeen: true,
  });
  apiHolder.getProfile.mockReset();
  apiHolder.issueRecoveryCode.mockReset();
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
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

describe('SCR-002 선수 정보', () => {
  it('필수 필드를 모두 입력하고 다음을 누르면 SCR-003으로 이동한다', async () => {
    const engine = setTestEngine();
    const careerId = await createDraftCareer(engine);
    const user = userEvent.setup();
    const router = renderAt(`/career/${careerId}/create`);
    await screen.findByRole('heading', { level: 1, name: '다음 무대를 향해, 킥오프' });

    await user.click(screen.getByRole('radio', { name: /아카데미의 추가 평가/ }));
    await user.click(screen.getByRole('button', { name: '다음' }));
    await user.type(screen.getByLabelText('이름'), '김서준');
    await user.click(screen.getByRole('radio', { name: '남성' }));
    await user.selectOptions(screen.getByLabelText('국적'), 'KR');
    await user.click(screen.getByRole('radio', { name: '왼발' }));
    await user.click(screen.getByRole('button', { name: '다음' }));
    await user.click(screen.getByRole('tab', { name: '공격수' }));
    await user.click(screen.getByRole('radio', { name: /스트라이커/ }));
    await user.click(screen.getByRole('button', { name: '플레이 스타일 고르기' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/career/${careerId}/style`);
    });
  });

  it('빈 폼으로 제출하면 오류를 보여주고 이름 입력에 포커스를 유지한다', async () => {
    const engine = setTestEngine();
    const careerId = await createDraftCareer(engine);
    const user = userEvent.setup();
    renderAt(`/career/${careerId}/create`);
    await screen.findByRole('heading', { level: 1, name: '다음 무대를 향해, 킥오프' });

    await user.click(screen.getByRole('radio', { name: /아카데미의 추가 평가/ }));
    await user.click(screen.getByRole('button', { name: '다음' }));
    await user.click(screen.getByRole('button', { name: '다음' }));

    expect(await screen.findByText(/이름은 .+자여야 합니다\./)).toBeInTheDocument();
    expect(screen.getByLabelText('이름')).toHaveFocus();
  });

  it('정체성 오류는 필드를 고치는 즉시 사라지고, 등장인물 이름은 안내와 함께 거부한다(이슈 153·158·104)', async () => {
    const engine = setTestEngine();
    const careerId = await createDraftCareer(engine);
    const user = userEvent.setup();
    renderAt(`/career/${careerId}/create`);
    await screen.findByRole('heading', { level: 1, name: '다음 무대를 향해, 킥오프' });

    await user.click(screen.getByRole('radio', { name: /아카데미의 추가 평가/ }));
    await user.click(screen.getByRole('button', { name: '다음' }));
    await user.click(screen.getByRole('button', { name: '다음' }));

    expect(await screen.findByText('성별을 선택해 주세요.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();

    await user.click(screen.getByRole('radio', { name: '남성' }));
    expect(screen.queryByText('성별을 선택해 주세요.')).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('국적'), 'KR');
    expect(screen.queryByText('국적을 선택해 주세요.')).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: '왼발' }));
    expect(screen.queryByText('주발을 선택해 주세요.')).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('이름'), '이도현');
    expect(screen.getByText('게임 속 등장인물 이름과 같아요. 다른 이름을 골라 주세요.')).toBeInTheDocument();
    expect(screen.getByLabelText('이름')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();

    await user.clear(screen.getByLabelText('이름'));
    await user.type(screen.getByLabelText('이름'), '김서준');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('이름')).toHaveAttribute('aria-invalid', 'false');
    expect(screen.getByRole('button', { name: '다음' })).toBeEnabled();
  });

  it('형식은 JSON이지만 값이 잘못된 scratch는 무시하고 저장된 draft로 복구한다', async () => {
    const engine = setTestEngine();
    const careerId = await createDraftCareer(engine);
    sessionStorage.setItem(
      `offside:player-creation:${careerId}`,
      JSON.stringify({
        form: {
          name: '김서준',
          gender: 'MALE',
          nationalityCode: 'KR',
          preferredFoot: 'LEFT',
          position: 'BAD',
          backgroundId: 'club-academy',
        },
        panel: 1,
      }),
    );

    renderAt(`/career/${careerId}/create`);

    expect(await screen.findByRole('heading', { level: 2, name: '어떤 환경에서 출발했나요?' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio').every((radio) => !radio.hasAttribute('data-state') || radio.getAttribute('data-state') !== 'checked')).toBe(true);
  });

  it('저장 실패 → 입력으로 돌아가기 → 폼(이름 입력)이 다시 보인다', async () => {
    const engine = setTestEngine();
    const careerId = await createDraftCareer(engine);
    vi.spyOn(engine.client, 'execute').mockResolvedValueOnce({
      ok: false,
      error: { code: 'VALIDATION_FAILED', message: '저장하지 못했습니다.' },
    });
    const user = userEvent.setup();
    renderAt(`/career/${careerId}/create`);
    await screen.findByRole('heading', { level: 1, name: '다음 무대를 향해, 킥오프' });

    await user.click(screen.getByRole('radio', { name: /아카데미의 추가 평가/ }));
    await user.click(screen.getByRole('button', { name: '다음' }));
    await user.type(screen.getByLabelText('이름'), '김서준');
    await user.click(screen.getByRole('radio', { name: '남성' }));
    await user.selectOptions(screen.getByLabelText('국적'), 'KR');
    await user.click(screen.getByRole('radio', { name: '왼발' }));
    await user.click(screen.getByRole('button', { name: '다음' }));
    await user.click(screen.getByRole('tab', { name: '공격수' }));
    await user.click(screen.getByRole('radio', { name: /스트라이커/ }));
    await user.click(screen.getByRole('button', { name: '플레이 스타일 고르기' }));

    await screen.findByText('저장하지 못했습니다.');
    await user.click(screen.getByRole('button', { name: '입력으로 돌아가기' }));

    expect(await screen.findByRole('heading', { level: 2, name: '어떤 환경에서 출발했나요?' })).toBeInTheDocument();
  });
});

describe('SCR-003 플레이 스타일', () => {
  async function seedToStyle(engine: AppEngine): Promise<string> {
    const careerId = await createDraftCareer(engine);
    await updateDraft(engine, careerId, { name: '김서준', gender: 'UNSPECIFIED', nationalityCode: 'KR', preferredFoot: 'LEFT' });
    await updateDraft(engine, careerId, { position: 'W', backgroundId: 'club-academy' });
    return careerId;
  }

  it('포지션의 아키타입 3개를 비교 카드로 보여주고 하나를 고르면 SCR-004로 이동한다', async () => {
    const engine = setTestEngine();
    const careerId = await seedToStyle(engine);
    const user = userEvent.setup();
    const router = renderAt(`/career/${careerId}/style`);
    await screen.findByRole('heading', { level: 1, name: '플레이 스타일을 고르세요' });
    expect(screen.getByText(/핵심 능력과 상대적으로 약한 부분/)).toHaveTextContent(
      '같은 능력이 두 항목에 함께 나올 수 있습니다',
    );
    expect(screen.getAllByText('플레이 핵심')).toHaveLength(3);
    expect(screen.getAllByText('비교 열세')).toHaveLength(3);

    const radios = screen.getAllByRole('radio');
    const uniqueChoices = new Set(radios.map((radio) => radio.getAttribute('aria-label')));
    expect(uniqueChoices.size).toBe(3);

    await user.click(radios[0]!);
    await user.click(screen.getByRole('button', { name: '다음' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/career/${careerId}/confirm`);
    });
  });

  it('선택 없이 다음을 누르면 오류를 보여준다', async () => {
    const engine = setTestEngine();
    const careerId = await seedToStyle(engine);
    const user = userEvent.setup();
    renderAt(`/career/${careerId}/style`);
    await screen.findByRole('heading', { level: 1, name: '플레이 스타일을 고르세요' });

    await user.click(screen.getByRole('button', { name: '다음' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('스타일을 하나 선택해 주세요.');
  });
});

describe('가드: DRAFT 단계가 맞지 않으면 앞선 화면으로 보낸다', () => {
  it('핵심 필드가 비어있는데 /style로 진입하면 /create로 보낸다', async () => {
    const engine = setTestEngine();
    const careerId = await createDraftCareer(engine);

    const router = renderAt(`/career/${careerId}/style`);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/career/${careerId}/create`);
    });
  });

  it('archetypeId 없이 /confirm으로 진입하면 /style로 보낸다', async () => {
    const engine = setTestEngine();
    const careerId = await createDraftCareer(engine);
    await updateDraft(engine, careerId, {
      name: '김서준',
      gender: 'UNSPECIFIED',
      nationalityCode: 'KR',
      preferredFoot: 'LEFT',
      position: 'W',
      backgroundId: 'club-academy',
    });

    const router = renderAt(`/career/${careerId}/confirm`);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/career/${careerId}/style`);
    });
  });

  it('이미 더 앞선 단계까지 채웠어도 이전 화면으로 돌아가는 방문은 막지 않는다', async () => {
    const engine = setTestEngine();
    const careerId = await createDraftCareer(engine);
    await updateDraft(engine, careerId, {
      name: '김서준',
      gender: 'UNSPECIFIED',
      nationalityCode: 'KR',
      preferredFoot: 'LEFT',
      position: 'W',
      archetypeId: 'inside-forward',
      backgroundId: 'club-academy',
    });

    const router = renderAt(`/career/${careerId}/create`);

    await screen.findByRole('heading', { level: 1, name: '다음 무대를 향해, 킥오프' });
    expect(router.state.location.pathname).toBe(`/career/${careerId}/create`);
  });
});

describe('SCR-002→003: 포지션 변경 시 기존 아키타입을 자동 확정하지 않는다', () => {
  it('W/inside-forward 선택 후 포지션을 ST로 바꾸면 스타일 화면에서 선택이 비어 있다', async () => {
    const engine = setTestEngine();
    const careerId = await createDraftCareer(engine);
    await updateDraft(engine, careerId, {
      name: '김서준',
      gender: 'UNSPECIFIED',
      nationalityCode: 'KR',
      preferredFoot: 'LEFT',
      position: 'W',
      archetypeId: 'inside-forward',
      backgroundId: 'club-academy',
    });

    const user = userEvent.setup();
    renderAt(`/career/${careerId}/create`);
    await screen.findByRole('heading', { level: 1, name: '다음 무대를 향해, 킥오프' });

    await user.click(screen.getByRole('button', { name: '다음' }));
    await user.click(screen.getByRole('button', { name: '다음' }));
    await user.click(screen.getByRole('tab', { name: '공격수' }));
    await user.click(screen.getByRole('radio', { name: /스트라이커/ }));
    await user.click(screen.getByRole('button', { name: '플레이 스타일 고르기' }));

    await screen.findByRole('heading', { level: 1, name: '플레이 스타일을 고르세요' });
    expect(screen.queryByText('선택됨')).not.toBeInTheDocument();
  });
});

describe('SCR-004 확인 및 복구 코드', () => {
  // UX-012: KICKOFF 확정 뒤 ScreenTransition은 3초 고정이다 — 이 통합 테스트는 실제 연출
  // 시간을 검증하는 목적이 아니므로(app-motion.spec.ts e2e가 그 역할을 한다) 모션 감소로
  // 즉시 완료시켜 findBy* 기본 타임아웃(1000ms) 안에서 끝나게 한다.
  beforeEach(() => {
    useUiStore.setState({ reducedMotion: 'ON' });
  });

  async function seedReadyForConfirm(engine: AppEngine): Promise<string> {
    const careerId = await createDraftCareer(engine);
    await updateDraft(engine, careerId, {
      name: '김서준',
      gender: 'UNSPECIFIED',
      nationalityCode: 'KR',
      preferredFoot: 'LEFT',
      position: 'W',
      archetypeId: 'inside-forward',
      backgroundId: 'club-academy',
    });
    return careerId;
  }

  it('전역 활성 팩과 달라도 커리어 record에 고정된 콘텐츠 팩 버전을 표시한다', async () => {
    const engine = setTestEngine();
    const careerId = await seedReadyForConfirm(engine);
    renderAt(`/career/${careerId}/confirm`);
    await screen.findByRole('heading', { level: 1, name: '확정 전 정보를 확인하세요' });

    const options = careerQueryOptions(careerId);
    const current = queryClient.getQueryData(options.queryKey);
    if (current === undefined) throw new Error('캐시된 커리어가 있어야 한다');
    act(() => {
      queryClient.setQueryData(options.queryKey, {
        ...current,
        record: { ...current.record, contentPackVersion: '0.3.0' },
      });
    });

    expect(await screen.findByText(`${TEST_RULESET_VERSION} / 0.3.0`)).toBeInTheDocument();
    expect(screen.queryByText(`${TEST_RULESET_VERSION} / ${TEST_CONTENT_PACK_VERSION}`)).not.toBeInTheDocument();
  });

  it('선수 요약을 보여주고 KICKOFF 확정 후 복구 코드를 발급한다', async () => {
    const engine = setTestEngine();
    const careerId = await seedReadyForConfirm(engine);
    apiHolder.getProfile.mockResolvedValue({ ok: true, data: UNISSUED_PROFILE } satisfies ApiResult<Profile>);
    apiHolder.issueRecoveryCode.mockResolvedValue({
      ok: true,
      data: { code: 'OFS-ABCD-2345-EFGH', issuedAt: '2026-09-02T00:00:00Z' },
    } satisfies ApiResult<IssueRecoveryCodeResponse>);

    const user = userEvent.setup();
    const router = renderAt(`/career/${careerId}/confirm`);
    await screen.findByRole('heading', { level: 1, name: '확정 전 정보를 확인하세요' });
    expect(screen.getByRole('heading', { level: 2, name: '김서준' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'KICKOFF' }));

    expect(await screen.findByRole('heading', { level: 1, name: '복구 코드를 저장하세요' })).toBeInTheDocument();
    expect(await screen.findByText('OFS-ABCD-2345-EFGH')).toBeInTheDocument();
    expect(router.state.location.search).toEqual({ step: 'recovery' });

    await user.click(screen.getByRole('button', { name: '저장했어요' }));

    // ADVANCE로 뽑힌 첫 이벤트는 랜덤 seed에 따라 달라진다(career-actions.advance는 후보 목록만
    // 계산하고, 그중 하나를 고르는 건 도메인의 가중 랜덤이다) — screenForCareer가 매핑하는 SCR-007
    // 계열 라우트 중 하나로만 도착했는지 확인한다.
    await waitFor(() => {
      expect(router.state.location.pathname).toMatch(new RegExp(`^/career/${careerId}/(path|tryout|event)$`));
    });
  });

  it('이미 발급된 프로필이면 복구 코드 화면 없이 곧바로 다음으로 넘어간다', async () => {
    const engine = setTestEngine();
    const careerId = await seedReadyForConfirm(engine);
    apiHolder.getProfile.mockResolvedValue({
      ok: true,
      data: { ...UNISSUED_PROFILE, recoveryCodeIssuedAt: '2026-08-01T00:00:00Z' },
    } satisfies ApiResult<Profile>);

    const user = userEvent.setup();
    const router = renderAt(`/career/${careerId}/confirm`);
    await screen.findByRole('heading', { level: 1, name: '확정 전 정보를 확인하세요' });

    await user.click(screen.getByRole('button', { name: 'KICKOFF' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toMatch(new RegExp(`^/career/${careerId}/(path|tryout|event)$`));
    });
    expect(apiHolder.issueRecoveryCode).not.toHaveBeenCalled();
  });

  it('프로필 조회가 실패하면 발급 불가 안내와 계속 버튼을 보여준다', async () => {
    const engine = setTestEngine();
    const careerId = await seedReadyForConfirm(engine);
    apiHolder.getProfile.mockResolvedValue({
      ok: false,
      error: { code: 'SERVICE_UNAVAILABLE', message: '서비스를 이용할 수 없습니다.', retryable: true },
    } satisfies ApiResult<Profile>);

    const user = userEvent.setup();
    const router = renderAt(`/career/${careerId}/confirm`);
    await screen.findByRole('heading', { level: 1, name: '확정 전 정보를 확인하세요' });

    await user.click(screen.getByRole('button', { name: 'KICKOFF' }));

    expect(
      await screen.findByText('지금은 발급할 수 없습니다. 설정에서 나중에 발급할 수 있습니다.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '계속' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toMatch(new RegExp(`^/career/${careerId}/(path|tryout|event)$`));
    });
  });

  it('새로고침(?step=recovery URL 재방문)해도 복구 코드 단계를 유지한다', async () => {
    const engine = setTestEngine();
    const careerId = await seedReadyForConfirm(engine);
    const confirmed = await confirmPlayer(engine, careerId);
    expect(confirmed.ok).toBe(true);
    const advanced = await advance(engine, careerId);
    expect(advanced.ok).toBe(true);

    apiHolder.getProfile.mockResolvedValue({ ok: true, data: UNISSUED_PROFILE } satisfies ApiResult<Profile>);
    apiHolder.issueRecoveryCode.mockResolvedValue({
      ok: true,
      data: { code: 'OFS-WXYZ-1234-MNOP', issuedAt: '2026-09-02T00:00:00Z' },
    } satisfies ApiResult<IssueRecoveryCodeResponse>);

    renderAt(`/career/${careerId}/confirm?step=recovery`);

    expect(await screen.findByRole('heading', { level: 1, name: '복구 코드를 저장하세요' })).toBeInTheDocument();
    expect(await screen.findByText('OFS-WXYZ-1234-MNOP')).toBeInTheDocument();
  });
});
