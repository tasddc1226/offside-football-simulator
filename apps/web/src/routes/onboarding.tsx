// Creation now starts directly with the profile form. No tutorial or timed entry gate.
import { useEffect, useRef, useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { activeRuleset, rulesetForCareer } from '../engine/content.js';
import { useServiceSeason } from '../engine/service-season.js';
import { useCareerMutation } from '../engine/use-career.js';
import { markOnboardingPending } from '../engine/funnel.js';
import { useUiStore } from '../shared/ui-store.js';
import { CreationForm, type CreationValues } from '../shared/creation-form.js';
import { platform } from '../platform/index.js';
import { FIXED_SIMULATION_MODE } from '../shared/start-season.js';

export const Route = createFileRoute('/onboarding')({ component: OnboardingScreen });
function OnboardingScreen() {
  const navigate = useNavigate();
  const service = useServiceSeason();
  const create = useCareerMutation('create');
  const update = useCareerMutation('updateDraft');
  const inFlight = useRef(false);
  const createdId = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ruleset = service.data ? rulesetForCareer(service.data) : activeRuleset;
  useEffect(() => {
    platform.analytics.track('screen_viewed', { screenId: 'SCR-034', careerPhase: 'NONE' });
    void markOnboardingPending();
  }, []);
  async function submit(values: CreationValues) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      if (createdId.current === null) {
        const result = await create.mutateAsync({ simulationMode: FIXED_SIMULATION_MODE });
        if (!result.ok) throw new Error(result.error.message);
        createdId.current = result.snapshot.careerId;
      }
      const careerId = createdId.current;
      const result = await update.mutateAsync({
        careerId,
        draft: { ...values, archetypeId: null },
      });
      if (!result.ok) throw new Error(result.error.message);
      useUiStore.getState().setOnboardingSeen(true);
      try {
        sessionStorage.removeItem('offside:new-player');
      } catch {
        /* no-op */
      }
      await navigate({ to: '/career/$careerId/style', params: { careerId }, replace: true });
    } catch (error) {
      setError(
        error instanceof Error ? error.message : '선수를 준비하지 못했습니다. 다시 시도해 주세요.',
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <CreationForm
      ruleset={ruleset}
      storageKey="offside:new-player"
      busy={busy}
      error={error}
      onSubmit={(values) => void submit(values)}
    />
  );
}
