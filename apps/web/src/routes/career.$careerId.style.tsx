import { useEffect, useRef, useState } from 'react';
import { Button } from '@offside/ui';
import { ATTRIBUTE_KEYS } from '@offside/domain';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { rulesetForCareer } from '../engine/content.js';
import { useCareer, useCareerMutation } from '../engine/use-career.js';
import { platform } from '../platform/index.js';
import { ATTRIBUTE_LABELS, POSITION_LABELS } from '../shared/labels.js';
import { creationCandidates } from '../shared/creation-candidates.js';
import { useCareerStepGuard } from '../shared/use-career-guard.js';
import '../shared/creation-flow.css';
export const Route = createFileRoute('/career/$careerId/style')({ component: StyleScreen });
function StyleScreen() {
  const { careerId } = Route.useParams();
  const query = useCareer(careerId);
  const navigate = useNavigate();
  const blocked = useCareerStepGuard(query.data?.state, 'SCR-003');
  const mutation = useCareerMutation('updateDraft');
  useEffect(() => {
    platform.analytics.track('screen_viewed', { screenId: 'SCR-003', careerPhase: 'YOUTH' });
  }, []);
  const flight = useRef(false);
  const [revealed, setRevealed] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const candidates = query.data
    ? creationCandidates(query.data.state, rulesetForCareer(query.data.state))
    : [];
  const savedId = query.data?.state.player.draft.archetypeId;
  const identity = `${careerId}:${query.data?.state.player.draft.position ?? ''}:${query.data?.state.player.draft.backgroundId ?? ''}`;
  const candidateIds = candidates.map((candidate) => candidate.id).join(',');
  useEffect(() => {
    const validIds = candidateIds.split(',');
    let opened: string[] = [];
    let selection: string | null = savedId && validIds.includes(savedId) ? savedId : null;
    try {
      const saved = JSON.parse(sessionStorage.getItem(`offside:candidates:${identity}`) ?? 'null');
      if (Array.isArray(saved?.revealed))
        opened = Array.from(
          new Set(
            saved.revealed.filter(
              (id: unknown): id is string => typeof id === 'string' && validIds.includes(id),
            ),
          ),
        );
      if (typeof saved?.selected === 'string' && validIds.includes(saved.selected))
        selection = saved.selected;
    } catch {
      /* recover from the engine draft */
    }
    setRevealed(selection ? Array.from(new Set([...opened, selection])) : opened);
    setSelected(selection);
  }, [identity, savedId, candidateIds]);
  function choose(id: string) {
    const next = Array.from(new Set([...revealed, id]));
    setRevealed(next);
    setSelected(id);
    try {
      sessionStorage.setItem(
        `offside:candidates:${identity}`,
        JSON.stringify({ revealed: next, selected: id }),
      );
    } catch {
      /* seed still preserves exact candidates */
    }
  }
  function revealAll() {
    const ids = candidates.map((c) => c.id);
    setRevealed(ids);
    setSelected(selected ?? ids[0]!);
    try {
      sessionStorage.setItem(
        `offside:candidates:${identity}`,
        JSON.stringify({ revealed: ids, selected: selected ?? ids[0] }),
      );
    } catch {
      /* no-op */
    }
  }
  async function submit() {
    if (!selected || flight.current) return;
    flight.current = true;
    setError(null);
    try {
      const result = await mutation.mutateAsync({ careerId, draft: { archetypeId: selected } });
      if (!result.ok) throw new Error(result.error.message);
      await navigate({ to: '/career/$careerId/confirm', params: { careerId } });
    } catch (error) {
      setError(
        error instanceof Error ? error.message : '후보를 저장하지 못했습니다. 다시 시도해 주세요.',
      );
    } finally {
      flight.current = false;
    }
  }
  if (blocked || !query.data) return <p role="status">후보를 준비하는 중…</p>;
  const current = candidates.find((c) => c.id === selected);
  const keys = current
    ? ATTRIBUTE_KEYS.filter(
        (key) => key !== 'goalkeeping' || query.data.state.player.draft.position === 'GK',
      )
        .slice()
        .sort((a, b) => current.attributes[b] - current.attributes[a])
        .slice(0, 6)
    : [];
  return (
    <div className="creation-flow">
      <header className="creation-heading">
        <div>
          <p>SCOUT REPORT · 02</p>
          <h1>세 가지 가능성</h1>
        </div>
        <Link to="/career/$careerId/create" params={{ careerId }}>
          수정
        </Link>
      </header>
      <p className="creation-lead">
        {query.data.state.player.draft.name} ·{' '}
        {POSITION_LABELS[query.data.state.player.draft.position!]}
        <br />
        카드를 열어, 키우고 싶은 선수를 골라 보세요.
      </p>
      <div className="creation-candidates" aria-label="능력치 후보 3명">
        {candidates.map((candidate, index) => {
          const open = revealed.includes(candidate.id);
          return (
            <button
              type="button"
              key={candidate.id}
              className="creation-candidate"
              data-open={open}
              aria-pressed={selected === candidate.id}
              aria-label={open ? `${candidate.name} 후보 선택` : `후보 ${index + 1} 공개`}
              onClick={() => choose(candidate.id)}
              disabled={mutation.isPending}
            >
              <small>0{index + 1}</small>
              <svg viewBox="0 0 72 80" aria-hidden="true">
                <path
                  d="M23 8 10 14 2 34 17 40 20 31 20 74 52 74 52 31 55 40 70 34 62 14 49 8Q36 22 23 8Z"
                  fill="currentColor"
                />
                <text x="36" y="53" textAnchor="middle">
                  {open ? candidate.ovr : '?'}
                </text>
              </svg>
              <strong>{open ? candidate.name : '아직 모르는 나'}</strong>
              <span>{open ? '후보 보기' : '눌러서 공개'}</span>
            </button>
          );
        })}
      </div>
      <section className="creation-report" aria-label="후보 능력치" aria-live="polite">
        {current ? (
          <>
            <div className="creation-report-heading">
              <div>
                <small>SCOUT REPORT</small>
                <h2>{current.name}</h2>
              </div>
              <strong>
                <small>OVR</small> {current.ovr}
              </strong>
            </div>
            <p>{current.description}</p>
            <div className="creation-bars">
              {keys.map((key) => (
                <div key={key}>
                  <label htmlFor={`candidate-${key}`}>
                    {ATTRIBUTE_LABELS[key]} <b>{current.attributes[key]}</b>
                  </label>
                  <meter
                    id={`candidate-${key}`}
                    min={0}
                    max={100}
                    value={current.attributes[key]}
                  />
                </div>
              ))}
            </div>
            <p className="creation-note">
              실제로 시작할 능력치입니다. 같은 후보는 다시 열어도 바뀌지 않아요.
            </p>
          </>
        ) : (
          <div className="creation-empty">
            <b>어떤 선수가 기다릴까요?</b>
            <p>세 장의 카드에 서로 다른 강점이 담겨 있습니다.</p>
          </div>
        )}
        {revealed.length < candidates.length && (
          <button
            type="button"
            className="creation-open-all"
            onClick={revealAll}
            disabled={mutation.isPending}
          >
            3장 모두 열기
          </button>
        )}
      </section>
      {error && (
        <p role="alert" className="creation-error">
          {error}
        </p>
      )}
      <div className="creation-action">
        <Button onClick={() => void submit()} disabled={!current || mutation.isPending}>
          {mutation.isPending ? '후보 저장 중…' : '이 후보로 진행 →'}
        </Button>
      </div>
    </div>
  );
}
