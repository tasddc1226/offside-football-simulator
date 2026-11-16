import { z } from 'zod';
import { LEAGUE_BASE } from './club-names.js';

/** Shared with the existing first/europe achievement; keep its original tier-based rule. */
export const ACHIEVEMENT_EUROPEAN_LEAGUES = LEAGUE_BASE.filter(
  (league) => !league.amateur && league.tier >= 4,
).map((league) => league.name);

/** App Store Connect identifiers. Published identifiers must never be renamed. */
export const GAME_CENTER_LEADERBOARD_ID = 'com.offsidelab.app.leaderboard.career_legend.v1';
export const GAME_CENTER_ACHIEVEMENTS = {
  first_retirement: 'com.offsidelab.app.achievement.first_retirement',
  first_europe: 'com.offsidelab.app.achievement.first_europe',
  first_national_title: 'com.offsidelab.app.achievement.first_national_title',
  first_ballon: 'com.offsidelab.app.achievement.first_ballon',
} as const;
export const GameCenterAchievementSchema = z.enum([
  'first_retirement',
  'first_europe',
  'first_national_title',
  'first_ballon',
]);
export type GameCenterAchievement = z.infer<typeof GameCenterAchievementSchema>;

export const GameCenterProgressSchema = z.strictObject({
  profileId: z.string(),
  legendScore: z.number().int().nonnegative().nullable(),
  achievements: z.array(GameCenterAchievementSchema).max(4),
});
export type GameCenterProgress = z.infer<typeof GameCenterProgressSchema>;

/** Expanded catalog is opt-in; build 30 must keep receiving the original four-key contract. */
export const GAME_CENTER_EXPANDED_ACHIEVEMENTS = {
  ...GAME_CENTER_ACHIEVEMENTS,
  career_goals_100: 'com.offsidelab.app.achievement.career_goals_100',
  career_goals_300: 'com.offsidelab.app.achievement.career_goals_300',
  career_assists_100: 'com.offsidelab.app.achievement.career_assists_100',
  career_assists_200: 'com.offsidelab.app.achievement.career_assists_200',
  career_trophies_10: 'com.offsidelab.app.achievement.career_trophies_10',
  career_ballon_3: 'com.offsidelab.app.achievement.career_ballon_3',
  retirements_5: 'com.offsidelab.app.achievement.retirements_5',
  veteran_40: 'com.offsidelab.app.achievement.veteran_40',
} as const;
export const GAME_CENTER_LEADERBOARDS = {
  legend: GAME_CENTER_LEADERBOARD_ID,
  career_goals: 'com.offsidelab.app.leaderboard.career_goals.v1',
  career_assists: 'com.offsidelab.app.leaderboard.career_assists.v1',
  weekly_legend: 'com.offsidelab.app.leaderboard.weekly_legend.v1',
} as const;
export const GAME_CENTER_WEEKLY_START = '2026-11-22T15:00:00.000Z';
export const GAME_CENTER_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const ExpandedAchievementSchema = z.enum(
  Object.keys(GAME_CENTER_EXPANDED_ACHIEVEMENTS) as [
    keyof typeof GAME_CENTER_EXPANDED_ACHIEVEMENTS,
    ...(keyof typeof GAME_CENTER_EXPANDED_ACHIEVEMENTS)[],
  ],
);
export const GameCenterExpandedProgressSchema = z.strictObject({
  profileId: z.string(),
  scores: z.strictObject({
    legend: z.number().int().nonnegative().nullable(),
    career_goals: z.number().int().nonnegative().nullable(),
    career_assists: z.number().int().nonnegative().nullable(),
    weekly_legend: z.number().int().nonnegative().nullable(),
  }),
  week: z.strictObject({ startsAt: z.iso.datetime(), endsAt: z.iso.datetime() }),
  achievements: z.array(ExpandedAchievementSchema).max(12),
});
export type GameCenterExpandedProgress = z.infer<typeof GameCenterExpandedProgressSchema>;

/** Build 31 accepts only twelve keys. New tiers use a separate versioned response. */
export const GAME_SERVICES_ACHIEVEMENTS = {
  ...GAME_CENTER_EXPANDED_ACHIEVEMENTS,
  career_goals_750: 'com.offsidelab.app.achievement.career_goals_750',
  career_goals_1000: 'com.offsidelab.app.achievement.career_goals_1000',
  career_assists_500: 'com.offsidelab.app.achievement.career_assists_500',
  career_trophies_50: 'com.offsidelab.app.achievement.career_trophies_50',
  career_ballon_10: 'com.offsidelab.app.achievement.career_ballon_10',
  retirements_50: 'com.offsidelab.app.achievement.retirements_50',
} as const;
export const GAME_SERVICES_ACHIEVEMENT_LIMIT = Object.keys(GAME_SERVICES_ACHIEVEMENTS).length;
export const GameServicesProgressSchema = GameCenterExpandedProgressSchema.extend({
  achievements: z
    .array(
      z.enum(
        Object.keys(GAME_SERVICES_ACHIEVEMENTS) as [
          keyof typeof GAME_SERVICES_ACHIEVEMENTS,
          ...(keyof typeof GAME_SERVICES_ACHIEVEMENTS)[],
        ],
      ),
    )
    .max(GAME_SERVICES_ACHIEVEMENT_LIMIT),
});
export type GameServicesProgress = z.infer<typeof GameServicesProgressSchema>;
/** Google resets its weekly boards Sunday 00:00 UTC-7, including during standard time. */
export const PLAY_GAMES_WEEKLY_START = '2026-11-15T07:00:00.000Z';
