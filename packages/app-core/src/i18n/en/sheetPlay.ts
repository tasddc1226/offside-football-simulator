import type { Translation } from '../core';
import type { SheetPlayMsgs } from '../ko/sheetPlay';

export const sheetPlay: Translation<SheetPlayMsgs> = {
  storyTag: (p) => `Story · ${p.name}`,
  eventResult: (p) => `Result · ${p.label}`,
  dexNew: '📖 New dex entry',
  dexNote: 'See it in the odds dex on Home',
  storyEnd: (p) => `Story complete · ${p.name}`,
  storyStarted: 'New story started:',
  storyNext: 'The story continues in the next stretch.',
  marketTitle: 'Where do you play next season?',
  salary: 'Salary',
  offerA11y: (p) =>
    `${p.name}, ${p.lg}${p.salary !== null ? `, salary ${p.salary}` : ''}${p.sub ? `, ${p.sub}` : ''}${p.reason ? `, ${p.reason}` : ''}`,
  noHonors: 'No awards this season.',
  promoTitle: 'Promotion to K League 1 confirmed',
  promoBodyWeb: (p) =>
    `Finishing first this season earned ${p.club} promotion. Next season brings a new challenge in K League 1.`,
  promoBodyApp: (p) =>
    `Finishing first this season confirmed promotion for ${p.club}. Next season you play in K League 1.`,
  promoDownWeb: (p) => `${p.club}, who gave up the spot · relegated to K League 2`,
  promoDownApp: (p) => `${p.club} · relegated to K League 2`,
  comps: 'Results by competition',
  tours: 'National team · International tournaments',
  gala: "Ballon d'Or ceremony",
  miles: 'Career milestones',
  scoutHint: 'Scout comment',
  fans: 'Fan reaction',
  ageWeb: (p) => `You're now ${p.age}. Time to get ready for next season.`,
  ageApp: (p) => `You're now ${p.age}. Get ready for next season.`,
};
