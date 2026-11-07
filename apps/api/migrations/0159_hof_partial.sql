-- T-11-663 명예의 전당 인덱스 14개를 은퇴 커리어만 담는 부분 인덱스로 바꾼다. drizzle-kit이 careers_hof_ga_idx 식 인덱스 SQL을
-- 깨뜨려(0021 · 0069와 같은 문제) 그 줄만 손으로 고쳤다(스냅샷은 생성된 그대로).
DROP INDEX `careers_hof_score_order_idx`;--> statement-breakpoint
DROP INDEX `careers_hof_season_score_order_idx`;--> statement-breakpoint
DROP INDEX `careers_hof_dpos_idx`;--> statement-breakpoint
DROP INDEX `careers_hof_count_idx`;--> statement-breakpoint
DROP INDEX `careers_hof_goals_idx`;--> statement-breakpoint
DROP INDEX `careers_hof_assists_idx`;--> statement-breakpoint
DROP INDEX `careers_hof_ga_idx`;--> statement-breakpoint
DROP INDEX `careers_hof_apps_idx`;--> statement-breakpoint
DROP INDEX `careers_hof_trophies_idx`;--> statement-breakpoint
DROP INDEX `careers_hof_awards_idx`;--> statement-breakpoint
DROP INDEX `careers_hof_ballon_idx`;--> statement-breakpoint
DROP INDEX `careers_hof_caps_idx`;--> statement-breakpoint
DROP INDEX `careers_hof_peak_idx`;--> statement-breakpoint
DROP INDEX `careers_hof_value_idx`;--> statement-breakpoint
CREATE INDEX `careers_hof_score_order_idx` ON `careers` (`status`,`hidden`,"legend_score" desc,`retired_at`,`id`,`retire_age`,`service_season`,`pos`,`dpos`,`public_name`) WHERE "careers"."status" = 'retired';--> statement-breakpoint
CREATE INDEX `careers_hof_season_score_order_idx` ON `careers` (`status`,`hidden`,`service_season`,"legend_score" desc,`retired_at`,`id`,`retire_age`,`pos`,`dpos`,`public_name`) WHERE "careers"."status" = 'retired';--> statement-breakpoint
CREATE INDEX `careers_hof_dpos_idx` ON `careers` (`status`,`hidden`,`dpos`,`service_season`,`legend_score`,`retired_at`,`retire_age`,`pos`) WHERE "careers"."status" = 'retired';--> statement-breakpoint
CREATE INDEX `careers_hof_count_idx` ON `careers` (`status`,`hidden`,`service_season`,`pos`,`retire_age`,`legend_score`,`retired_at`,`goals`,`assists`,`apps`,`trophies`,`awards`,`ballon`,`caps`,`peak`,`value`) WHERE "careers"."status" = 'retired';--> statement-breakpoint
CREATE INDEX `careers_hof_goals_idx` ON `careers` (`status`,`goals`,`legend_score`) WHERE "careers"."status" = 'retired';--> statement-breakpoint
CREATE INDEX `careers_hof_assists_idx` ON `careers` (`status`,`assists`,`legend_score`) WHERE "careers"."status" = 'retired';--> statement-breakpoint
CREATE INDEX `careers_hof_ga_idx` ON `careers` (`status`,(coalesce("goals", 0) + coalesce("assists", 0)),`legend_score`) WHERE "careers"."status" = 'retired';--> statement-breakpoint
CREATE INDEX `careers_hof_apps_idx` ON `careers` (`status`,`apps`,`legend_score`) WHERE "careers"."status" = 'retired';--> statement-breakpoint
CREATE INDEX `careers_hof_trophies_idx` ON `careers` (`status`,`trophies`,`legend_score`) WHERE "careers"."status" = 'retired';--> statement-breakpoint
CREATE INDEX `careers_hof_awards_idx` ON `careers` (`status`,`awards`,`legend_score`) WHERE "careers"."status" = 'retired';--> statement-breakpoint
CREATE INDEX `careers_hof_ballon_idx` ON `careers` (`status`,`ballon`,`legend_score`) WHERE "careers"."status" = 'retired';--> statement-breakpoint
CREATE INDEX `careers_hof_caps_idx` ON `careers` (`status`,`caps`,`legend_score`) WHERE "careers"."status" = 'retired';--> statement-breakpoint
CREATE INDEX `careers_hof_peak_idx` ON `careers` (`status`,`peak`,`legend_score`) WHERE "careers"."status" = 'retired';--> statement-breakpoint
CREATE INDEX `careers_hof_value_idx` ON `careers` (`status`,`value`,`legend_score`) WHERE "careers"."status" = 'retired';