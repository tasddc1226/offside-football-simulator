import { useState, type ReactNode } from 'react';
import { developmentBlock, overseasJourney, type CareerState } from '@offside/domain';
import { ATTRIBUTE_LABELS, SQUAD_ROLE_LABELS } from './labels.js';
import { DevelopmentReceipt, DRILL_LABEL, BLOCK_LABEL } from './development-workshop.js';
import './player-life.css';

export function PlayerLife({ state, action }: { state: CareerState; action: ReactNode }) {
  const [room, setRoom] = useState<'MATCH' | 'PLAYER' | 'PEOPLE'>('MATCH');
  const journey = state.rulesetVersion === '3.1.0' ? overseasJourney(state) : null;
  const season = state.season;
  const block = developmentBlock(season?.currentStep ?? 1);
  const completed = state.seasonHistory.length;
  const current = season?.playerStats;
  const sessions = state.development?.sessions ?? [];
  const latest = sessions.at(-1);
  const rival = season?.squad.competitors.find(
    (c) => c.position === state.player.profile?.primaryPosition,
  );
  const people = [
    {
      name: season?.manager?.name ?? '다음 감독',
      role: '감독',
      score: state.relationships.managerTrust,
      detail: '전술 이해와 안정적인 플레이를 지켜봅니다.',
    },
    {
      name: '우리 팀 주장',
      role: '주장',
      score: state.relationships.captain,
      detail: '훈련에서 맞춘 호흡이 경기 중 연계의 힘이 됩니다.',
    },
    {
      name: rival?.name ?? '포지션 경쟁자',
      role: '경쟁자',
      score: state.relationships.rival,
      detail: '맞대결에서 쌓은 인정이 과감한 시도의 자신감이 됩니다.',
    },
  ];
  return (
    <div className="player-life">
      <section className="life-stage" aria-label="선수 인생 진행">
        <div>
          <p className="sim-kicker">MY FOOTBALL LIFE</p>
          <h2>
            {completed < 3
              ? '내 자리를 만드는 중'
              : completed < 8
                ? '나만의 축구를 펼치다'
                : '어떤 선수로 남을까'}
          </h2>
        </div>
        <strong>
          {Math.min(completed + 1, 12)}
          <small>/12 시즌</small>
        </strong>
        <div className="life-blocks">
          {BLOCK_LABEL.map((label, i) => (
            <span
              key={label}
              data-active={season !== null && i + 1 === block}
              data-complete={season !== null && i + 1 < block}
            >
              {i + 1}. {label}
            </span>
          ))}
        </div>
      </section>
      <div className="life-vitals">
        <span>
          <small>컨디션</small>
          <b>{state.state.form}</b>
        </span>
        <span>
          <small>체력</small>
          <b data-low={state.state.fitness < 45}>{state.state.fitness}</b>
        </span>
        <span>
          <small>사기</small>
          <b>{state.state.morale}</b>
        </span>
        <span>
          <small>역할</small>
          <b>{SQUAD_ROLE_LABELS[season?.squadRole ?? state.contract?.rolePromise ?? 'RESERVE']}</b>
        </span>
      </div>
      {state.timeline.at(-1)?.kind === 'DEVELOPMENT_COMPLETED' && (
        <DevelopmentReceipt state={state} />
      )}
      {action}
      <div className="life-room-switch" role="group" aria-label="내 선수 살펴보기">
        {(
          [
            ['MATCH', '매치데이'],
            ['PLAYER', '성장 노트'],
            ['PEOPLE', '라커룸'],
          ] as const
        ).map(([key, label]) => (
          <button type="button" key={key} aria-pressed={room === key} onClick={() => setRoom(key)}>
            {label}
          </button>
        ))}
      </div>
      {room === 'MATCH' && (
        <section className="life-room" aria-label="매치데이">
          <div className="life-section-heading">
            <h2>경기로 증명하는 나</h2>
            <span>
              {current?.appearances.total ?? 0}경기 · {current?.minutes ?? 0}분
            </span>
          </div>
          {season?.matches.length ? (
            <div className="life-fixtures">
              {season.matches
                .slice(-3)
                .reverse()
                .map((match) => (
                  <div key={match.id}>
                    <strong>
                      {match.result.goalsFor}:{match.result.goalsAgainst}
                    </strong>
                    <span>{match.opponent.name}</span>
                    <small>
                      {match.minutes}분 ·{' '}
                      {match.ratingTenths === null
                        ? '평점 없음'
                        : (match.ratingTenths / 10).toFixed(1)}
                    </small>
                  </div>
                ))}
            </div>
          ) : (
            <p>
              첫 경기를 준비하세요. 훈련한 능력과 주변의 신뢰가 중요한 순간의 선택에 영향을 줍니다.
            </p>
          )}
          {state.development?.duels.at(-1) && (
            <p className="life-hint">
              최근 중요한 장면 · {DRILL_LABEL[state.development.duels.at(-1)!.tactic]} ·{' '}
              {state.development.duels.at(-1)!.result === 'SUCCESS'
                ? '준비한 플레이가 통했다'
                : state.development.duels.at(-1)!.result === 'FAIL'
                  ? '실패에서 다음 플레이를 배웠다'
                  : '경험을 하나 더 쌓았다'}
            </p>
          )}
        </section>
      )}
      {room === 'PLAYER' && (
        <section className="life-room" aria-label="성장 노트">
          <h2>반복한 훈련이 내 무기가 된다</h2>
          <div className="life-mastery">
            {(Object.keys(DRILL_LABEL) as Array<keyof typeof DRILL_LABEL>).map((key) => (
              <div key={key}>
                <span>{DRILL_LABEL[key]}</span>
                <b>
                  {state.development?.mastery[key] ?? 0}
                  <small>/100</small>
                </b>
                <progress
                  aria-label={`${DRILL_LABEL[key]} 숙련`}
                  max={100}
                  value={state.development?.mastery[key] ?? 0}
                />
              </div>
            ))}
          </div>
          {journey && (
            <section aria-label="세계로 가는 여정">
              <h3>
                {journey.country} · {journey.stage}
              </h3>
              <p>국내 → 일본 → 포르투갈 → 빅리그</p>
              <p>{journey.next}</p>
              <small>
                해외 {journey.foreignSeasons}시즌 · 빅리그 주전 경쟁 {journey.bigSeasons}시즌 ·{' '}
                {journey.countries.length}개국 출전
              </small>
            </section>
          )}
          <DevelopmentReceipt state={state} />
          {!latest && <p>첫 훈련에서 당신의 플레이 스타일이 시작됩니다.</p>}
          <details>
            <summary>지금까지의 훈련 {sessions.length}회</summary>
            {sessions
              .slice(-9)
              .reverse()
              .map((s) => (
                <p key={`${s.season}-${s.block}`}>
                  {s.season}시즌 {s.block}구간 · {DRILL_LABEL[s.drill]} ·{' '}
                  {s.gains.map((g) => `${ATTRIBUTE_LABELS[g.attribute]} +${g.delta}`).join(', ') ||
                    '회복·경험'}
                </p>
              ))}
          </details>
        </section>
      )}
      {room === 'PEOPLE' && (
        <section className="life-room" aria-label="라커룸">
          <h2>나를 지켜보는 사람들</h2>
          <div className="life-people">
            {people.map((person) => (
              <article key={person.role}>
                <span className="life-avatar" aria-hidden="true">
                  {person.role.slice(0, 1)}
                </span>
                <div>
                  <small>
                    {person.role} ·{' '}
                    {person.score >= 70
                      ? '든든한 신뢰'
                      : person.score >= 45
                        ? '알아가는 사이'
                        : '아직 거리감'}
                  </small>
                  <h3>{person.name}</h3>
                  <p>{person.detail}</p>
                </div>
                <strong>{person.score}</strong>
              </article>
            ))}
          </div>
          <p className="life-hint">
            훈련 대화와 경기에서의 선택이 관계에 남습니다. 이적하거나 감독이 바뀌면 새 관계를 쌓아야
            합니다.
          </p>
        </section>
      )}
    </div>
  );
}
