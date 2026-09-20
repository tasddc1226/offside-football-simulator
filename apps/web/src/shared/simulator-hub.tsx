import type { ReactNode } from 'react';
import { ATTRIBUTE_KEYS, type CareerState } from '@offside/domain';
import { ATTRIBUTE_LABELS, SQUAD_ROLE_LABELS } from './labels.js';
import { TRAINING_FOCUS_LABEL_KO } from './start-season.js';
import './simulator.css';
import { rulesetForCareer } from '../engine/content.js';

export function careerMilestones(state: CareerState) {
  const records = state.seasonHistory.map((season) => season.result.playerStats);
  if (state.season !== null) records.push(state.season.playerStats);
  const appearances = records.reduce((sum, stats) => sum + stats.appearances.total, 0);
  const minutes = records.reduce((sum, stats) => sum + stats.minutes, 0);
  return [
    {
      label: '통산 출전',
      value: appearances,
      unit: '경기',
      steps: [1, 10, 50, 100, 200, 500, 1000],
    },
    {
      label: '그라운드에서',
      value: minutes,
      unit: '분',
      steps: [90, 900, 4500, 9000, 18000, 45000, 90000],
    },
    {
      label: '쌓아 온 시즌',
      value: state.seasonHistory.length,
      unit: '시즌',
      steps: [1, 3, 5, 10, 15, 20, 30],
    },
  ].map(({ steps, ...item }) => {
    const target = steps.find((step) => step > item.value) ?? steps[steps.length - 1]!;
    const reached = steps.filter((step) => step <= item.value).at(-1);
    return { ...item, target, reached, percent: Math.min(100, (item.value / target) * 100) };
  });
}

export function GrowthSnapshot({ state, full = false }: { state: CareerState; full?: boolean }) {
  const last = state.seasonHistory.at(-1)?.result;
  const ovr = state.player.profile?.baseOvr ?? 0;
  const delta = last === undefined ? null : last.baseOvr.after - last.baseOvr.before;
  const ranked = ATTRIBUTE_KEYS.map((key) => ({
    key,
    value: state.attributes[key],
    delta: last?.attributeDeltas.find((item) => item.key === key)?.delta ?? 0,
  })).sort((a, b) => b.value - a.value || a.key.localeCompare(b.key));
  return (
    <section className="sim-growth" aria-label="선수 성장">
      <div className="sim-section-heading">
        <div>
          <p className="sim-kicker">PLAYER DEVELOPMENT</p>
          <h2>{full ? '나만의 선수를 만든다' : '내 선수의 성장 기록'}</h2>
        </div>
        <div className="sim-ovr">
          <small>OVR</small>
          <strong>{ovr}</strong>
          {delta !== null && (
            <span data-positive={delta > 0}>
              {delta > 0 ? '+' : ''}
              {delta} <small>지난 성장</small>
            </span>
          )}
        </div>
      </div>
      {full ? (
        <div className="sim-attributes">
          {ranked.map((item) => (
            <div key={item.key}>
              <div>
                <span>{ATTRIBUTE_LABELS[item.key]}</span>
                <strong>{item.value}</strong>
                {item.delta !== 0 && (
                  <em data-positive={item.delta > 0}>
                    {item.delta > 0 ? '+' : ''}
                    {item.delta}
                  </em>
                )}
              </div>
              <meter min={0} max={100} value={item.value} aria-label={ATTRIBUTE_LABELS[item.key]} />
            </div>
          ))}
        </div>
      ) : (
        <div className="sim-strengths">
          {ranked.slice(0, 3).map((item) => (
            <span key={item.key}>
              {ATTRIBUTE_LABELS[item.key]} <strong>{item.value}</strong>
              {item.delta !== 0 && (
                <em data-positive={item.delta > 0}>
                  {item.delta > 0 ? '+' : ''}
                  {item.delta}
                </em>
              )}
            </span>
          ))}
        </div>
      )}
      <p className="sim-caption">
        {state.season
          ? `이번 시즌 ${TRAINING_FOCUS_LABEL_KO[state.season.trainingFocus]} 훈련 · 성장은 시즌 결산에 반영됩니다.`
          : last
            ? '직전 시즌의 실제 능력 변화입니다. 다음 훈련으로 강점을 이어 가세요.'
            : '출전 경험을 쌓고, 선택한 훈련으로 강점을 키워 보세요.'}
      </p>
    </section>
  );
}

