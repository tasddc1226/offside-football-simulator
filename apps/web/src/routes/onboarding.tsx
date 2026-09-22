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
import { Button } from '@offside/ui';
import { ensureProfile } from '../api/profile.js';
import { getAppEngine } from '../engine/engine.js';
import { queryClient } from '../shared/query-client.js';
import { annualPair, createAnnualPlayer } from '../engine/annual.js';

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
  const [annualDraft, setAnnualDraft] = useState<CreationValues | null>(null);
  const [archetype, setArchetype] = useState('');
  const ownerIntent = useRef<string | null>(null);
  const createKey = useRef(crypto.randomUUID());
  const life = useRef(new AbortController());
  useEffect(() => {
    const abort = new AbortController();
    life.current = abort;
    return () => abort.abort();
  }, []);
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
      if (service.data && annualPair(service.data)) {
        const engine = await getAppEngine();
        if (!(await ensureProfile(engine.store, queryClient)))
          throw new Error('새 선수는 서버에서 만듭니다. 인터넷 연결을 확인해 주세요.');
        ownerIntent.current =
          (await engine.store.transaction('readonly', (tx) => tx.kv.get<string>('profile:id'))) ??
          null;
        setAnnualDraft(values);
        setArchetype(
          ruleset.archetypes.find((item) => item.position === values.position)?.id ?? '',
        );
        createKey.current = crypto.randomUUID();
        return;
      }
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
  async function confirmAnnual() {
    if (!annualDraft || !ownerIntent.current || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await createAnnualPlayer(
        ownerIntent.current,
        { ...annualDraft, archetypeId: archetype },
        createKey.current,
        life.current.signal,
      );
      useUiStore.getState().setOnboardingSeen(true);
      sessionStorage.removeItem('offside:new-player');
      await navigate({
        to: '/career/$careerId',
        params: { careerId: result.snapshot.careerId },
        replace: true,
      });
    } catch (cause) {
      if (!life.current.signal.aborted)
        setError(cause instanceof Error ? cause.message : '연결을 확인해 주세요.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  if (annualDraft)
    return (
      <section className="os-panel flex flex-col gap-os-3">
        <p>새 선수 · {annualDraft.name}</p>
        <h1>어떤 선수로 출발할까요?</h1>
        <p>
          스타일을 고르면 서버에서 선수를 만듭니다. 정확한 시작 능력치는 생성 후 확인할 수 있어요.
        </p>
        <fieldset disabled={busy}>
          <legend>선수 스타일</legend>
          {ruleset.archetypes
            .filter((item) => item.position === annualDraft.position)
            .map((item) => (
              <label key={item.id} className="os-panel block">
                <input
                  type="radio"
                  name="annual-archetype"
                  value={item.id}
                  checked={archetype === item.id}
                  onChange={() => {
                    setArchetype(item.id);
                    createKey.current = crypto.randomUUID();
                  }}
                />{' '}
                {item.name}
                <p>{item.summary}</p>
              </label>
            ))}
        </fieldset>
        <p>
          1년씩 진행하며 이적·계약 등 중요한 결정이 생길 때만 멈춥니다. 생성과 진행에는 인터넷
          연결이 필요해요.
        </p>
        {error && <p role="alert">{error}</p>}
        <Button disabled={busy || !archetype} onClick={() => void confirmAnnual()}>
          {busy ? '서버에서 선수를 만들고 있어요' : '선수 만들기'}
        </Button>
        <Button disabled={busy} onClick={() => setAnnualDraft(null)}>
          선수 정보 수정
        </Button>
      </section>
    );
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
