import { recordFirstMarking } from './marking-fixture.js';
import { followupTexts } from './followup-copy.js';
import { gFollowupText } from './i18n/ko/gFollowup.js';
import { natRefusing } from './national.js';
import { addAttr, addStat } from './stats.js';
import { schedule } from './story.js';
import type { EventDef, GameState } from './types.js';

export function bookPivotReview(s: GameState, worked: boolean) {
  s.flags.pivotCoverClub = s.club.id;
  s.flags.pivotCoverWorked = worked;
  schedule(s, 'mf-pivot-return', 1, 3);
}
export function bookMarkingRematch(s: GameState, approach: 'man' | 'zone') {
  s.flags.markClub = s.club.id;
  s.flags.markLeague = s.leagueId;
  s.flags.markApproach = approach;
  // Older pending openers have no match identity. Honour their original timed follow-up.
  if (s.markingFixture) recordFirstMarking(s, approach);
  else schedule(s, 'df-marking-rematch', 1, 3);
}
export function bookFreekick(s: GameState) {
  s.flags.freekickClub = s.club.id;
  schedule(s, 'mf-read-freekick', 0, 3);
}
export function bookAcademyVisit(s: GameState, keepsake: 'photo' | 'armband') {
  s.flags.academyKeepsake = keepsake;
  schedule(s, 'academy-invitation', 3);
}
export function bookSquadCall(s: GameState, reply: 'refused' | 'calm') {
  s.flags.squadCallReply = reply;
  schedule(s, 'squad-list-call', 0, 3);
}

const text = followupTexts(gFollowupText);
type Effect = (s: GameState) => void;
function followup(
  id: keyof typeof text,
  cond: EventDef['cond'],
  first: Effect,
  second: Effect,
): EventDef {
  const scene = text[id];
  return {
    id,
    chain: true,
    w: 0,
    cond,
    get title() {
      return scene.title;
    },
    text: scene.text,
    choices: scene.choices.map((c, i) => ({
      label: c.label,
      ok: { text: c.ok, fx: i === 0 ? first : second },
    })),
  };
}
export const CAREER_FOLLOWUPS = [
  followup(
    'mf-pivot-return',
    (s) => s.pos === 'MF' && s.flags.pivotCoverClub === s.club.id,
    (s) => addAttr(s, 'def', 1),
    (s) => addAttr(s, 'dri', 1),
  ),
  followup(
    'df-marking-rematch',
    (s) =>
      s.pos === 'DF' &&
      (s.markingFixture ? s.markingFixture.returnRound !== undefined : s.phase > 0 && !s.injury) &&
      s.flags.markClub === s.club.id &&
      s.flags.markLeague === s.leagueId,
    (s) => {
      addAttr(s, 'pac', 1);
      delete s.markingFixture;
    },
    (s) => {
      addAttr(s, 'def', 1);
      delete s.markingFixture;
    },
  ),
  followup(
    'mf-read-freekick',
    (s) => s.pos === 'MF' && s.phase > 0 && !s.injury && s.flags.freekickClub === s.club.id,
    (s) => addAttr(s, 'sho', 1),
    (s) => addAttr(s, 'pas', 1),
  ),
  followup(
    'academy-invitation',
    (s) => !!s.flags.academyKeepsake,
    (s) => addStat(s, 'morale', 4),
    (s) => addStat(s, 'fame', 2),
  ),
  followup(
    'squad-list-call',
    (s) =>
      !s.nat.retired &&
      (s.flags.squadCallReply === 'refused'
        ? natRefusing(s)
        : s.flags.squadCallReply === 'calm' && !natRefusing(s)),
    (s) => {
      if (s.flags.squadCallReply === 'refused') delete s.flags.natQuit;
      addStat(s, 'morale', 3);
    },
    (s) => addStat(s, 'cond', 3),
  ),
];