export function SeasonDashboard({
  state,
  year,
  action,
}: {
  state: CareerState;
  year: number;
  action: ReactNode;
}) {
  const season = state.season;
  const careerLength = rulesetForCareer(state).retirementRules?.maxCareerSeasons;
  const years = state.seasonHistory.length;
  const chapter =
    years < 3
      ? '가능성을 발견하다'
      : years < 6
        ? '나만의 무대를 찾다'
        : years < 9
          ? '전성기를 만들다'
          : '무엇을 남길 것인가';
  const developmentIdentity = [
    ['육성_기술', '기술을 갈고닦는 선수'],
    ['육성_몸', '체력으로 승부하는 선수'],
    ['육성_판단', '경기를 읽는 선수'],
    ['해외_경험', '낯선 무대를 경험한 선수'],
    ['국내_정착', '내 팀에서 뿌리내리는 선수'],
    ['재도전_준비', '다시 기회를 찾는 선수'],
  ]
    .filter(([tag]) => state.tags.includes(tag!))
    .map(([, label]) => label)
    .slice(0, 2)
    .join(' · ');
  const stats = season?.playerStats;
  const recent = season?.matches.slice(-3).reverse() ?? [];
  const totals = stats?.totals;
  const impact =
    totals && 'saves' in totals
      ? { label: '선방', value: totals.saves }
      : totals && 'tackles' in totals
        ? { label: '태클', value: totals.tackles }
        : totals && 'assists' in totals && !('goals' in totals)
          ? { label: '도움', value: totals.assists }
          : { label: '득점', value: totals && 'goals' in totals ? totals.goals : 0 };
  const achievements = careerMilestones(state);
  const condition = [
    { name: '컨디션', value: state.state.form },
    { name: '체력', value: state.state.fitness },
    { name: '사기', value: state.state.morale },
  ];
  return (
    <div
      className="sim-hub"
      data-ruleset-version={state.rulesetVersion}
      data-content-pack-version={state.contentPackVersion}
    >
      {careerLength !== undefined && (
        <section className="sim-career-journey" aria-label="엔딩까지의 여정">
          <div>
            <p className="sim-kicker">MY FOOTBALL LIFE</p>
            <h2>{chapter}</h2>
          </div>
          <strong>
            {Math.min(years + 1, careerLength)} / {careerLength}
            <small> 시즌</small>
          </strong>
          <progress max={careerLength} value={years} aria-label="완주한 커리어 시즌" />
          {developmentIdentity && <p>{developmentIdentity}</p>}
          <p>
            {years >= careerLength
              ? '마지막 선택을 하고 나의 축구 인생을 돌아보세요.'
              : `엔딩까지 ${careerLength - years}시즌 · 중요한 순간은 직접 선택하세요.`}
          </p>
        </section>
      )}
      <section className="sim-season-card" aria-label="이번 시즌 기록">
        <div className="sim-section-heading">
          <div>
            <p className="sim-kicker">MY SEASON · {year}</p>
            <h2>{season ? '오늘도, 그라운드로.' : '새 시즌, 새로운 가능성.'}</h2>
          </div>
          <span className="sim-role">
            {season ? SQUAD_ROLE_LABELS[season.squadRole] : '시즌 준비'}
          </span>
        </div>
        <div
          className="sim-season-progress"
          role="progressbar"
          aria-label="시즌 진행"
          aria-valuenow={season?.currentStep ?? 0}
          aria-valuemin={0}
          aria-valuemax={season?.steps.length ?? 12}
        >
          <span
            style={{
              width: `${((season?.currentStep ?? 0) / (season?.steps.length ?? 12)) * 100}%`,
            }}
          />
        </div>
        <div className="sim-records">
          <div>
            <strong>{stats?.appearances.total ?? 0}</strong>
            <span>출전</span>
          </div>
          <div>
            <strong>{impact.value}</strong>
            <span>{impact.label}</span>
          </div>
          <div>
            <strong>
              {stats && stats.ratedMatches > 0
                ? (stats.ratingSumTenths / stats.ratedMatches / 10).toFixed(1)
                : '—'}
            </strong>
            <span>평점</span>
          </div>
          <div>
            <strong>
              {stats?.minutes ?? 0}
              <small>′</small>
            </strong>
            <span>뛴 시간</span>
          </div>
        </div>
        <div className="sim-condition">
          {condition.map((item) => (
            <div key={item.name}>
              <span>
                {item.name} <b>{item.value}</b>
              </span>
              <meter min={0} max={100} value={item.value} aria-label={item.name} />
            </div>
          ))}
        </div>
      </section>
      {action}
      <p className="sim-next-goal">
        <span>다음 목표</span>
        <strong>통산 {achievements[0]!.target}경기 출전</strong>
        <span>
          {achievements[0]!.value} / {achievements[0]!.target}
        </span>
      </p>
      {recent.length > 0 && (
        <section className="sim-recent" aria-label="최근 경기">
          <div className="sim-section-heading">
            <h2>경기 리포트</h2>
            <span className="sim-caption">최근 {recent.length}경기</span>
          </div>
          {recent.map((match) => (
            <div className="sim-match-row" key={match.id}>
              <b className="sim-result" data-result={match.result.outcome}>
                {({ WIN: '승', DRAW: '무', LOSS: '패' } as const)[match.result.outcome]}
              </b>
              <span>{match.opponent.name}</span>
              <strong>
                {match.result.goalsFor} : {match.result.goalsAgainst}
              </strong>
              <small>
                {match.minutes > 0
                  ? `${match.minutes}분 · ${match.ratingTenths === null ? '—' : match.ratingTenths / 10}`
                  : '결장'}
              </small>
            </div>
          ))}
        </section>
      )}
      <GrowthSnapshot state={state} />
      <details className="sim-disclosure sim-milestones">
        <summary>
          커리어 목표{' '}
          <span>
            {achievements.filter((item) => item.reached !== undefined).length}개 항목 달성
          </span>
        </summary>
        <div className="sim-goals">
          {achievements.map((item) => (
            <div key={item.label}>
              <div>
                <strong>{item.label}</strong>
                <span>
                  {item.value.toLocaleString()} / {item.target.toLocaleString()}
                  {item.unit}
                </span>
              </div>
              <progress value={item.value} max={item.target} aria-label={item.label} />
              {item.reached !== undefined && (
                <small>
                  ✓ {item.reached.toLocaleString()}
                  {item.unit} 달성
                </small>
              )}
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
