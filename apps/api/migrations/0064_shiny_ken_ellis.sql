CREATE TABLE `push_preferences` (
	`profile_id` text PRIMARY KEY NOT NULL,
	`notice` integer DEFAULT true NOT NULL,
	`release` integer DEFAULT true NOT NULL,
	`team` integer DEFAULT true NOT NULL,
	`market` integer DEFAULT true NOT NULL,
	`social` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
