import type { EventText } from './events-data.js';
import { gMomentsText as L } from './i18n/ko/gMoments.js';
import { FAN_LETTER_NAMES, endStory, schedule, startStory, storyActive } from './story.js';
import type { EventDef, GameState } from './types.js';

// The queued ID keeps the original gift even if the player transfers or reloads.
const gifts = ['shirt', 'ball'] as const;
type Gift = (typeof gifts)[number];
const letterId = (gift: Gift) => `fan-letter-${gift}`;

export function startFanLetter(s: GameState, gift: Gift) {
  if (s.story?.fanLetter) return;
  startStory(s, 'fanLetter');
  schedule(s, letterId(gift), 3);
}

function letterText(copy: typeof L, gift: Gift): EventText {
  return {
    get title() {
      return copy.letterTitle;
    },
    text: () => (gift === 'shirt' ? copy.letterShirt : copy.letterBall),
    choices: [
      { label: () => copy.letterCheer, ok: () => copy.letterCheerResult },
      { label: () => copy.letterTip, ok: () => copy.letterTipResult },
    ],
  };
}

export function fanLetterTranslations(copy: typeof L): Record<string, EventText> {
  return Object.fromEntries(gifts.map((gift) => [letterId(gift), letterText(copy, gift)]));
}

export const FAN_LETTERS: EventDef[] = gifts.map((gift) => {
  const scene = letterText(L, gift);
  return {
    id: letterId(gift),
    get title() {
      return scene.title;
    },
    text: scene.text,
    w: 0,
    chain: true,
    story: 'fanLetter',
    stage: 2,
    cond: (s) => storyActive(s, 'fanLetter'),
    choices: scene.choices.map((choice, i) => ({
      label: choice.label,
      ok: {
        text: choice.ok,
        fx: (s) =>
          endStory(s, 'fanLetter', i === 0 ? FAN_LETTER_NAMES.cheer : FAN_LETTER_NAMES.tip),
      },
    })),
  };
});
