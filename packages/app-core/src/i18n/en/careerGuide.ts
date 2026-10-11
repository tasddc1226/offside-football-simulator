import type { CareerGuideMsgs } from '../ko/careerGuide';
export const careerGuide: CareerGuideMsgs = {
  candidateNote:
    'Candidate attributes are a starting distribution. At kickoff, detailed attributes and body build are applied and recalculated, so your starting attributes may differ.',
  trainWeak: 'Choose Weakness Training under Personal Investment below.',
  guideTitle: 'Position development guide',
  guideNote:
    'Your type comes from the focus attributes chosen at creation. Raising attributes does not change your type.',
  focusLabel: 'Suggested focus',
  nameRule: (p: { field: string; min: number; max: number }) =>
    `Enter ${p.min}–${p.max} characters for ${p.field}.`,
  wallTitle: 'Your name joins the club’s Wall of Honour.',
  occupied: (p: { number: number; holder: string }) =>
    `Number ${p.number} remains retired for ${p.holder}.`,
  wallRule: 'Retired numbers remain a separate competitive record for each club and shirt number.',
};
