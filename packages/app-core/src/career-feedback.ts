// T-11-052: 웹·앱 공용 표시 모델. 공개된 기록만 읽고 상태·RNG·밸런스를 바꾸지 않는다.
import { ATTR_KEYS, COND_LOW_INJURY } from '@offside/game/data';
import { mainRole, ovr, ovrRole } from '@offside/game/attributes';
import { labelOf, leagueOf } from '@offside/game/player';
import { balanceFactor } from '@offside/game/training';
import { nextMilestones, type NextMilestone } from '@offside/game/records';
import type { GameState, MarketOption, MarketResult } from '@offside/game/types';
import { tn } from '@offside/game/i18n/names';
import { gameCareerText as L } from './i18n/ko/gameCareer';

const signed = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1)}`;
/** 안내 문구 — 언어가 정해진 뒤에 읽도록 함수로 둔다. */
export const goalsNote = (): string => L.goalsNote;

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
    startOvr === null ? L.coachNoStart : L.coachOvr({ from: startOvr, to: ovr(s) }),
    changed.length
      ? changed
          .slice(0, 2)
          .map(({ k, d }) => `${labelOf(s, k)} ${signed(d)}`)
          .join(' · ')
      : startOvr === null
        ? ''
        : L.coachNoChange,
  ]
    .filter(Boolean)
    .join(' ');
  if (s.mil.serving)
    return {
      summary,
      notes: [L.coachServing],
    };
  const notes: string[] = [];
  if (s.injury > 0) notes.push(L.coachInjured({ n: s.injury }));
  else if (s.cond < COND_LOW_INJURY) notes.push(L.coachLowCond);
  if (s.morale < 60) notes.push(L.coachLowMorale);
  const lopsided = ATTR_KEYS.map((k) => ({ k, f: balanceFactor(s, k) }))
    .filter(({ f }) => f < 0.95)
    .sort((a, b) => a.f - b.f)[0];
  if (lopsided) notes.push(L.coachLopsided({ attr: labelOf(s, lopsided.k) }));
  if (!notes.length) notes.push(L.coachRounded);
  notes.push(L.coachDisclaimer);
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
  return L.marketAssess({
    ovr: ovr(s),
    rating: last ? last.rating.toFixed(2) : null,
    fame: Math.round(s.fame),
    age: s.age,
  });
}
export function offerFeedback(s: GameState, o: MarketOption): string | undefined {
  if (o.kind !== 'offer') return undefined;
  return L.offerAssess({ ovr: ovr(s), str: o.str, role: tn(o.role ?? '') });
}

/**
 * T-11-078 진행 중인 커리어에서도 영구결번이 있다는 걸 알린다. 심사 기준(시즌 수·점수)은 서버만 알고
 * 수치 힌트도 주지 않는다 — 조건을 말로만 짧게.
 */
export const retiredNumberHint = (s: GameState): string => L.retiredNumber({ n: s.number });

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
      label: L.clubApps({ club: tn(s.club.name), target }),
      have,
      target,
      remaining: target - have,
    });
  return goals;
}
