import type { GAME_SERVICES_ACHIEVEMENTS } from '@offside/contracts/game-center';

/** Generated identifiers read back from the OFFSIDE Play Games Console. */
export const PLAY_GAMES_ACHIEVEMENTS: Record<keyof typeof GAME_SERVICES_ACHIEVEMENTS, string> = {
  first_retirement: 'CgkIn7jAtdQSEAIQDA',
  first_europe: 'CgkIn7jAtdQSEAIQCA',
  first_national_title: 'CgkIn7jAtdQSEAIQEg',
  first_ballon: 'CgkIn7jAtdQSEAIQAQ',
  career_goals_100: 'CgkIn7jAtdQSEAIQCQ',
  career_goals_300: 'CgkIn7jAtdQSEAIQAg',
  career_assists_100: 'CgkIn7jAtdQSEAIQEQ',
  career_assists_200: 'CgkIn7jAtdQSEAIQDg',
  career_trophies_10: 'CgkIn7jAtdQSEAIQBg',
  career_ballon_3: 'CgkIn7jAtdQSEAIQBQ',
  retirements_5: 'CgkIn7jAtdQSEAIQEA',
  veteran_40: 'CgkIn7jAtdQSEAIQDw',
  career_goals_750: 'CgkIn7jAtdQSEAIQAw',
  career_goals_1000: 'CgkIn7jAtdQSEAIQDQ',
  career_assists_500: 'CgkIn7jAtdQSEAIQCg',
  career_trophies_50: 'CgkIn7jAtdQSEAIQCw',
  career_ballon_10: 'CgkIn7jAtdQSEAIQBA',
  retirements_50: 'CgkIn7jAtdQSEAIQBw',
};

export const PLAY_GAMES_LEADERBOARDS = {
  legend: 'CgkIn7jAtdQSEAIQEw',
  career_goals: 'CgkIn7jAtdQSEAIQFQ',
  career_assists: 'CgkIn7jAtdQSEAIQFg',
  weekly_legend: 'CgkIn7jAtdQSEAIQFA',
} as const;
