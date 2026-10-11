CREATE TABLE `profile_avatars` (
	`profile_id` text PRIMARY KEY NOT NULL,
	`id` text NOT NULL,
	`image` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profile_avatars_id_unique` ON `profile_avatars` (`id`);--> statement-breakpoint
ALTER TABLE `profiles` ADD `avatar_id` text;