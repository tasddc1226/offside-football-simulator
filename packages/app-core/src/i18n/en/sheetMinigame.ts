import type { Translation } from '../core';
import type { SheetMinigameMsgs } from '../ko/sheetMinigame';

export const sheetMinigame: Translation<SheetMinigameMsgs> = {
  mgEyebrow: 'One tap · stop in the green zone',
  mgA11y: (p) => `${p.tap}. Tap when the needle is in the green zone`,
  late: "Time's up!",
  saveOk: 'Save!',
  saveFail: 'Conceded…',
  goal: 'Goal!',
  crossbar: 'Crossbar!',
  tooLong: 'Too long!',
  blocked: 'Blocked!',
  dragEyebrow: 'Drag shot · drag up toward the goal',
  dragA11y: 'Drag shot. Drag from the ball toward the goal and release to shoot',
  dragHint: 'Drag farther toward the goal (up), then release',
  dragIdle: '↑ Drag up and release',
  shotSaved: 'Saved by the keeper!',
  shotPost: 'Off the post!',
  shotOver: 'Skied over the bar…',
  shotWide: 'Off target!',
  lateReadout: (p) => `You did not shoot within ${p.sec} seconds`,
  powerWeak: 'weak',
  powerOver: 'too much',
  powerGood: 'good',
  readout: (p) => `Power ${p.power}% (${p.label}) · Straightness ${p.straight}%`,
};
