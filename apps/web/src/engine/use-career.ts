// React 훅(TanStack Query). 쿼리 키는 ['careers'] · ['career', careerId]다.
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';
import type {
  CareerState,
  ClubMeetingRequest,
  NegotiationAsk,
  PlayerDraft,
  SimulationMode,
} from '@offside/domain';
import type { LocalCareerRecord } from '@offside/engine-client';
import type { StartSeasonChoice } from './career-actions.js';
import {
  acceptOffer,
  advance,
  advanceToDecision,
  confirmPlayer,
  createCareer,
  deleteCareer,
  negotiateOffer,
  rejectOffer,
  requestClubMeeting,
  resolveChapter,
  resolveEvent,
  resolveLoanReturn,
  resolveRole,
  settleSeason,
  startSeason,
  updateDraft,
} from './career-actions.js';
import { getAppEngine } from './engine.js';

export type CareerSummary = { record: LocalCareerRecord; state: CareerState };

/**
 * `LocalStore.transaction`의 careers.list() 구현(engine-client MemoryLocalStore ·
 * platform Dexie 구현 모두)이 이미 `updatedAt` 내림차순 · `id` 오름차순으로 정렬해 돌려준다.
 * platform의 `careers-sort.ts`는 package.json exports에 노출되어 있지 않아 apps/web에서 직접
 * import할 수 없다(PR 본문에 기록). 정렬은 store 계층에서 이미 보장되므로 여기서는 다시 하지 않는다.
 */
export const careersQueryOptions = queryOptions({
  queryKey: ['careers'] as const,
  queryFn: async (): Promise<CareerSummary[]> => {
    const engine = await getAppEngine();
    const records = await engine.client.listCareers();
    const loads = await Promise.all(records.map((record) => engine.client.loadCareer(record.id)));
    const summaries: CareerSummary[] = [];
    for (const load of loads) {
      if (load.ok) {
        summaries.push({ record: load.career, state: load.snapshot.state });
      }
    }
    return summaries;
  },
});

export function careerQueryOptions(careerId: string) {
  return queryOptions({
    queryKey: ['career', careerId] as const,
    queryFn: async (): Promise<CareerSummary> => {
      const engine = await getAppEngine();
      const load = await engine.client.loadCareer(careerId);
      if (!load.ok) {
        throw new Error(load.error.message);
      }
      return { record: load.career, state: load.snapshot.state };
    },
  });
}

export function useCareerList() {
  return useQuery(careersQueryOptions);
}

export function useCareer(careerId: string) {
  return useQuery(careerQueryOptions(careerId));
}

export type CareerMutationKind =
  | 'create'
  | 'updateDraft'
  | 'confirm'
  | 'advance'
  | 'advanceToDecision'
  | 'delete'
  | 'resolveEvent'
  | 'acceptOffer'
  | 'negotiateOffer'
  | 'rejectOffer'
  | 'resolveLoanReturn'
  | 'startSeason'
  | 'resolveRole'
  | 'settleSeason'
  | 'resolveChapter'
  | 'requestClubMeeting';

type CreateVariables = { simulationMode: SimulationMode };
type UpdateDraftVariables = { careerId: string; draft: Partial<PlayerDraft> };
type CareerIdVariables = { careerId: string };
type ResolveEventVariables = { careerId: string; choiceId: string };
type AcceptOfferVariables = { careerId: string; offerId: string };
type NegotiateOfferVariables = { careerId: string; offerId: string; ask: NegotiationAsk };
type RejectOfferVariables = { careerId: string; offerId: string | null };
type ResolveLoanReturnVariables = { careerId: string; decision: 'RETURN' | 'PERMANENT' };
type StartSeasonVariables = { careerId: string; choice: StartSeasonChoice };
type ResolveRoleVariables = { careerId: string; decision: 'ACCEPT' | 'DECLINE' };
type ResolveChapterVariables = { careerId: string; decisionId: string; optionId: string };
type RequestClubMeetingVariables = { careerId: string; request: ClubMeetingRequest };

