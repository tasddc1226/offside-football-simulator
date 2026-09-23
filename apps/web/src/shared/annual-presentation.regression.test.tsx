import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { buildAnnualContentContext, loadContentPack, loadRuleset } from '@offside/content';
import { AnnualReportSchema } from '@offside/contracts';
import {
  ATTRIBUTE_KEYS,
  nextAnnualAction,
  simulate,
  startAnnualRun,
  type Command,
  type DomainSnapshot,
} from '@offside/domain';
import { AnnualCareerScreen, AnnualReport } from './annual-career.js';
import { ATTRIBUTE_LABELS } from './labels.js';

const mocks = vi.hoisted(() => ({ career: vi.fn(), cache: vi.fn() }));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));
vi.mock('../engine/use-career.js', () => ({ useCareer: () => mocks.career() }));
vi.mock('../engine/engine.js', () => ({
  getAppEngine: async () => ({
    store: {
      transaction: async (_mode: unknown, fn: (tx: unknown) => unknown) =>
        fn({ kv: { get: async () => 'new-owner' } }),
    },
  }),
}));
vi.mock('../api/profile.js', () => ({ ensureProfile: async () => true }));
vi.mock('../engine/annual.js', () => ({
  cacheAnnualCareer: (...args: unknown[]) => mocks.cache(...args),
  AnnualController: class {
    abort = new AbortController();
    async refresh() { return null; }
    async history() { return []; }
    dispose() {
      this.abort.abort();
    }
  },
}));

function naturalReport() {
  const rules = loadRuleset('3.5.0'),
    pack = loadContentPack('0.14.0');
  let snapshot: DomainSnapshot | null = null;
  const execute = (command: Command) => {
    const result = simulate({
      snapshot,
      ruleset: rules,
      rulesetVersion: '3.5.0',
      contentPackVersion: '0.14.0',
      command: {
        ...command,
        commandId: `presentation-${snapshot?.revision ?? 0}`,
        expectedRevision: snapshot?.revision ?? 0,
      },
    });
    if (!result.ok) throw new Error(result.error.message);
    snapshot = result.snapshot;
    return result.snapshot;
  };
  execute({
    type: 'CREATE_CAREER',
    payload: {
      careerId: 'presentation-career',
      seed: 'annual-natural:FW:0',
      simulationMode: 'FAST',
      rulesetVersion: '3.5.0',
      contentPackVersion: '0.14.0',
    },
  });
  const archetype = rules.archetypes.find((item) => item.position === 'ST')!;
  execute({
    type: 'UPDATE_PLAYER_DRAFT',
    payload: {
      draft: {
        name: '실제원장',
        gender: 'MALE',
        nationalityCode: 'KR',
        preferredFoot: 'RIGHT',
        position: 'ST',
        archetypeId: archetype.id,
        backgroundId: rules.backgrounds[0]!.id,
      },
    },
  });
  let current = execute({ type: 'CONFIRM_PLAYER', payload: {} });
  const checkpoint = startAnnualRun(current, rules, { serviceSeasonId: 'presentation-test' });
  for (let count = 0; count < 240; count++) {
    const action = nextAnnualAction(
      current,
      rules,
      checkpoint,
      buildAnnualContentContext(pack, current.state),
    );
    if (action.status === 'ERROR') throw new Error(action.code);
    if (action.status === 'COMPLETED')
      return { state: current.state, report: AnnualReportSchema.parse(action.report) };
    current = execute(
      action.status === 'COMMAND' ? action.command : action.decision.choices[0]!.command,
    );
  }
  throw new Error('Natural report exceeded bounded test');
}
const fixture = naturalReport();
beforeEach(() => vi.clearAllMocks());
describe('independent annual presentation regressions', () => {
  it('uses the application shell main landmark without nesting another main', async () => {
    mocks.career.mockReturnValue({data:{record:{revision:fixture.report.endRevision,ownerProfileId:'new-owner'},state:fixture.state}});
    mocks.cache.mockResolvedValue({});
    const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
    client.setQueryData(['profile'],{id:'new-owner'});
    render(<QueryClientProvider client={client}><main aria-label="본문"><AnnualCareerScreen careerId="presentation-career" /></main></QueryClientProvider>);
    await screen.findByRole('button',{name:'1년 진행'});
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });
  it('renders a real completed-year DTO and all 20 annual attribute rows plus settlement causes', () => {
    render(<AnnualReport {...fixture} />);
    expect(screen.getByRole('region', { name: '1년차 결과' })).toHaveTextContent(
      `${fixture.report.minutes.toLocaleString()}분`,
    );
    const table = screen.getByRole('table', { hidden: true });
    expect(within(table).getAllByRole('row', { hidden: true })).toHaveLength(21);
    for (const key of ATTRIBUTE_KEYS)
      expect(within(table).getByText(ATTRIBUTE_LABELS[key])).toBeInTheDocument();
    expect(screen.getAllByText(/정산 기여:/)).toHaveLength(20);
    expect(fixture.report.season?.result.attributeDeltas).toHaveLength(20);
  });
  it('keeps signed year/settlement/during-year values separate in a controlled display counterexample', () => {
    const report = AnnualReportSchema.parse({
      ...fixture.report,
      baseOvr: { before: 60, after: 58, delta: -2 },
      attributes: fixture.report.attributes.map((entry, index) =>
        index === 0
          ? { ...entry, before: 60, after: 58, delta: -2, settlementDelta: 1, duringYearDelta: -3 }
          : entry,
      ),
    });
    render(<AnnualReport state={fixture.state} report={report} />);
    const row = screen
      .getByText(ATTRIBUTE_LABELS[report.attributes[0]!.key as keyof typeof ATTRIBUTE_LABELS], {
        selector: 'th',
      })
      .closest('tr')!;
    expect(
      within(row)
        .getAllByRole('cell', { hidden: true })
        .map((cell) => cell.textContent),
    ).toEqual(['60', '58', '-2', '+1', '-3']);
    expect(screen.getByText('60 → 58 (-2)')).toBeInTheDocument();
  });
  it('does not expose cached retired read-only content when canonical ownership lookup fails', async () => {
    mocks.career.mockReturnValue({
      data: {
        record: { revision: fixture.report.endRevision, ownerProfileId: 'old-owner' },
        state: { ...fixture.state, status: 'RETIRED' },
      },
    });
    mocks.cache.mockRejectedValue(new Error('커리어를 찾을 수 없습니다.'));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(['profile'], { id: 'new-owner' });
    render(
      <QueryClientProvider client={client}>
        <AnnualCareerScreen
          careerId="presentation-career"
          readOnlyContent={<p>이전 계정 비공개 은퇴 기록</p>}
        />
      </QueryClientProvider>,
    );
    expect(screen.queryByText('이전 계정 비공개 은퇴 기록')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('커리어를 찾을 수 없습니다.'),
    );
    expect(screen.queryByText('이전 계정 비공개 은퇴 기록')).not.toBeInTheDocument();
  });
});
