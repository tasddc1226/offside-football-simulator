import type { Translation } from '../core';
import type { CareerOverviewMsgs } from '../ko/careerOverview';
export const careerOverview: Translation<CareerOverviewMsgs> = {
  calendarTitle: 'Tournament calendar',
  calendarHint:
    'National tournaments run at season end. Entry depends on qualification, age, selection and club release.',
  currentYear: 'Current year',
  endYear: 'Completed season',
  yearLabel: (p) => String(p.year),
  calendarAge: ' years old',
  wildcard: 'Over-age selection needed',
  youth: 'U-23 selection needed',
  senior: 'National selection needed',
  qualified: 'Qualified',
  eliminated: 'Did not qualify',
  qualification: 'Qualification pending',
  scoringTitle: 'League player records',
  scoringHint: 'League matches only. Joint leaders share the scoring and assist awards.',
  scoringLegacy: 'This season keeps the previous award rules. Rankings start next season.',
  goalRank: 'Goals',
  assistRank: 'Assists',
  mine: 'My player',
  rivalForward: 'Forward',
  rivalCreator: 'Midfielder',
  rankLabel: (p) => String(p.rank),
  seasonOver: 'Season over',
};