async function runCareerMutation(kind: CareerMutationKind, variables: unknown) {
  const engine = await getAppEngine();
  switch (kind) {
    case 'create':
      return createCareer(engine, variables as CreateVariables);
    case 'updateDraft': {
      const { careerId, draft } = variables as UpdateDraftVariables;
      return updateDraft(engine, careerId, draft);
    }
    case 'confirm':
      return confirmPlayer(engine, (variables as CareerIdVariables).careerId);
    case 'advanceToDecision':
      return advanceToDecision(engine, (variables as CareerIdVariables).careerId);
    case 'advance':
      return advance(engine, (variables as CareerIdVariables).careerId);
    case 'delete':
      await deleteCareer(engine, (variables as CareerIdVariables).careerId);
      return undefined;
    case 'resolveEvent': {
      const { careerId, choiceId } = variables as ResolveEventVariables;
      return resolveEvent(engine, careerId, choiceId);
    }
    case 'acceptOffer': {
      const { careerId, offerId } = variables as AcceptOfferVariables;
      return acceptOffer(engine, careerId, offerId);
    }
    case 'negotiateOffer': {
      const { careerId, offerId, ask } = variables as NegotiateOfferVariables;
      return negotiateOffer(engine, careerId, offerId, ask);
    }
    case 'rejectOffer': {
      const { careerId, offerId } = variables as RejectOfferVariables;
      return rejectOffer(engine, careerId, offerId);
    }
    case 'resolveLoanReturn': {
      const { careerId, decision } = variables as ResolveLoanReturnVariables;
      return resolveLoanReturn(engine, careerId, decision);
    }
    case 'startSeason': {
      const { careerId, choice } = variables as StartSeasonVariables;
      return startSeason(engine, careerId, choice);
    }
    case 'resolveRole': {
      const { careerId, decision } = variables as ResolveRoleVariables;
      return resolveRole(engine, careerId, decision);
    }
    case 'settleSeason':
      return settleSeason(engine, (variables as CareerIdVariables).careerId);
    case 'resolveChapter': {
      const { careerId, decisionId, optionId } = variables as ResolveChapterVariables;
      return resolveChapter(engine, careerId, decisionId, optionId);
    }
    case 'requestClubMeeting': {
      const { careerId, request } = variables as RequestClubMeetingVariables;
      return requestClubMeeting(engine, careerId, request);
    }
    default: {
      const exhaustive: never = kind;
      throw new Error(`알 수 없는 mutation kind: ${String(exhaustive)}`);
    }
  }
}

type MutationDataFor<K extends CareerMutationKind> = K extends 'create'
  ? Awaited<ReturnType<typeof createCareer>>
  : K extends 'updateDraft'
    ? Awaited<ReturnType<typeof updateDraft>>
    : K extends
          | 'confirm'
          | 'advance'
          | 'advanceToDecision'
          | 'resolveEvent'
          | 'acceptOffer'
          | 'negotiateOffer'
          | 'rejectOffer'
          | 'resolveLoanReturn'
          | 'startSeason'
          | 'resolveRole'
          | 'settleSeason'
          | 'resolveChapter'
          | 'requestClubMeeting'
      ? Awaited<ReturnType<typeof confirmPlayer>>
      : void;

type MutationVariablesFor<K extends CareerMutationKind> = K extends 'create'
  ? CreateVariables
  : K extends 'updateDraft'
    ? UpdateDraftVariables
    : K extends 'resolveEvent'
      ? ResolveEventVariables
      : K extends 'acceptOffer'
        ? AcceptOfferVariables
        : K extends 'negotiateOffer'
          ? NegotiateOfferVariables
          : K extends 'rejectOffer'
            ? RejectOfferVariables
            : K extends 'resolveLoanReturn'
              ? ResolveLoanReturnVariables
              : K extends 'startSeason'
                ? StartSeasonVariables
                : K extends 'resolveRole'
                  ? ResolveRoleVariables
                  : K extends 'requestClubMeeting'
                    ? RequestClubMeetingVariables
                    : K extends 'resolveChapter'
                      ? ResolveChapterVariables
                      : CareerIdVariables;

/**
 * 액션 실행 후 ['careers']와(있다면) ['career', careerId] 쿼리를 무효화한다. 'delete'는
 * invalidate 대신 remove한다: staleTime(30s) 안에서 ensureQueryData(레이아웃 loader)가 캐시를
 * 그대로 돌려주면, 삭제된 careerId로 뒤로가기·딥링크했을 때 notFound() 없이 옛 화면이 보인다.
 */
export function useCareerMutation<K extends CareerMutationKind>(
  kind: K,
): UseMutationResult<MutationDataFor<K>, Error, MutationVariablesFor<K>> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: MutationVariablesFor<K>) =>
      runCareerMutation(kind, variables) as Promise<MutationDataFor<K>>,
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['careers'] });
      const careerId = 'careerId' in variables ? variables.careerId : undefined;
      if (careerId !== undefined) {
        if (kind === 'delete') {
          queryClient.removeQueries({ queryKey: ['career', careerId] });
        } else {
          await queryClient.invalidateQueries({ queryKey: ['career', careerId] });
        }
      }
    },
  });
}
