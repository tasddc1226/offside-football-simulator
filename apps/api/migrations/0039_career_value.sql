ALTER TABLE `careers` ADD `value` integer;--> statement-breakpoint
CREATE INDEX `careers_hof_value_idx` ON `careers` (`status`,`value`,`legend_score`);