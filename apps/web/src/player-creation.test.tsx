// SCR-002·003·004 통합 테스트. app-routes.test.tsx와 같은 harness(getAppEngine 자리에
// inlineSimulator + MemoryLocalStore 테스트 엔진 주입)를 쓰고, 이 파일만 src/api/client.js를
// 함께 모킹해 복구 코드 단계의 분기(미발급/이미 발급/API 실패)를 검증한다.
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { MemoryLocalStore, inlineSimulator } from '@offside/engine-client';
import type { IssueRecoveryCodeResponse, Profile } from '@offside/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadRuleset } from '@offside/content';
import { serviceSeasonQueryOptions } from './engine/service-season.js';
import { TEST_SERVICE_SEASON } from './test/content-fixtures.js';
import { creationCandidates } from './shared/creation-candidates.js';
import { rulesetForCareer } from './engine/content.js';
import type { ApiResult } from './api/client.js';
import { advance, confirmPlayer, createCareer, updateDraft } from './engine/career-actions.js';
import { createAppEngine, type AppEngine } from './engine/engine.js';
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
  // __root.tsx가 항상 마운트하는 D-78 presence 훅용 — 이 파일의 시나리오와 무관해 조용히 무응답 처리한다.
  getLivePresence: () =>
    Promise.resolve({ ok: false, error: { code: 'NETWORK_ERROR', message: '', retryable: true } }),
  postPresenceHeartbeat: () => Promise.resolve({ ok: true, data: undefined }),
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
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
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
  settings: {
    reducedMotion: 'SYSTEM',
    textScale: 100,
    theme: 'SYSTEM',
    defaultSimulationMode: 'FAST',
  },
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

