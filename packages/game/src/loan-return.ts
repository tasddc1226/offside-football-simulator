// A booked meeting uses the existing saveable event queue. The two review IDs remember
// which promise the player made, including when the game is closed between halves.
import type { GameState, EventDef } from './types.js';
import type { EventText } from './events-data.js';
import { gLoanText as L } from './i18n/ko/gLoan.js';
import { tnBase } from './i18n/names.js';
import { turnNo } from './story.js';
import { addStat } from './stats.js';

type Goal = 'starts' | 'minutes';
const goals = {
  starts: { id: 'loan-review-starts', target: 5, count: (s: GameState) => s.season.starts },
  minutes: { id: 'loan-review-minutes', target: 450, count: (s: GameState) => s.season.mins },
} as const;
const goalKeys: Goal[] = ['starts', 'minutes'];
export const LOAN_RETURN_ID = 'loan-return-talk';

export function bookLoanMeeting(s: GameState, id: string) {
  const at = turnNo(s);
  // Preseason and the first-half review each have exactly one appropriate phase.
  // Give this appointment that slot; keep every other chain and its own expiry.
  s.chains = [{ id, at, until: at }, ...(s.chains ?? []).filter((c) => c.id !== id)];
}

function opener(copy: typeof L): EventText {
  return {
    title: copy.returnTitle,
    text: (s) => {
      const last = s.career[s.career.length - 1];
      return last?.loan
        ? copy.returnRecord({ club: tnBase(last.club), apps: last.apps })
        : copy.returnPrompt;
    },
    choices: [
      { label: copy.pickStarts, ok: copy.promiseStarts },
      { label: copy.pickMinutes, ok: copy.promiseMinutes },
    ],
  };
}
function review(copy: typeof L, key: Goal): EventText {
  const goal = goals[key];
  const met = (s: GameState) => goal.count(s) >= goal.target;
  return {
    title: key === 'starts' ? copy.startsTitle : copy.minutesTitle,
    text: (s) =>
      (key === 'starts' ? copy.startsReport : copy.minutesReport)({ actual: goal.count(s) }),
    choices: [
      { label: copy.roleLabel, ok: (s) => (met(s) ? copy.roleMet : copy.roleMiss) },
      { label: copy.trainingLabel, ok: (s) => (met(s) ? copy.trainMet : copy.trainMiss) },
    ],
  };
}
export function loanReturnTexts(copy: typeof L): Record<string, EventText> {
  return {
    [LOAN_RETURN_ID]: opener(copy),
    [goals.starts.id]: review(copy, 'starts'),
    [goals.minutes.id]: review(copy, 'minutes'),
  };
}

const talk = opener(L);
export const LOAN_RETURN_EVENTS: EventDef[] = [
  {
    id: LOAN_RETURN_ID,
    title: talk.title,
    chain: true,
    w: 0,
    cond: (s) => s.phase === 0 && !!s.career[s.career.length - 1]?.loan,
    text: talk.text,
    choices: goalKeys.map((key, i) => ({
      label: talk.choices[i]!.label,
      ok: { text: talk.choices[i]!.ok, fx: (s) => bookLoanMeeting(s, goals[key].id) },
    })),
  },
  ...goalKeys.map((key): EventDef => {
    const scene = review(L, key);
    const goal = goals[key];
    return {
      id: goal.id,
      title: scene.title,
      chain: true,
      w: 0,
      cond: (s) => s.phase === 1 && !!s.career[s.career.length - 1]?.loan,
      text: scene.text,
      choices: [
        {
          label: scene.choices[0]!.label,
          ok: {
            text: scene.choices[0]!.ok,
            fx: (s) => addStat(s, 'trust', goal.count(s) >= goal.target ? 1 : 0),
          },
        },
        {
          label: scene.choices[1]!.label,
          ok: {
            text: scene.choices[1]!.ok,
            fx: (s) => addStat(s, 'morale', goal.count(s) >= goal.target ? 3 : 2),
          },
        },
      ],
    };
  }),
];
