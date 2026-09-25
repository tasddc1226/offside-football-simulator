CREATE INDEX `careers_hof_goals_idx` ON `careers` (`status`,`goals`,`legend_score`);--> statement-breakpoint
CREATE INDEX `careers_hof_assists_idx` ON `careers` (`status`,`assists`,`legend_score`);--> statement-breakpoint
-- drizzle-kit 0.31이 식 인덱스를 쉼표에서 잘라 내보내 손으로 고쳤다(스냅샷은 정상 — db:check 통과).
CREATE INDEX `careers_hof_ga_idx` ON `careers` (`status`,(coalesce("goals", 0) + coalesce("assists", 0)),`legend_score`);--> statement-breakpoint
CREATE INDEX `careers_hof_apps_idx` ON `careers` (`status`,`apps`,`legend_score`);--> statement-breakpoint
CREATE INDEX `careers_hof_trophies_idx` ON `careers` (`status`,`trophies`,`legend_score`);--> statement-breakpoint
CREATE INDEX `careers_hof_awards_idx` ON `careers` (`status`,`awards`,`legend_score`);--> statement-breakpoint
CREATE INDEX `careers_hof_ballon_idx` ON `careers` (`status`,`ballon`,`legend_score`);--> statement-breakpoint
CREATE INDEX `careers_hof_caps_idx` ON `careers` (`status`,`caps`,`legend_score`);--> statement-breakpoint
CREATE INDEX `careers_hof_peak_idx` ON `careers` (`status`,`peak`,`legend_score`);