describe('SCR-002 한 화면 선수 생성', () => {
  it('이름과 기본값으로 시작하고, 직접 고른 주발과 포지션을 저장한다', async () => {
    const engine = setTestEngine();
    const careerId = await createDraftCareer(engine);
    const user = userEvent.setup();
    const router = renderAt(`/career/${careerId}/create`);
    await screen.findByRole('heading', { name: '선수 생성' });
    await user.type(screen.getByLabelText('이름'), '김서준');
    await user.click(screen.getByRole('radio', { name: '왼발' }));
    await user.click(screen.getByRole('radio', { name: /윙어/ }));
    await user.click(screen.getByRole('button', { name: /다음 · 후보 카드 열기/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/career/${careerId}/style`));
    const load = await engine.client.loadCareer(careerId);
    expect(load.ok && load.snapshot.state.player.draft).toMatchObject({
      name: '김서준',
      preferredFoot: 'LEFT',
      position: 'W',
      gender: 'UNSPECIFIED',
      nationalityCode: 'KR',
    });
  });

  it('빈 이름과 등장인물 이름을 거부하고 수정하면 오류가 사라진다', async () => {
    const careerId = await createDraftCareer(setTestEngine());
    const user = userEvent.setup();
    renderAt(`/career/${careerId}/create`);
    const name = await screen.findByLabelText('이름');
    await user.click(screen.getByRole('button', { name: /다음 · 후보 카드 열기/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/이름은 .+자여야 합니다/);
    expect(name).toHaveFocus();
    await user.type(name, '이도현');
    await user.click(screen.getByRole('button', { name: /다음 · 후보 카드 열기/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('게임 속 등장인물 이름과 같아요');
    await user.clear(name);
    await user.type(name, '김서준');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('잘못된 임시 저장은 무시하고, 정상 입력은 재방문에도 유지한다', async () => {
    const careerId = await createDraftCareer(setTestEngine());
    sessionStorage.setItem(
      `offside:player-creation:${careerId}`,
      JSON.stringify({ version: 3, form: { name: '잘못된 값', position: 'BAD' } }),
    );
    const user = userEvent.setup();
    renderAt(`/career/${careerId}/create`);
    expect(await screen.findByLabelText('이름')).toHaveValue('');
    await user.type(screen.getByLabelText('이름'), '김서준');
    await user.click(screen.getByRole('radio', { name: '양발' }));
    renderAt(`/career/${careerId}/create`);
    expect(await screen.findByLabelText('이름')).toHaveValue('김서준');
    expect(screen.getByRole('radio', { name: '양발' })).toHaveAttribute('aria-checked', 'true');
  });

  it('저장 실패에도 입력을 유지하고 같은 폼에서 재시도한다', async () => {
    const engine = setTestEngine();
    const careerId = await createDraftCareer(engine);
    vi.spyOn(engine.client, 'execute').mockResolvedValueOnce({
      ok: false,
      error: { code: 'VALIDATION_FAILED', message: '저장하지 못했습니다.' },
    });
    const user = userEvent.setup();
    const router = renderAt(`/career/${careerId}/create`);
    await user.type(await screen.findByLabelText('이름'), '김서준');
    await user.click(screen.getByRole('button', { name: /다음 · 후보 카드 열기/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('저장하지 못했습니다.');
    expect(screen.getByLabelText('이름')).toHaveValue('김서준');
    await user.click(screen.getByRole('button', { name: /다음 · 후보 카드 열기/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/career/${careerId}/style`));
  });
});

describe('SCR-003 후보 카드', () => {
  async function seedToStyle(engine: AppEngine) {
    const careerId = await createDraftCareer(engine);
    await updateDraft(engine, careerId, {
      name: '김서준',
      gender: 'UNSPECIFIED',
      nationalityCode: 'KR',
      preferredFoot: 'LEFT',
      position: 'W',
      backgroundId: 'club-academy',
    });
    return careerId;
  }
  it('봉인된 3장을 공개하고 실제 능력치를 비교한 뒤 후보를 확정한다', async () => {
    const careerId = await seedToStyle(setTestEngine());
    const user = userEvent.setup();
    const router = renderAt(`/career/${careerId}/style`);
    await screen.findByRole('heading', { name: '세 가지 가능성' });
    expect(screen.getAllByRole('button', { name: /후보 [123] 공개/ })).toHaveLength(3);
    expect(screen.getByRole('button', { name: /이 후보로 진행/ })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '3장 모두 열기' }));
    expect(screen.getAllByRole('meter')).toHaveLength(6);
    await user.click(screen.getByRole('button', { name: '인사이드 포워드 후보 선택' }));
    await user.click(screen.getByRole('button', { name: /이 후보로 진행/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/career/${careerId}/confirm`));
  });
  it('재방문에도 공개와 선택을 유지하며 능력치가 다시 추첨되지 않는다', async () => {
    const careerId = await seedToStyle(setTestEngine());
    const user = userEvent.setup();
    renderAt(`/career/${careerId}/style`);
    await user.click(await screen.findByRole('button', { name: '후보 2 공개' }));
    const stats = screen.getAllByRole('meter').map((m) => m.getAttribute('value'));
    renderAt(`/career/${careerId}/style`);
    await screen.findByRole('button', { name: /후보 선택/ });
    expect(screen.getAllByRole('button', { name: /후보 선택/ })).toHaveLength(1);
    expect(screen.getAllByRole('meter').map((m) => m.getAttribute('value'))).toEqual(stats);
    expect(screen.getByRole('button', { name: /후보 선택/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
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

    await screen.findByRole('heading', { level: 1, name: '선수 생성' });
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
    await screen.findByRole('heading', { level: 1, name: '선수 생성' });

    await user.click(screen.getByRole('radio', { name: /스트라이커/ }));
    await user.click(screen.getByRole('button', { name: /다음 · 후보 카드 열기/ }));

    await screen.findByRole('heading', { level: 1, name: '세 가지 가능성' });
    expect(screen.queryByText('선택됨')).not.toBeInTheDocument();
  });
});

describe('SCR-004 확인 및 첫 계약 뒤 복구 코드', () => {
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

  it('확정 카드에는 선수 정보와 실제 OVR을 보여주며 내부 버전은 노출하지 않는다', async () => {
    const careerId = await seedReadyForConfirm(setTestEngine());
    renderAt(`/career/${careerId}/confirm`);
    await screen.findByRole('heading', { name: '이번 생의 주인공' });
    expect(screen.getByRole('region', { name: '김서준 선수 카드' })).toHaveTextContent('OVR');
    expect(
      screen.queryByText(`${TEST_RULESET_VERSION} / ${TEST_CONTENT_PACK_VERSION}`),
    ).not.toBeInTheDocument();
  });

  it('선수 요약을 보여주고 KICKOFF 확정 후 복구 발급으로 막지 않고 첫 결정으로 이동한다', async () => {
    const engine = setTestEngine();
    const careerId = await seedReadyForConfirm(engine);

    const user = userEvent.setup();
    const router = renderAt(`/career/${careerId}/confirm`);
    await screen.findByRole('heading', { level: 1, name: '이번 생의 주인공' });
    expect(screen.getByRole('heading', { level: 2, name: '김서준' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /이 선수로 시작/ }));

    // ADVANCE로 뽑힌 첫 이벤트는 랜덤 seed에 따라 달라진다(career-actions.advance는 후보 목록만
    // 계산하고, 그중 하나를 고르는 건 도메인의 가중 랜덤이다) — screenForCareer가 매핑하는 SCR-007
    // 계열 라우트 중 하나로만 도착했는지 확인한다.
    await waitFor(() => {
      expect(router.state.location.pathname).toMatch(
        new RegExp(`^/career/${careerId}/(path|tryout|event)$`),
      );
    });
    expect(apiHolder.getProfile).not.toHaveBeenCalled();
    expect(apiHolder.issueRecoveryCode).not.toHaveBeenCalled();
  });

  it('첫 계약 뒤 이미 발급된 프로필이면 복구 코드 화면 없이 서명 완료 대시보드로 넘어간다', async () => {
    const engine = setTestEngine();
    const careerId = await seedReadyForConfirm(engine);
    const confirmed = await confirmPlayer(engine, careerId);
    expect(confirmed.ok).toBe(true);
    const advanced = await advance(engine, careerId);
    expect(advanced.ok).toBe(true);
    apiHolder.getProfile.mockResolvedValue({
      ok: true,
      data: { ...UNISSUED_PROFILE, recoveryCodeIssuedAt: '2026-08-01T00:00:00Z' },
    } satisfies ApiResult<Profile>);

    const router = renderAt(`/career/${careerId}/confirm?step=recovery&milestone=first-contract`);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/career/${careerId}`);
    });
    expect(await screen.findByText('계약을 맺었습니다')).toBeInTheDocument();
    expect(apiHolder.issueRecoveryCode).not.toHaveBeenCalled();
  });

  it('첫 계약 뒤 프로필 조회가 실패하면 발급 불가 안내 뒤 서명 완료 대시보드로 계속한다', async () => {
    const engine = setTestEngine();
    const careerId = await seedReadyForConfirm(engine);
    const confirmed = await confirmPlayer(engine, careerId);
    expect(confirmed.ok).toBe(true);
    const advanced = await advance(engine, careerId);
    expect(advanced.ok).toBe(true);
    apiHolder.getProfile.mockResolvedValue({
      ok: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: '서비스를 이용할 수 없습니다.',
        retryable: true,
      },
    } satisfies ApiResult<Profile>);

    const user = userEvent.setup();
    const router = renderAt(`/career/${careerId}/confirm?step=recovery&milestone=first-contract`);

    expect(
      await screen.findByText('지금은 발급할 수 없습니다. 설정에서 나중에 발급할 수 있습니다.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '계속' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/career/${careerId}`);
    });
    expect(await screen.findByText('계약을 맺었습니다')).toBeInTheDocument();
  });

  it('첫 계약 뒤 새로고침(?step=recovery URL 재방문)해도 복구 코드 단계를 유지한다', async () => {
    const engine = setTestEngine();
    const careerId = await seedReadyForConfirm(engine);
    const confirmed = await confirmPlayer(engine, careerId);
    expect(confirmed.ok).toBe(true);
    const advanced = await advance(engine, careerId);
    expect(advanced.ok).toBe(true);

    apiHolder.getProfile.mockResolvedValue({
      ok: true,
      data: UNISSUED_PROFILE,
    } satisfies ApiResult<Profile>);
    apiHolder.issueRecoveryCode.mockResolvedValue({
      ok: true,
      data: { code: 'OFS-WXYZ-1234-MNOP', issuedAt: '2026-09-02T00:00:00Z' },
    } satisfies ApiResult<IssueRecoveryCodeResponse>);

    const router = renderAt(`/career/${careerId}/confirm?step=recovery&milestone=first-contract`);

    expect(
      await screen.findByRole('heading', { level: 1, name: '복구 코드를 저장하세요' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('OFS-WXYZ-1234-MNOP')).toBeInTheDocument();
    expect(router.state.location.search).toEqual({
      step: 'recovery',
      milestone: 'first-contract',
    });
  });
});

