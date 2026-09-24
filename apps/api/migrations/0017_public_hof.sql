ALTER TABLE `careers` ADD `public_name` text;--> statement-breakpoint
ALTER TABLE `careers` ADD `shirt_number` integer;--> statement-breakpoint
ALTER TABLE `careers` ADD `snapshot_json` text;--> statement-breakpoint
CREATE INDEX `careers_status_legend_idx` ON `careers` (`status`,`legend_score`);