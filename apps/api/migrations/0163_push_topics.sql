ALTER TABLE `notifications` ADD `topic` text;--> statement-breakpoint
ALTER TABLE `push_devices` ADD `permission` text;--> statement-breakpoint
ALTER TABLE `push_preferences` ADD `topic_match` integer;--> statement-breakpoint
ALTER TABLE `push_preferences` ADD `topic_cup` integer;--> statement-breakpoint
ALTER TABLE `push_preferences` ADD `topic_league` integer;--> statement-breakpoint
ALTER TABLE `push_preferences` ADD `topic_friend` integer;--> statement-breakpoint
ALTER TABLE `push_preferences` ADD `topic_reward` integer;--> statement-breakpoint
ALTER TABLE `push_preferences` ADD `topic_attendance` integer;--> statement-breakpoint
ALTER TABLE `push_preferences` ADD `topic_comeback` integer;