// Cross-check the UI projection against the committed engine command for every position/style.
describe('후보 능력치와 확정 결과', () => {
  it.each(['1.0.0', '2.0.0'])(
    '%s: 모든 후보가 확정 결과와 일치하고 RNG를 소비하지 않는다',
    async (version) => {
      const engine = setTestEngine();
      queryClient.setQueryData(serviceSeasonQueryOptions.queryKey, {
        ...TEST_SERVICE_SEASON,
        rulesetVersion: version,
        contentPackVersion: version === '2.0.0' ? '0.7.0' : '0.1.0',
      });
      for (const archetype of loadRuleset(version).archetypes) {
        const id = await createDraftCareer(engine);
        const updated = await updateDraft(engine, id, {
          name: '김서준',
          gender: 'MALE',
          nationalityCode: 'KR',
          preferredFoot: 'LEFT',
          position: archetype.position,
          backgroundId: 'club-academy',
        });
        if (!updated.ok) throw new Error(updated.error.message);
        const state = updated.domainSnapshot.state;
        const original = JSON.stringify(state);
        const candidates = creationCandidates(state, rulesetForCareer(state));
        expect(candidates).toHaveLength(3);
        expect(creationCandidates(state, rulesetForCareer(state))).toEqual(candidates);
        expect(JSON.stringify(state)).toBe(original);
        const candidate = candidates.find((c) => c.id === archetype.id)!;
        expect(candidate).not.toHaveProperty('truePotential');
        await updateDraft(engine, id, { archetypeId: candidate.id });
        const confirmed = await confirmPlayer(engine, id);
        if (!confirmed.ok) throw new Error(confirmed.error.message);
        expect(confirmed.domainSnapshot.state.attributes).toEqual(candidate.attributes);
        expect(confirmed.domainSnapshot.state.player.profile?.baseOvr).toBe(candidate.ovr);
      }
    },
  );
});
