import type { Translation } from '../core';
import type { DexMsgs } from '../ko/dex';

export const dex: Translation<DexMsgs> = {
  title: 'Odds guide',
  intro:
    "Your success chance changes with your player's condition. This shows the possible range and what affects it.",
  rulesTitle: 'Common rules',
  calculating: 'Calculating odds…',
  events: 'Events',
  foundCount: (p) => `Found ${p.n}/${p.total}`,
  groupLabel: 'Category',
  filterAll: 'All',
  foundMark: 'Found',
  tapHint: 'Tap an event to see the odds for each choice.',
  choicesHead: (p) => `${p.n} ${p.n === 1 ? 'choice' : 'choices'} · odds`,
  lockedStory: (p) => `Story event not met yet · stage ${p.stage}`,
  lockedSpecial: 'Special event not met yet',
  dependsOnPast: 'The odds depend on what you chose in earlier stages.',
  noteWeb:
    'For ▲, a higher value raises your chance. For ▼, it lowers it. The range runs from the lowest to the highest chance your player can get.',
  noteApp:
    'For ▲, a higher value raises your chance. For ▼, it lowers it. The range runs from the lowest to the highest chance across every possible player state.',
  oddsSafe: 'Safe',
  oddsSure: 'Sure',
  oddsVaries: 'Varies',
  oddsMinigame: (p) => `One-tap · zone ${p.range}%`,
  ruleRateTerm: 'Chance of an event',
  ruleRate: (p) =>
    `Each phase: ${p.pre} in the preseason, ${p.season} in the first and second halves. The next stage of a storyline arrives separately, at its scheduled time.`,
  ruleSameTerm: 'Repeat events',
  ruleSame: (p) =>
    `An event that has appeared won't come back for at least ${p.n} phases, and the more you see it, the less often it shows (weight 1/(1 + times seen)).`,
  ruleRollTerm: 'Success rolls',
  ruleRoll:
    'The % shown in the choice window is the real chance. A random number from 0 to 100 below it means success. There are no hidden modifiers, and the rules are the same for every player regardless of ads, purchases or account.',
  ruleMiniTerm: 'One-tap minigames',
  ruleMini:
    'Choices with a match scene, like penalties, one-on-ones and shootouts, are decided by timing instead of odds. Stop the needle in the green zone of the gauge to succeed. If you do not tap within 3 seconds, you fail. Your attributes set the zone width, and this guide lists the zone as a share of the gauge. With reduced motion on, the shown chance is used instead.',
  ruleSafeTerm: 'Safe choices',
  ruleSafe: (p) =>
    `They resolve with no roll, but good effects shrink to ${p.span}, and there is a ${p.twist} chance of a cost (one of ${p.cost}).`,
  ruleResultTerm: 'Result values',
  ruleResult: (p) => `Other effects land within ${p.span} of the size shown.`,
  ruleTwistTerm: 'Surprise twist',
  ruleTwist: (p) =>
    `If there was no cost, there is a ${p.twist} chance that one attribute changes. The chance it goes up is ${p.ok} after a success or sure result, ${p.fail} after a failure and ${p.safe} after a safe choice. Going up is +1 to +2, going down is −1.`,
};
