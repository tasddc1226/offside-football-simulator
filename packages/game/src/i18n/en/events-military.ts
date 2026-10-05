// 이벤트 영어 문구 — 정의 모듈의 이벤트 id → 문구(events-data.ts EventText).
import type { EventText } from '../../events-data';
import type { GameState } from '../../types';
import { milAbroad, sangmuChance } from '../../military';
import { tn } from '../names';

// military.ts의 모집 공고 문구를 영어로 옮긴 것. 입영 연기 기한(만 28세)·낮은 합격률 기준(0.35)은 정의와 같다.
const MIL_AGE = 28;
const MIL_LOW = 0.35;

/** 앞으로 span년 안에 U-23 나이로 나갈 수 있는 특례 대회(military.ts milExemptHope와 같은 규칙). */
function hopeOf(s: GameState, span = 2): string[] {
  const out: string[] = [];
  for (let y = s.year; y <= s.year + span; y++) {
    const age = s.age + (y - s.year);
    if (age > 23) break;
    if (y % 4 === 2) out.push(`${y} Asian Games`);
    if (y % 4 === 0 && s.nat?.qual[y] !== false) out.push(`${y} Olympics`);
  }
  return out;
}

const noticeText = (s: GameState): string => {
  const left = MIL_AGE - s.age,
    hope = hopeOf(s),
    abroad = milAbroad(s);
  return (
    `This year's Gimcheon Sangmu recruitment notice is out. ${left} ${left === 1 ? 'year' : 'years'} left until the military service deferral deadline (age ${MIL_AGE}).` +
    (abroad
      ? ` Players based abroad are at a disadvantage in screening because they lack domestic match records, and if accepted you would have to terminate your contract with ${tn(s.club.name)} and return home.`
      : ' K League players have the edge when appearance records are screened.') +
    (hope.length ? ` An exemption is still possible at the ${hope.join(' and ')}.` : '') +
    (sangmuChance(s) < MIL_LOW ? " Your chances of being accepted aren't high." : '')
  );
};

const apply: EventText['choices'][number] = {
  label: (s) => `Apply (est. acceptance rate ${Math.round(sangmuChance(s) * 100)}%)`,
  ok: (s) =>
    (milAbroad(s)
      ? 'You submitted your application. The club is sad to see you preparing to leave. The result will be announced after the season ends.'
      : 'You submitted your application. The result will be announced after the season ends. You feel lighter.') +
    (hopeOf(s).length
      ? ' You can still be picked for the national team from Sangmu, and a medal moves you to sports service and an early discharge.'
      : ''),
};

const defer: EventText['choices'][number] = {
  label: (s) =>
    hopeOf(s).length
      ? 'Defer enlistment and go for an exemption'
      : 'Defer enlistment and focus on your career',
  ok: (s) =>
    hopeOf(s).length
      ? "You'll aim to make the squad and win a medal. If you fail, the enlistment deadline will close in on you."
      : "You won't apply this year. The enlistment deadline is a year closer.",
};

/** 시즌 끝에 현역으로 입대하면 복무(다음 두 시즌) 중에 열려 못 나가는 특례 대회. */
const armyMissed = (s: GameState): string[] => hopeOf(s).filter((h) => !h.startsWith(`${s.year} `));

const army: EventText['choices'][number] = {
  label: 'Serve in the army first, after the season',
  ok: (s) =>
    "You decided to get it done while you're young. You'll enlist when the season ends. Expect an 18-month gap." +
    (armyMissed(s).length
      ? ` You can't take part in the ${armyMissed(s).join(' and ')} held during your service.`
      : ''),
};

export const events_military: Record<string, EventText> = {
  'mil-notice': {
    title: 'Gimcheon Sangmu recruitment notice',
    text: noticeText,
    choices: [apply, defer],
  },
  'mil-notice-low': {
    title: 'Gimcheon Sangmu recruitment notice',
    text: noticeText,
    choices: [apply, defer, army],
  },
};
