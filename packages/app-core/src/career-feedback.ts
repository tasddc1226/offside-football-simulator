// T-11-052: 웹·앱 공용 표시 모델. 공개된 기록만 읽고 상태·RNG·밸런스를 바꾸지 않는다.
import { ATTR_KEYS, COND_LOW_INJURY } from '@offside/game/data';
import { mainRole, ovr, ovrRole } from '@offside/game/attributes';
import { labelOf, leagueOf } from '@offside/game/player';
import { balanceFactor } from '@offside/game/training';
import { nextMilestones, type NextMilestone } from '@offside/game/records';
import type { GameState, MarketOption, MarketResult } from '@offside/game/types';

const signed = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1)}`;
export const GOALS_NOTE =
  '출전·골·도움은 마친 시즌 기준이에요. 대표팀 출전과 우승도 커리어에 남아요.';

/** 한 시즌의 실제 변화와 관리할 항목. 성장 계수·잠재력·예상 최대 OVR은 읽지 않는다. */
export function coachFeedback(s: GameState): { summary: string; notes: string[] } {
  const changed = ATTR_KEYS.flatMap((k) => {
    const before = s.seasonStart?.[k];
    if (!Number.isFinite(before)) return [];
    const d = Math.round((s.attrs[k] - before) * 10) / 10;
    return d ? [{ k, d }] : [];
  }).sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
  const startSub = s.seasonStartSub;
  const startOvr =
    startSub && Object.keys(startSub).length
      ? Math.round(ovrRole({ sub: startSub }, mainRole(s)))
      : null;
  const summary = [
    startOvr === null
      ? '이번 시즌 시작 능력치 기록이 없어요.'
      : `이번 시즌 OVR ${startOvr} → ${ovr(s)}.`,
    changed.length
      ? changed
          .slice(0, 2)
          .map(({ k, d }) => `${labelOf(s, k)} ${signed(d)}`)
          .join(' · ')
      : startOvr === null
        ? ''
        : '아직 표시할 능력치 변화가 없어요.',
  ]
    .filter(Boolean)
    .join(' ');
  if (s.mil.serving)
    return {
      summary,
      notes: ['군 복무 중이에요. 복무를 마치면 구단에서의 훈련과 출전을 다시 준비해요.'],
    };
  const notes: string[] = [];
  if (s.injury > 0)
    notes.push(`부상으로 ${s.injury}경기 결장이 남았어요. 회복 상태를 먼저 확인해요.`);
  else if (s.cond < COND_LOW_INJURY)
    notes.push('컨디션이 낮아 부상 위험이 커졌어요. 휴식·회복은 출전 준비에 도움이 돼요.');
  if (s.morale < 60)
    notes.push(
      '사기가 낮으면 같은 능력치 훈련에서도 성장이 줄어요. 휴식·회복으로 사기를 회복할 수 있어요.',
    );
  const lopsided = ATTR_KEYS.map((k) => ({ k, f: balanceFactor(s, k) }))
    .filter(({ f }) => f < 0.95)
    .sort((a, b) => a.f - b.f)[0];
  if (lopsided)
    notes.push(
      `${labelOf(s, lopsided.k)}이 다른 핵심 능력치보다 앞서 있어 이 능력치의 훈련 성장이 줄어요. 다른 핵심 능력치를 보완해 주세요.`,
    );
  if (!notes.length)
    notes.push('OVR은 반올림한 종합 수치예요. OVR이 같아도 세부 능력치는 달라질 수 있어요.');
  notes.push('이 메모만으로 성장 정체의 원인이나 한계를 단정할 수는 없어요.');
  return { summary, notes };
}

/** 생성된 제의의 원인을 역추정하지 않는다. makeOffers의 일반 평가 요소와 공개 기록만 설명한다. */
export function marketFeedback(s: GameState, m: MarketResult): string | undefined {
  if (
    s.mil.serving ||
    s.mil.armyNext ||
    !m.options.some((o) => o.kind === 'offer' || o.kind === 'renew')
  )
    return undefined;
  const last = s.career.filter((r) => !r.mil).at(-1);
  const record = last ? `지난 시즌 평점 ${last.rating.toFixed(2)} · ` : '';
  return `현재 OVR ${ovr(s)} · ${record}인기 ${Math.round(s.fame)} · ${s.age}세. 구단은 기량·지난 시즌 평점·인기·나이를 함께 봐요. 리그 조건과 스카우트·에이전트 이벤트도 제의에 영향을 줘요. 좋은 활약이 특정 구단의 제의를 보장하지는 않아요.`;
}
export function offerFeedback(s: GameState, o: MarketOption): string | undefined {
  if (o.kind !== 'offer') return undefined;
  return `현재 OVR ${ovr(s)} · 팀 전력 ${o.str}. 제시된 출전 조건은 ${o.role || '별도 안내 없음'}이에요. 실제 출전은 컨디션·부상·감독 신뢰 등에 따라 달라져요.`;
}

/**
 * T-11-078 진행 중인 커리어에서도 영구결번이 있다는 걸 알린다. 심사 기준(시즌 수·점수)은 서버만 알고
 * 수치 힌트도 주지 않는다 — 조건을 말로만 짧게.
 */
export const retiredNumberHint = (s: GameState): string =>
  `한 구단에서 오래 활약하고 은퇴하면 그 구단의 ${s.number}번이 영구결번될 수 있어요.`;

/** 기존 목표 전부 + 현재 구단의 출전 기록. 보상·칭호·저장 필드는 추가하지 않는다. */
export function careerGoals(s: GameState): NextMilestone[] {
  if (s.retired) return [];
  const goals = nextMilestones(s, 6);
  const have = s.career
    .filter((r) => !r.mil && (r.clubId ? r.clubId === s.club.id : r.club === s.club.name))
    .reduce((n, r) => n + r.apps, 0);
  const target = [50, 100, 200, 300, 500].find((n) => n > have);
  if (target && !leagueOf(s.leagueId).amateur)
    goals.push({
      key: 'club-apps',
      label: `${s.club.name}에서 ${target}경기 출전`,
      have,
      target,
      remaining: target - have,
    });
  return goals;
}
