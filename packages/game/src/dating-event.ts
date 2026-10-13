import { isPro, addStat } from './engine.js';
import { gDatingText as L } from './i18n/ko/gDating.js';
import type { EventDef } from './types.js';

export const DATING_EVENT: EventDef = {
  id: 'dating-rumor',
  get title() {
    return L.title;
  },
  w: 0.6,
  cond: (s) => s.age >= 20 && isPro(s) && s.fame >= 35 && s.phase > 0,
  text: () => L.text,
  choices: [
    {
      label: () => L.privateLabel,
      ok: {
        text: () => L.privateResult,
        fx: (s) => {
          addStat(s, 'morale', 2);
        },
      },
    },
    {
      label: () => L.confirmLabel,
      ok: {
        text: () => L.confirmResult,
        fx: (s) => {
          addStat(s, 'fame', 2);
          addStat(s, 'morale', 1);
        },
      },
    },
    {
      label: () => L.pitchLabel,
      ok: {
        text: () => L.pitchResult,
        fx: (s) => {
          addStat(s, 'trust', 1);
          addStat(s, 'cond', -2);
        },
      },
    },
  ],
};
