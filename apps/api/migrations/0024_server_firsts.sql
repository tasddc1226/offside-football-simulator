CREATE TABLE `app_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `server_firsts` (
	`id` text PRIMARY KEY NOT NULL,
	`career_id` text NOT NULL,
	`achieved_at` text NOT NULL,
	`year` integer,
	FOREIGN KEY (`career_id`) REFERENCES `careers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `server_firsts_achieved_idx` ON `server_firsts` (`achieved_at`);