CREATE TABLE `career_renames` (
	`id` text PRIMARY KEY NOT NULL,
	`career_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`old_name` text,
	`new_name` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `career_renames_career_idx` ON `career_renames` (`career_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `career_renames_profile_idx` ON `career_renames` (`profile_id`,`created_at`);