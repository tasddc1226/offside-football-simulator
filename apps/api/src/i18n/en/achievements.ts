export const tenureLabels = {
  'one-club': 'One-club player',
  'long-service': 'Long service',
} as const;

export const achievementDescs: Record<string, string> = {
  'team-mates':
    'All 11 played for the same pro club at some point. High school, university and military seasons do not count.',
  'team-club': 'All 11 must have retired at the same club.',
  // T-11-541
  's-teen-20': 'Score 20 goals in a season at 19 or younger.',
  's-veteran-20': 'Score 20 goals in a season at 35 or older.',
  's-quadruple':
    'Win four club trophies such as league, cup and continental titles in one season. Super cups, the Club World Championship and national team titles do not count.',
  'c-journeyman': 'Play in five or more pro leagues, not counting military seasons.',
  'team-clean': 'Counts wins without conceding in matches you started.',
  'team-thrash': 'Counts wins by 4 or more goals in matches you started.',
  'team-six': 'Score 6 or more goals in a match you started.',
  'team-winrate': 'Play 50 or more matches with a win rate of 70% or higher.',
  'team-wall': 'Play 30 or more matches and concede fewer goals than matches played.',
};

/** T-11-541 숨은 업적(달성 전). */
export const hiddenAchievement = {
  label: 'Hidden achievement',
  descs: {
    'secret-farewell': "It happens in a player's final season.",
    'secret-homecoming': 'The last choice of a player who moved around.',
  } as Record<string, string>,
};
