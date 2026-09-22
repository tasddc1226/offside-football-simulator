import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Button } from '@offside/ui';
import {
  DEFAULT_ANNUAL_POLICY,
  type AnnualPolicy,
  type AttributeKey,
  type CareerState,
} from '@offside/domain';
import type { AnnualReportView, AnnualRunResponse } from '@offside/contracts';
import { AnnualController, cacheAnnualCareer } from '../engine/annual.js';
import { getAppEngine } from '../engine/engine.js';
import { ensureProfile } from '../api/profile.js';
import { queryClient } from './query-client.js';
import { useCareer } from '../engine/use-career.js';
import { contentForCareer, rulesetForCareer } from '../engine/content.js';
import { ATTRIBUTE_LABELS, SQUAD_ROLE_LABELS, POSITION_LABELS } from './labels.js';
import { formatKrw } from './format.js';
import { buildNarrativeTokens, renderNarrative } from './narrative.js';

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
const FAMILY = {
  OPPORTUNITY: '출전 기회',
  ROLE_TENSION: '감독과 역할 논의',
  SCOUT_INTEREST: '구단의 관심',
};

export function AnnualReport({ report, state }: { report: AnnualReportView; state: CareerState }) {
  const pack = contentForCareer(state);
  const ruleset = rulesetForCareer(state);
  const tokens = buildNarrativeTokens(state, pack, ruleset);
  const team =
    ruleset.teams.find((item) => item.id === report.season?.teamId)?.name ?? '당시 소속팀';
  const historicTokens = { ...tokens, team, club: team, manager: '당시 감독' };
  return (
    <section
      className="os-panel flex flex-col gap-os-3"
      aria-label={`${report.targetSeasonIndex}년차 결과`}
    >
      <h2>
        {report.targetSeasonIndex}년차 {report.retired ? '커리어 마무리' : '완료'}
      </h2>
      <p>
        실제 출전 <strong>{report.minutes.toLocaleString()}분</strong> · OVR{' '}
        <strong>
          {report.baseOvr.before} → {report.baseOvr.after} ({signed(report.baseOvr.delta)})
        </strong>
      </p>
      <p>
        {report.startAge}세 → {report.endAge}세
        {report.startedMidSeason ? ' · 진행 중이던 해의 남은 일정부터 계산했습니다.' : ''}
      </p>
      <p>
        {report.attributes
          .filter((a) => a.delta > 0)
          .sort((a, b) => b.delta - a.delta)
          .slice(0, 3)
          .map((a) => `${ATTRIBUTE_LABELS[a.key as AttributeKey] ?? a.key} ${signed(a.delta)}`)
          .join(' · ') || '이번 해에는 영구 능력치 상승이 없었습니다.'}
      </p>
      <details>
        <summary>전체 능력치 20개와 성장 내역</summary>
        <p>
          전체 변화는 한 해를 시작할 때와 끝났을 때의 차이입니다. 정산 외 변화에는 그 사이 사건의
          영향 등이 포함됩니다. 정산 성장은 출전 시간·훈련·나이·잠재력 제한을 함께 반영합니다.
        </p>
        <div className="overflow-x-auto">
          <table>
            <caption>능력치 변화 — 시작 / 끝 / 전체 / 정산 / 정산 외</caption>
            <thead>
              <tr>
                <th>능력치</th>
                <th>시작</th>
                <th>끝</th>
                <th>전체</th>
                <th>정산</th>
                <th>정산 외</th>
              </tr>
            </thead>
            <tbody>
              {report.attributes.map((a) => (
                <tr key={a.key}>
                  <th>{ATTRIBUTE_LABELS[a.key as AttributeKey] ?? a.key}</th>
                  <td>{a.before}</td>
                  <td>{a.after}</td>
                  <td>{signed(a.delta)}</td>
                  <td>{signed(a.settlementDelta)}</td>
                  <td>{signed(a.duringYearDelta)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {report.season?.result.attributeDeltas.map((attribute) => (
          <p key={attribute.key}>
            {ATTRIBUTE_LABELS[attribute.key]} 정산 기여:{' '}
            {attribute.causes
              .map(
                (c) =>
                  `${{ TRAINING: '훈련', MINUTES: '출전', EXPERIENCE: '경험', AGE_DECLINE: '나이', POTENTIAL_CAP: '잠재력 제한' }[c.cause]} ${signed(c.centi / 100)}`,
              )
              .join(' · ')}
          </p>
        ))}
      </details>
      {report.stories.length > 0 && (
        <details>
          <summary>이어진 이야기</summary>
          <ul>
            {report.stories.map((thread) => (
              <li key={thread.id}>
                {FAMILY[thread.family]} · {thread.actor.name} · {thread.sourceSeason}년차{' '}
                {thread.sourceStep}단계, 당시 {thread.sourceMinutes}분 출전 ·{' '}
                {thread.stage === 'FOLLOW_UP'
                  ? '다음 흐름으로 이어지는 중'
                  : thread.stage === 'CANCELLED'
                    ? '상황이 바뀌어 종료'
                    : thread.stage === 'OPEN'
                      ? '논의 중'
                      : '이야기 종료'}
              </li>
            ))}
          </ul>
        </details>
      )}
      {report.events.length > 0 && (
        <details>
          <summary>그해의 결정과 실제 결과</summary>
          <ul>
            {report.events.map((event) => {
              const definition = pack.events.find((item) => item.id === event.eventId);
              const choice = definition?.choices.find((item) => item.id === event.choiceId);
              const outcome = choice?.outcomes.find((item) => item.id === event.outcomeId);
              const family = event.eventId.startsWith('EVT-DEV-14')
                ? 'OPPORTUNITY'
                : event.eventId.startsWith('EVT-MGR-14')
                  ? 'ROLE_TENSION'
                  : event.eventId.startsWith('EVT-REL-14')
                    ? 'SCOUT_INTEREST'
                    : null;
              const thread = report.stories.find(
                (item) => item.family === family && item.sourceRevision <= event.revision,
              );
              const sourceTokens = {
                ...historicTokens,
                ...(thread ? { manager: thread.actor.name } : {}),
              };
              return (
                <li key={`${event.revision}-${event.eventId}`}>
                  {event.step}단계 · {renderNarrative(choice?.label ?? '기록된 선택', sourceTokens)}{' '}
                  → {renderNarrative(outcome?.title ?? '결과 기록', sourceTokens)}
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </section>
  );
}

export function AnnualCareerScreen({
  careerId,
  readOnlyContent,
}: {
  careerId: string;
  readOnlyContent?: ReactNode;
}) {
  const career = useCareer(careerId);
  const profile = useQuery<{ id: string }>({ queryKey: ['profile'], enabled: false });
  const [readyOwner, setReadyOwner] = useState<string | null>(null);
  const [run, setRun] = useState<AnnualRunResponse | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [policy, setPolicy] = useState<AnnualPolicy>(DEFAULT_ANNUAL_POLICY);
  const [history, setHistory] = useState<Array<{ runId: string; report: AnnualReportView }>>([]);
  const controller = useRef<AnnualController | null>(null);
  const executing = useRef(false);
  useEffect(() => {
    let alive = true;
    setReady(false);
    setRun(null);
    setHistory([]);
    setError(null);
    setBusy(false);
    executing.current = false;
    void (async () => {
      try {
        const engine = await getAppEngine();
        if (!(await ensureProfile(engine.store, queryClient)))
          throw new Error('인터넷 연결을 확인해 주세요. 서버의 진행 기록이 필요합니다.');
        const owner = await engine.store.transaction('readonly', (tx) =>
          tx.kv.get<string>('profile:id'),
        );
        if (!owner || !alive) return;
        const instance = new AnnualController(owner, careerId, (value) => {
          if (alive) setRun(value);
        });
        controller.current = instance;
        await cacheAnnualCareer(owner, careerId, instance.abort.signal);
        const current = await instance.refresh();
        const reports = await instance.history();
        if (!alive) return;
        if (current) setPolicy(current.run.policy);
        setHistory(reports);
        setReadyOwner(owner);
        setReady(true);
      } catch (cause) {
        if (alive)
          setError(cause instanceof Error ? cause.message : '진행 기록을 불러오지 못했습니다.');
      }
    })();
    return () => {
      alive = false;
      controller.current?.dispose();
      controller.current = null;
    };
  }, [careerId, profile.data?.id]);
  async function act(kind: 'start' | 'resume' | 'choice', choiceId?: string) {
    const instance = controller.current;
    if (!instance || executing.current || !career.data) return;
    executing.current = true;
    setBusy(true);
    setError(null);
    try {
      if (kind === 'start') await instance.start(career.data.record.revision, policy);
      else if (kind === 'choice' && choiceId) await instance.choose(choiceId);
      else {
        await instance.refresh();
        await instance.advance();
      }
      const reports = await instance.history();
      if (!instance.abort.signal.aborted) setHistory(reports);
    } catch (cause) {
      if (!instance.abort.signal.aborted)
        setError(cause instanceof Error ? cause.message : '진행 상태를 다시 확인해 주세요.');
    } finally {
      if (controller.current === instance && !instance.abort.signal.aborted) {
        executing.current = false;
        setBusy(false);
      }
    }
  }
  if (!ready || !career.data || readyOwner !== profile.data?.id)
    return (
      <section className="os-panel">
        <h1>서버의 커리어 기록 확인</h1>
        {error ? (
          <>
            <p role="alert">{error}</p>
            <Button onClick={() => window.location.reload()}>다시 확인</Button>
          </>
        ) : (
          <p role="status">저장된 진행을 불러오고 있어요.</p>
        )}
      </section>
    );
  const state = career.data.state;
  if (readOnlyContent) return <>{readOnlyContent}</>;
  const current = run?.run;
  const waiting = current?.status === 'WAITING_DECISION';
  const completed = current?.status === 'COMPLETED';
  const synchronized = !current || career.data.record.revision === current.careerRevision;
  const pack = contentForCareer(state);
  const eventId = state.pending?.kind === 'EVENT' ? state.pending.eventId : null;
  const event = pack.events.find((item) => item.id === eventId);
  const offers =
    state.pending?.kind === 'OFFERS' || state.pending?.kind === 'CONTRACT'
      ? state.pending.offers
      : [];
  const role = state.pending?.kind === 'ROLE_PROPOSAL' ? state.pending.proposal : null;
  const tokens = buildNarrativeTokens(state, pack, rulesetForCareer(state));
  const year = current?.targetSeasonIndex ?? state.seasonHistory.length + 1;
  return (
    <main className="flex flex-col gap-os-3">
      <header className="os-panel">
        <p>서버 연간 커리어</p>
        <h1>{state.player.profile?.name}의 커리어</h1>
        <p>
          {state.age}세 · OVR {state.player.profile?.baseOvr} ·{' '}
          {state.contract?.teamName ?? '새 출발을 준비하는 중'}
        </p>
      </header>
      {error && (
        <section className="os-panel" role="alert">
          <p>{error}</p>
          <p>완료 여부는 서버 기록으로 확인합니다. 저장된 해를 새로 시작하지 않아요.</p>
          <Button disabled={busy} onClick={() => void act('resume')}>
            저장된 진행 다시 확인
          </Button>
        </section>
      )}
      {busy && (
        <section className="os-panel" role="status" aria-live="polite">
          <h2>{year}년차를 진행하고 있어요</h2>
          <p>
            서버에서 {current?.currentStep ?? 0}단계 · {current?.completedCommands ?? 0}개 처리를
            저장했습니다.
          </p>
          <p>
            중요한 결정이 생기면 멈춥니다. 화면을 닫으면 다음 접속 때 저장된 지점부터 이어갈 수
            있어요.
          </p>
        </section>
      )}
      {!busy && !synchronized && (
        <section className="os-panel" role="status">
          <p>결정과 선수 기록을 함께 확인해야 합니다. 이전 상황에서는 선택할 수 없어요.</p>
          <Button onClick={() => void act('resume')}>현재 상황 다시 확인</Button>
        </section>
      )}
      {!busy && synchronized && waiting && current.decision && (
        <section className="os-panel flex flex-col gap-os-3" aria-label="중요한 결정">
          <p>{year}년차 · 중요한 결정에서 잠시 멈췄어요</p>
          <h2>{current.decision.title}</h2>
          <p>
            {state.season?.playerStats.minutes ?? 0}분 출전 ·{' '}
            {state.contract ? `${state.contract.teamName} 소속` : '소속 구단을 결정하는 시기'}
          </p>
          {event && <p>{renderNarrative(event.narrative.situation, tokens)}</p>}
          {role?.type === 'POSITION_CHANGE' && <p>포지션 제안: {POSITION_LABELS[role.from]} → {POSITION_LABELS[role.to]} · 변경 후 {SQUAD_ROLE_LABELS[role.squadRoleAfter]}</p>}
          {role?.type === 'ROLE_CHANGE' && <p>{POSITION_LABELS[role.position]}에서 역할 변경: {SQUAD_ROLE_LABELS[role.from]} → {SQUAD_ROLE_LABELS[role.to]}</p>}
          <p>
            선택하면 <strong>같은 {year}년차</strong>의 남은 일정을 이어갑니다.
          </p>
          {current.decision.choices.map((choice) => {
            const offer = offers.find((item) => item.id === choice.id);
            return (
              <Button key={choice.id} disabled={busy} onClick={() => void act('choice', choice.id)}>
                <span>
                  {renderNarrative(choice.label, tokens)}
                  {offer ? (
                    <small className="block">
                      {offer.teamName} · {offer.lengthSeasons}시즌 · 주급{' '}
                      {formatKrw(offer.wageMinorPerWeek)} · 계약금{' '}
                      {formatKrw(offer.signingBonusMinor)} · {SQUAD_ROLE_LABELS[offer.rolePromise]}{' '}
                      · {POSITION_LABELS[offer.positionPlan]}
                    </small>
                  ) : (
                    choice.detail && <small className="block">{choice.detail}</small>
                  )}
                  {choice.risk && (
                    <small className="block">
                      {choice.risk === 'HIGH'
                        ? '위험 높음'
                        : choice.risk === 'MEDIUM'
                          ? '위험 보통'
                          : '위험 낮음'}
                    </small>
                  )}
                </span>
              </Button>
            );
          })}
        </section>
      )}
      {!busy && current?.status === 'RUNNING' && (
        <section className="os-panel">
          <h2>{year}년차 진행 중</h2>
          <p>저장된 {current.currentStep}단계부터 같은 해를 이어갑니다.</p>
          <Button onClick={() => void act('resume')}>이 해 계속 진행</Button>
        </section>
      )}
      {synchronized && completed && current.report && (
        <AnnualReport report={current.report} state={state} />
      )}
      {!busy && synchronized && (!current || completed) && state.status === 'ACTIVE' && (
        <section className="os-panel flex flex-col gap-os-3">
          <h2>{state.seasonHistory.length + 1}년차를 준비하며</h2>
          <details>
            <summary>선수 방침 설정 (선택)</summary>
            <p>일상적인 훈련과 작은 결정에만 적용합니다. 계약과 중요한 사건은 직접 결정해요.</p>
            <label>
              훈련 방향
              <select
                value={policy.training.drill}
                onChange={(e) =>
                  setPolicy({
                    ...policy,
                    training: {
                      ...policy.training,
                      drill: e.target.value as AnnualPolicy['training']['drill'],
                    },
                  })
                }
              >
                <option value="CONTROL">기술</option>
                <option value="ENGINE">체력</option>
                <option value="VISION">판단</option>
              </select>
            </label>
            <label>
              작은 결정
              <select
                value={policy.routineChoice}
                onChange={(e) =>
                  setPolicy({
                    ...policy,
                    routineChoice: e.target.value as AnnualPolicy['routineChoice'],
                  })
                }
              >
                <option value="CAUTIOUS">신중하게</option>
                <option value="BALANCED">균형 있게</option>
              </select>
            </label>
          </details>
          <Button onClick={() => void act('start')}>1년 진행</Button>
        </section>
      )}
      {state.status === 'RETIRED' && (
        <Link to="/career/$careerId/retirement" params={{ careerId }}>
          은퇴 기록 보기
        </Link>
      )}
      {history.length > 1 && (
        <details className="os-panel">
          <summary>지난 해 기록</summary>
          {history
            .filter((item) => item.runId !== current?.id)
            .map((item) => (
              <AnnualReport key={item.runId} report={item.report} state={state} />
            ))}
        </details>
      )}
      <Link to="/">내 선수 목록으로</Link>
    </main>
  );
}
