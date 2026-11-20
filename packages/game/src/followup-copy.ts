import type { EventText } from './events-data.js';
import type { gFollowupText } from './i18n/ko/gFollowup.js';
import type { GameState } from './types.js';

export function followupTexts(c: typeof gFollowupText) {
  const refused = (s: GameState) => s.flags.squadCallReply === 'refused';
  return {
    'mf-pivot-return': {
      get title() {
        return c.roleTitle;
      },
      text: (s) => (s.flags.pivotCoverWorked ? c.roleGood : c.roleBad),
      choices: [
        { label: () => c.pair, ok: () => c.pairOk },
        { label: () => c.push, ok: () => c.pushOk },
      ],
    },
    'df-marking-rematch': {
      get title() {
        return c.markTitle;
      },
      text: (s) => (s.flags.markApproach === 'man' ? c.markMan : c.markZone),
      choices: [
        { label: () => c.follow, ok: () => c.followOk },
        { label: () => c.hand, ok: () => c.handOk },
      ],
    },
    'mf-read-freekick': {
      get title() {
        return c.kickTitle;
      },
      text: () => c.kickBody,
      choices: [
        { label: () => c.shoot, ok: () => c.shootOk },
        { label: () => c.far, ok: () => c.farOk },
      ],
    },
    'academy-invitation': {
      get title() {
        return c.youthTitle;
      },
      text: (s) => (s.flags.academyKeepsake === 'photo' ? c.photo : c.armband),
      choices: [
        { label: () => c.tell, ok: () => c.tellOk },
        { label: () => c.teach, ok: () => c.teachOk },
      ],
    },
    'squad-list-call': {
      get title() {
        return c.callTitle;
      },
      text: (s) => (refused(s) ? c.refuse : c.calm),
      choices: [
        {
          label: (s) => (refused(s) ? c.return : c.compete),
          ok: (s) => (refused(s) ? c.returnOk : c.competeOk),
        },
        {
          label: (s) => (refused(s) ? c.wait : c.club),
          ok: (s) => (refused(s) ? c.waitOk : c.clubOk),
        },
      ],
    },
  } satisfies Record<string, EventText>;
}
