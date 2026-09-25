ALTER TABLE `profiles` ADD `nickname` text;--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_nickname_unique` ON `profiles` (lower("nickname"));