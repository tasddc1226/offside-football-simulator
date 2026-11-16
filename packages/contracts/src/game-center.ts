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
