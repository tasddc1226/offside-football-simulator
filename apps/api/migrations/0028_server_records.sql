CREATE TABLE `server_records` (
	`id` text PRIMARY KEY NOT NULL,
	`career_id` text NOT NULL,
	`value` integer NOT NULL,
	`achieved_at` text NOT NULL,
	`year` integer,
	FOREIGN KEY (`career_id`) REFERENCES `careers`(`id`) ON UPDATE no action ON DELETE cascade
);
