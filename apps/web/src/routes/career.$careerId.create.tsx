import { useEffect, useRef, useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useCareer, useCareerMutation } from '../engine/use-career.js';
import { rulesetForCareer } from '../engine/content.js';
import { CreationForm, type CreationValues } from '../shared/creation-form.js';
import { platform } from '../platform/index.js';
import { shouldResetArchetype } from '../shared/player-draft.js';
import { useCareerStepGuard } from '../shared/use-career-guard.js';
export const Route = createFileRoute('/career/$careerId/create')({ component: CreatePlayerScreen });
function CreatePlayerScreen() {
  const { careerId } = Route.useParams();
  const query = useCareer(careerId);
  const navigate = useNavigate();
  const mutation = useCareerMutation('updateDraft');
  const blocked = useCareerStepGuard(query.data?.state, 'SCR-002');
  useEffect(() => {
    platform.analytics.track('screen_viewed', { screenId: 'SCR-002', careerPhase: 'YOUTH' });
  }, []);
  const flight = useRef(false);
  const [error, setError] = useState<string | null>(null);
  if (blocked || !query.data) return <p role="status">선수 정보를 불러오는 중…</p>;
  const state = query.data.state;
  const ruleset = rulesetForCareer(state);
  async function submit(values: CreationValues) {
    if (flight.current) return;
    flight.current = true;
    setError(null);
    try {
      const result = await mutation.mutateAsync({
        careerId,
        draft: {
          ...values,
          ...(shouldResetArchetype(ruleset, values.position, state.player.draft.archetypeId)
            ? { archetypeId: null }
            : {}),
        },
      });
      if (!result.ok) throw new Error(result.error.message);
      try {
        sessionStorage.removeItem(`offside:player-creation:${careerId}`);
      } catch {
        /* no-op */
      }
      await navigate({ to: '/career/$careerId/style', params: { careerId } });
    } catch (error) {
      setError(error instanceof Error ? error.message : '저장하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      flight.current = false;
    }
  }
  return (
    <CreationForm
      key={careerId}
      draft={state.player.draft}
      ruleset={ruleset}
      storageKey={`offside:player-creation:${careerId}`}
      busy={mutation.isPending}
      error={error}
      onSubmit={(values) => void submit(values)}
    />
  );
}
