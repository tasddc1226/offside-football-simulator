// 생성 파일(T-11-432). 손으로 고치지 않는다 — event-peek.test.ts 주석의 명령으로 다시 만든 뒤 pnpm format으로 서식을 맞춘다.
// 이벤트 선택지마다 선택하면 늘 같은 방향으로 바뀌는 득실(ok: 성공·확정 결과, fail: 실패 결과). 점수가 큰 순서다.
import type { ChoicePeek } from './event-peek.js';

export const EVENT_PEEK: Readonly<Record<string, readonly ChoicePeek[]>> = {
  'mil-notice': [
    {},
    {
      ok: ['trust+'],
    },
  ],
  'mil-notice-low': [
    {},
    {
      ok: ['trust+'],
    },
    {},
  ],
  'bench-talk': [
    {
      ok: ['trust+', 'morale+'],
      fail: ['trust-', 'morale-'],
    },
    {
      ok: ['cond-', 'trust+'],
    },
  ],
  knock: [
    {
      ok: ['trust+'],
      fail: ['out', 'morale-'],
    },
    {
      ok: ['out', 'cond+'],
    },
  ],
  ad: [
    {
      ok: ['fame+', 'money+', 'cond-', 'morale+'],
    },
    {
      ok: ['trust+', 'morale+'],
    },
  ],
  interview: [
    {
      ok: ['fame+', 'morale+'],
      fail: ['morale-', 'fame+'],
    },
    {
      ok: ['trust+'],
    },
  ],
  rival: [
    {
      ok: ['attr+', 'cond-'],
      fail: ['out', 'cond-'],
    },
    {
      ok: ['trust-', 'cond+', 'morale+'],
    },
  ],
  scout: [
    {
      ok: ['fame+'],
      fail: ['trust-', 'morale-'],
    },
    {
      ok: ['trust+'],
    },
  ],
  party: [
    {
      ok: ['fame+', 'morale+'],
      fail: ['story:scandal', 'trust-', 'fame-', 'money-'],
    },
    {
      ok: ['cond+'],
    },
  ],
  mentor: [
    {
      ok: ['attr+'],
      fail: ['morale-'],
    },
    {
      ok: ['attr+'],
    },
  ],
  newcoach: [
    {
      ok: ['trust+'],
      fail: ['trust-'],
    },
    {},
  ],
  haters: [
    {
      ok: ['fame+', 'morale+'],
      fail: ['morale-', 'fame-'],
    },
    {
      ok: ['morale+'],
    },
  ],
  trainer: [
    {
      ok: ['pot+', 'attr+', 'money-'],
      fail: ['out', 'money-'],
    },
    {
      ok: ['pot+', 'cond+', 'trust+'],
    },
  ],
  charity: [
    {
      ok: ['fame+', 'morale+', 'cond-'],
    },
    {
      ok: ['cond+', 'trust+'],
    },
  ],
  slump: [
    {
      ok: ['morale+', 'money-'],
      fail: ['money-', 'morale+'],
    },
    {
      ok: ['morale+', 'trust+'],
      fail: ['morale-', 'trust-'],
    },
  ],
  penalty: [
    {
      ok: ['fame+', 'morale+'],
      fail: ['morale-', 'trust-', 'fame-'],
    },
    {
      ok: ['trust+', 'morale+'],
    },
  ],
  'pk-save': [
    {
      ok: ['fame+', 'trust+', 'morale+'],
      fail: ['morale-'],
    },
    {
      ok: ['fame+', 'trust+', 'morale+'],
      fail: ['morale-'],
    },
  ],
  family: [
    {
      ok: ['morale+', 'trust+'],
    },
    {
      ok: ['trust+', 'morale+'],
      fail: ['morale-', 'trust-'],
    },
  ],
  rumor: [
    {
      ok: ['trust-', 'fame+', 'morale+'],
    },
    {
      ok: ['trust+', 'morale+'],
    },
  ],
  diet: [
    {
      ok: ['attr+'],
      fail: ['cond-', 'morale-'],
    },
    {
      ok: ['attr+', 'cond+', 'morale+'],
    },
  ],
  final: [
    {
      ok: ['fame+', 'morale+'],
      fail: ['fame+'],
    },
    {
      ok: ['fame+', 'trust+', 'morale+'],
    },
  ],
  'rival-1': [
    {
      ok: ['story:rival', 'fame+', 'morale+'],
    },
    {
      ok: ['story:rival', 'trust+'],
    },
  ],
  'rival-2': [
    {},
    {
      ok: ['trust+'],
    },
  ],
  'rival-3': [
    {
      ok: ['attr+', 'pot+', 'fame+'],
      fail: ['morale-', 'trust-'],
    },
    {
      ok: ['attr+', 'morale+', 'trust+'],
      fail: ['fame-', 'morale-'],
    },
  ],
  'rehab-1': [
    {
      ok: ['story:rehab', 'out', 'trust+', 'morale+'],
    },
    {
      ok: ['story:rehab'],
      fail: ['story:rehab', 'out'],
    },
  ],
  'rehab-2': [
    {
      ok: ['trust+', 'morale+'],
      fail: ['out', 'morale-'],
    },
    {
      ok: ['cond+', 'attr+', 'trust-'],
    },
  ],
  'rehab-3': [
    {
      ok: ['fame+', 'morale+'],
    },
    {
      ok: ['cond+', 'morale+'],
    },
  ],
  'scandal-2': [
    {
      ok: ['fame-', 'trust+'],
      fail: ['fame-', 'trust-', 'morale-'],
    },
    {
      ok: ['trust+', 'morale+'],
      fail: ['trust-', 'fame-'],
    },
  ],
  'scandal-3': [
    {
      ok: ['fame+', 'morale+'],
    },
    {
      ok: ['fame+', 'trust+'],
      fail: ['morale-'],
    },
  ],
  'europe-2': [
    {
      ok: ['money-', 'fame+', 'morale+'],
    },
    {
      ok: ['trust+'],
    },
  ],
  'europe-3': [
    {
      ok: ['trust+', 'morale+'],
      fail: ['cond-', 'morale-'],
    },
    {
      ok: ['fame+', 'trust+', 'morale+'],
      fail: ['morale-'],
    },
  ],
  'mentor-2': [
    {
      ok: ['attr+', 'trust+'],
      fail: ['trust-', 'morale-'],
    },
    {
      ok: ['attr+'],
    },
  ],
  'mentor-3': [
    {
      ok: ['morale+', 'trust-'],
    },
    {
      ok: ['fame+', 'morale+'],
    },
  ],
  var: [
    {
      ok: ['trust+', 'morale+', 'fame+'],
      fail: ['trust-', 'morale-'],
    },
    {
      ok: ['morale+', 'fame+'],
      fail: ['trust+'],
    },
  ],
  racism: [
    {
      ok: ['fame+', 'trust+', 'morale-'],
    },
    {
      ok: ['fame+', 'morale+'],
      fail: ['morale-'],
    },
  ],
  'winter-window': [
    {
      ok: ['morale+'],
      fail: ['trust-', 'morale-', 'fame+'],
    },
    {
      ok: ['trust+', 'morale+', 'fame+'],
    },
  ],
  'ag-release': [
    {
      ok: ['fame+', 'morale+'],
      fail: ['morale-'],
    },
    {
      ok: ['trust+'],
      fail: ['morale-'],
    },
    {
      ok: ['trust+'],
    },
  ],
  'oly-release': [
    {
      ok: ['fame+', 'morale+'],
      fail: ['morale-'],
    },
    {
      ok: ['trust+'],
      fail: ['morale-'],
    },
    {
      ok: ['trust+'],
    },
  ],
  puskas: [
    {
      ok: ['fame+'],
      fail: ['fame+', 'morale-'],
    },
    {
      ok: ['trust+', 'fame+', 'morale+'],
    },
  ],
  'winter-camp': [
    {
      ok: ['attr+', 'trust+', 'cond-'],
      fail: ['cond-'],
    },
    {
      ok: ['attr+', 'trust+'],
    },
  ],
  'team-k': [
    {
      ok: ['fame+', 'cond-'],
      fail: ['cond-', 'morale-', 'fame+'],
    },
    {
      ok: ['fame+', 'morale+', 'trust+', 'cond+'],
    },
  ],
  derby: [
    {
      ok: ['fame+', 'morale+'],
      fail: ['morale-'],
    },
    {
      ok: ['trust+'],
    },
  ],
  'asia-tour': [
    {
      ok: ['fame+', 'money+', 'cond-', 'trust+'],
    },
    {
      ok: ['cond+', 'fame+'],
    },
  ],
  'fw-drought': [
    {
      ok: ['attr+', 'morale+', 'cond-'],
      fail: ['cond-', 'morale-'],
    },
    {
      ok: ['attr+', 'trust+', 'morale+'],
    },
  ],
  'fw-one-on-one': [
    {
      ok: ['fame+', 'morale+'],
      fail: ['morale-'],
    },
    {
      ok: ['fame+', 'morale+'],
      fail: ['morale-'],
    },
  ],
  'fw-target': [
    {
      ok: ['attr+', 'trust+'],
      fail: ['attr-', 'morale-'],
    },
    {
      ok: ['attr+', 'trust+', 'morale+'],
      fail: ['trust-', 'morale-'],
    },
  ],
  'mf-freekick': [
    {
      ok: ['fame+', 'morale+', 'trust+'],
      fail: ['morale-'],
    },
    {
      ok: ['trust+', 'morale+'],
      fail: ['trust-'],
    },
  ],
  'mf-role': [
    {
      ok: ['attr+', 'trust+'],
      fail: ['morale-', 'trust-'],
    },
    {
      ok: ['attr+', 'trust+', 'fame+', 'morale+'],
      fail: ['trust-', 'morale-'],
    },
  ],
  'mf-press': [
    {
      ok: ['attr+', 'trust+', 'cond-'],
      fail: ['out', 'cond-'],
    },
    {
      ok: ['attr+', 'trust+'],
      fail: ['trust-'],
    },
  ],
  'df-marking': [
    {
      ok: ['trust+', 'fame+', 'morale+'],
      fail: ['morale-', 'trust-'],
    },
    {
      ok: ['trust+'],
      fail: ['morale-'],
    },
  ],
  'df-lastman': [
    {
      ok: ['fame+', 'morale+', 'trust+'],
      fail: ['trust-', 'morale-', 'fame-'],
    },
    {
      ok: ['attr+', 'trust+'],
      fail: ['morale-'],
    },
  ],
  'df-header': [
    {
      ok: ['fame+', 'morale+'],
      fail: ['cond-'],
    },
    {
      ok: ['trust+'],
    },
  ],
  'df-overlap': [
    {
      ok: ['trust+', 'cond-', 'fame+', 'morale+'],
      fail: ['trust-', 'cond-'],
    },
    {
      ok: ['trust+', 'cond+'],
    },
  ],
  'gk-error': [
    {
      ok: ['trust+', 'morale+', 'fame+'],
      fail: ['trust-', 'morale-'],
    },
    {
      ok: ['cond+', 'morale+', 'trust-'],
    },
  ],
  'gk-sweeper': [
    {
      ok: ['attr+', 'trust+'],
      fail: ['trust-', 'morale-'],
    },
    {
      ok: ['attr+', 'trust-'],
    },
  ],
  'gk-pk': [
    {
      ok: ['fame+', 'morale+', 'trust+'],
      fail: ['morale-'],
    },
    {
      ok: ['fame+', 'morale+'],
      fail: ['morale-'],
    },
  ],
  'gk-no1': [
    {
      ok: ['trust+', 'morale+'],
      fail: ['morale-'],
    },
    {
      ok: ['attr+', 'morale+'],
    },
  ],
  'gk-cross': [
    {
      ok: ['trust+', 'attr+'],
      fail: ['morale-', 'trust-'],
    },
    {
      ok: ['trust+'],
      fail: ['morale-'],
    },
  ],
  'dating-rumor': [
    {
      ok: ['morale+'],
    },
    {
      ok: ['fame+'],
    },
    {
      ok: ['trust+'],
    },
  ],
  'kid-autograph': [
    {
      ok: ['fame+'],
    },
    {
      ok: ['morale+', 'cond-'],
    },
  ],
  'legend-critic': [
    {
      ok: ['fame+', 'morale+'],
      fail: ['trust-', 'morale-'],
    },
    {
      ok: ['trust+'],
    },
  ],
  'hat-trick': [
    {
      ok: ['trust+', 'fame+', 'morale+'],
    },
    {
      ok: ['fame+', 'morale+'],
    },
  ],
  paparazzi: [
    {
      ok: ['fame+'],
    },
    {
      fail: ['fame+', 'morale-'],
    },
  ],
  'coach-farewell': [
    {
      ok: ['morale+', 'fame+'],
    },
    {
      ok: ['fame+', 'trust+', 'morale+'],
      fail: ['morale-'],
    },
  ],
  'nt-retire': [
    {
      ok: ['cond+'],
    },
    {},
  ],
  'party-wags': [
    {
      ok: ['fame+', 'morale+'],
      fail: ['fame+', 'cond-', 'morale-'],
    },
    {
      ok: ['morale+'],
    },
    {
      ok: ['cond+', 'trust+'],
    },
  ],
  'loan-talk': [
    {
      ok: ['trust-'],
    },
    {
      ok: ['trust+', 'morale+'],
      fail: ['morale-'],
    },
  ],
  'am-exam': [
    {
      ok: ['attr+', 'trust+', 'cond-'],
      fail: ['morale-', 'trust-'],
    },
    {
      ok: ['cond+', 'morale+'],
    },
  ],
  'am-parents': [
    {
      ok: ['morale+', 'cond+'],
      fail: ['morale-'],
    },
    {
      ok: ['cond-', 'morale+'],
    },
  ],
  'am-senior': [
    {
      ok: ['trust+', 'morale+'],
      fail: ['trust-', 'morale-'],
    },
    {
      ok: ['attr+', 'cond-'],
    },
  ],
  'am-captain': [
    {
      ok: ['trust+', 'fame+', 'morale+'],
      fail: ['morale-', 'cond-'],
    },
    {
      ok: ['attr+'],
    },
  ],
  'am-friendly': [
    {
      ok: ['fame+', 'morale+'],
      fail: ['cond-', 'morale-'],
    },
    {
      ok: ['attr+', 'trust+'],
    },
  ],
  'mf-switch': [
    {
      ok: ['fame+', 'morale+'],
      fail: ['trust-', 'morale-'],
    },
    {
      ok: ['trust+'],
    },
  ],
  'mf-tempo': [
    {
      ok: ['trust+', 'morale+'],
      fail: ['trust-', 'morale-'],
    },
    {
      ok: ['fame+', 'morale+'],
      fail: ['trust-', 'morale-'],
    },
  ],
  'fw-cross': [
    {
      ok: ['fame+', 'morale+'],
      fail: ['morale-'],
    },
    {
      ok: ['fame+', 'morale+'],
      fail: ['morale-'],
    },
  ],
  'fw-chase': [
    {
      ok: ['fame+', 'morale+', 'cond-'],
      fail: ['cond-'],
    },
    {
      ok: ['cond+'],
    },
  ],
  'df-trap': [
    {
      ok: ['trust+', 'morale+'],
      fail: ['trust-', 'morale-'],
    },
    {
      ok: ['trust+'],
    },
  ],
  'young-advice': [
    {
      ok: ['attr+', 'trust+', 'cond-'],
      fail: ['cond-', 'morale-'],
    },
    {
      ok: ['morale+'],
    },
  ],
  'young-sns': [
    {
      ok: ['fame+', 'morale+'],
      fail: ['morale-'],
    },
    {
      ok: ['cond+'],
    },
  ],
  'vet-recovery': [
    {
      ok: ['cond+', 'money-', 'morale+'],
    },
    {
      ok: ['cond+', 'trust+'],
      fail: ['trust-', 'morale-'],
    },
  ],
  'vet-mentor': [
    {
      ok: ['trust+', 'cond-', 'morale+'],
    },
    {
      ok: ['cond+'],
    },
  ],
  'wc-road-1': [
    {
      ok: ['story:worldcup', 'fame+', 'cond-', 'morale+'],
      fail: ['story:worldcup', 'cond-', 'morale-'],
    },
    {
      ok: ['story:worldcup', 'trust+', 'cond+'],
    },
  ],
  'wc-road-2': [
    {
      ok: ['fame+', 'morale+'],
      fail: ['out', 'morale-'],
    },
    {
      ok: ['trust-', 'cond+'],
    },
  ],
  'wc-road-3': [
    {
      ok: ['fame+', 'morale+'],
      fail: ['morale-', 'trust-'],
    },
    {
      ok: ['trust+', 'cond+'],
    },
  ],
  'nat-parade': [
    {
      ok: ['fame+', 'cond-', 'trust-', 'morale+'],
    },
    {
      ok: ['trust+', 'fame+'],
    },
  ],
  'post-tour-rest': [
    {
      ok: ['cond+', 'trust-', 'morale+'],
    },
    {
      ok: ['trust+', 'cond-'],
      fail: ['out', 'cond-', 'morale-'],
    },
  ],
  'cont-cup-eve': [
    {
      ok: ['trust-', 'fame+', 'morale+', 'cond+'],
    },
    {
      ok: ['trust+', 'cond-'],
    },
  ],
  'oa-wildcard': [
    {
      ok: ['morale+', 'trust-'],
      fail: ['morale-'],
    },
    {
      ok: ['trust+', 'cond+'],
    },
  ],
  'ballon-gala': [
    {
      ok: ['fame+', 'cond-', 'morale+'],
    },
    {
      ok: ['trust+', 'cond+'],
    },
  ],
  'ucl-anthem': [
    {
      ok: ['fame+', 'morale+'],
      fail: ['trust-', 'morale-'],
    },
    {
      ok: ['trust+'],
    },
  ],
  'cont-away': [
    {
      ok: ['fame+', 'morale+', 'cond-'],
      fail: ['cond-', 'morale-'],
    },
    {
      ok: ['trust+'],
    },
  ],
  'deadline-day': [
    {
      ok: ['morale+'],
      fail: ['trust-', 'morale-'],
    },
    {
      ok: ['trust+'],
    },
  ],
  testimonial: [
    {
      ok: ['fame+', 'morale+'],
    },
    {
      ok: ['money+', 'fame+'],
    },
  ],
  'club-wc': [
    {
      ok: ['fame+', 'cond-', 'money+', 'morale+'],
      fail: ['cond-', 'morale-'],
    },
    {
      ok: ['cond+', 'trust-'],
    },
  ],
  'intl-flight': [
    {
      ok: ['trust+', 'cond-', 'fame+'],
      fail: ['out', 'cond-'],
    },
    {
      ok: ['cond+', 'trust-'],
    },
  ],
};

export const eventPeek = (id: string, i: number): ChoicePeek | undefined => EVENT_PEEK[id]?.[i];
