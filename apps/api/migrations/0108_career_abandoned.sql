ALTER TABLE `careers` ADD `abandoned_at` text;--> statement-breakpoint
CREATE INDEX `careers_profile_abandoned_idx` ON `careers` (`profile_id`,`status`,`abandoned_at`,`updated_at`,`id`);