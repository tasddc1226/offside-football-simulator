import { useState } from 'react';
import {
  developmentBlock,
  developmentTargets,
  type CareerState,
  type DevelopmentPlan,
} from '@offside/domain';
import { Button } from '@offside/ui';
import { useCareerMutation } from '../engine/use-career.js';
import { ATTRIBUTE_LABELS } from './labels.js';

export const DRILL_LABEL = {
  CONTROL: '포지션 기술',
  ENGINE: '피지컬',
  VISION: '경기 읽기',
} as const;
export const LOAD_LABEL = { RECOVERY: '회복', BALANCED: '균형', PUSH: '한계 도전' } as const;
export const PARTNER_LABEL = { COACH: '감독', CAPTAIN: '주장', RIVAL: '경쟁자' } as const;
export const BLOCK_LABEL = ['시즌의 기초', '주전 경쟁', '마지막 승부'] as const;

export function DevelopmentWorkshop({ state }: { state: CareerState }) {
  const previous = state.development?.sessions.at(-1);
  const [drill, setDrill] = useState<DevelopmentPlan['drill']>(previous?.drill ?? 'CONTROL');
  const [load, setLoad] = useState<DevelopmentPlan['load']>(
    state.state.fitness < 55 ||
      state.health.episodes.some((e) => e.status === 'REHAB' || e.status === 'ACTIVE')
      ? 'RECOVERY'
      : 'BALANCED',
  );
  const [partner, setPartner] = useState<DevelopmentPlan['partner']>(previous?.partner ?? 'COACH');
  const [error, setError] = useState<string | null>(null);
  const mutation = useCareerMutation('develop');
  const injured = state.health.episodes.some((e) => e.status === 'REHAB' || e.status === 'ACTIVE');
  const block = developmentBlock(state.season?.currentStep ?? 1);
  const submit = async () => {
    if (mutation.isPending) return;
    setError(null);
    try {
      const result = await mutation.mutateAsync({
        careerId: state.careerId,
        plan: { drill, load, partner },
      });
      if (!result.ok) setError(result.error.message);
    } catch {
      setError('훈련을 저장하지 못했습니다. 선택을 유지했으니 다시 시도해 주세요.');
    }
  };
  return (
    <section className="life-workshop" aria-label="이번 구간 육성 계획">
      <div className="life-section-heading">
        <div>
          <p className="sim-kicker">TRAINING CAMP · {block}/3</p>
          <h2>{BLOCK_LABEL[block - 1]}</h2>
        </div>
        <span>체력 {state.state.fitness}</span>
      </div>
      <fieldset disabled={mutation.isPending}>
        <legend>무엇을 내 무기로 만들까?</legend>
        <div className="life-options">
          {(Object.keys(DRILL_LABEL) as DevelopmentPlan['drill'][]).map((key) => (
            <button
              type="button"
              key={key}
              aria-pressed={drill === key}
              onClick={() => setDrill(key)}
            >
              <strong>{DRILL_LABEL[key]}</strong>
              <small>
                {developmentTargets(state, key)
                  .map((attribute) => ATTRIBUTE_LABELS[attribute])
                  .join(' · ')}
              </small>
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset disabled={mutation.isPending}>
        <legend>어디까지 밀어붙일까?</legend>
        <div className="life-options">
          {(Object.keys(LOAD_LABEL) as DevelopmentPlan['load'][]).map((key) => (
            <button
              type="button"
              key={key}
              aria-pressed={load === key}
              disabled={key === 'PUSH' && injured}
              onClick={() => setLoad(key)}
            >
              <strong>{LOAD_LABEL[key]}</strong>
              <small>
                {key === 'RECOVERY'
                  ? '능력 휴식 · 체력 +20'
                  : key === 'BALANCED'
                    ? '능력 +1~2 · 체력 −5'
                    : '능력 +2~3 · 체력 −18'}
              </small>
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset disabled={mutation.isPending}>
        <legend>누구와 시간을 보낼까?</legend>
        <div className="life-options">
          {(Object.keys(PARTNER_LABEL) as DevelopmentPlan['partner'][]).map((key) => (
            <button
              type="button"
              key={key}
              aria-pressed={partner === key}
              onClick={() => setPartner(key)}
            >
              <strong>{PARTNER_LABEL[key]}</strong>
              <small>
                {key === 'COACH'
                  ? '전술 대화 · 안정적인 플레이'
                  : key === 'CAPTAIN'
                    ? '호흡 맞추기 · 연계 플레이'
                    : '맞대결 · 과감한 플레이'}
              </small>
            </button>
          ))}
        </div>
      </fieldset>
      <p className="life-hint">
        {injured
          ? '재활 중에는 능력이 오르지 않습니다. 회복 훈련을 권합니다.'
          : state.state.fitness < 35
            ? '몸이 지쳐 능력 훈련을 소화하기 어렵습니다. 회복이 필요합니다.'
            : '선택한 능력 중 두 가지를 훈련합니다. 현재 성장 한도에 도달한 능력은 오르지 않습니다.'}{' '}
        상대의 반응은 쌓아 온 신뢰에 따라 달라집니다.
      </p>
      {error && <p role="alert">{error}</p>}
      <Button disabled={mutation.isPending} onClick={() => void submit()}>
        {mutation.isPending ? '훈련과 대화를 기록하는 중…' : '이 계획으로 훈련하기'}
      </Button>
    </section>
  );
}

export function DevelopmentReceipt({ state }: { state: CareerState }) {
  const session = state.development?.sessions.at(-1);
  if (!session || session.season !== state.season?.index) return null;
  return (
    <section className="life-receipt" aria-label="훈련과 대화의 결과">
      <p className="sim-kicker">방금 쌓은 변화 · {DRILL_LABEL[session.drill]}</p>
      <strong>
        {session.breakthrough
          ? '벽을 한 번 넘었다.'
          : session.load === 'RECOVERY'
            ? '다시 뛸 준비를 했다.'
            : '어제보다 조금 더 나아졌다.'}
      </strong>
      <p>
        {session.gains.length
          ? session.gains.map((g) => `${ATTRIBUTE_LABELS[g.attribute]} +${g.delta}`).join(' · ')
          : '능력 변화 없음'}{' '}
        · 체력 {session.fitnessDelta > 0 ? '+' : ''}
        {session.fitnessDelta}
      </p>
      <p>
        {PARTNER_LABEL[session.partner]}{' '}
        {session.response === 'SUPPORT'
          ? '“함께 준비한 만큼, 경기에서도 믿어 보자.”'
          : session.response === 'CHALLENGE'
            ? '“훈련에서는 좋았어. 실전에서도 보여 줘.”'
            : '“아직은 더 지켜보고 싶어.”'}{' '}
        <b>신뢰 +{session.relationDelta}</b>
      </p>
    </section>
  );
}

export function LifeSeasonEntry({
  state,
  onStarted,
}: {
  state: CareerState;
  onStarted: () => void;
}) {
  const mutation = useCareerMutation('startSeason');
  const [error, setError] = useState<string | null>(null);
  const start = async () => {
    if (mutation.isPending) return;
    setError(null);
    try {
      const result = await mutation.mutateAsync({
        careerId: state.careerId,
        choice: { simulationMode: 'FAST' },
      });
      if (result.ok) onStarted();
      else setError(result.error.message);
    } catch {
      setError('시즌을 시작하지 못했습니다. 다시 시도해 주세요.');
    }
  };
  return (
    <section className="life-workshop">
      <p className="sim-kicker">NEW SEASON · {state.seasonHistory.length + 1}/12</p>
      <h1>이번 시즌, 어떤 선수가 될까?</h1>
      <p>{state.contract?.teamName}에서 보내는 새로운 시즌입니다.</p>
      <div className="life-blocks">
        {BLOCK_LABEL.map((label, i) => (
          <span key={label}>
            {i + 1}. {label}
          </span>
        ))}
      </div>
      <p className="life-hint">
        시즌을 세 구간으로 나눠 훈련과 함께할 사람을 고릅니다. 경기는 중요한 장면에서 직접 선택하고,
        그 결과로 다음 계획을 바꿔 보세요.
      </p>
      {error && <p role="alert">{error}</p>}
      <Button disabled={mutation.isPending} onClick={() => void start()}>
        {mutation.isPending ? '훈련장을 여는 중…' : '새 시즌 훈련장으로'}
      </Button>
    </section>
  );
}
