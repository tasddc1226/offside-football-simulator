CREATE TABLE `best11_candidates` (
	`career_id` text PRIMARY KEY NOT NULL,
	`season` integer NOT NULL,
	`profile_id` text NOT NULL,
	`dpos` text NOT NULL,
	`retired_at` text NOT NULL,
	`raw_json` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`career_id`) REFERENCES `careers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `best11_candidates_season_idx` ON `best11_candidates` (`season`);--> statement-breakpoint
CREATE TABLE `best11_changes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`season` integer NOT NULL,
	`slot` text NOT NULL,
	`in_career_id` text,
	`out_career_id` text,
	`at` text NOT NULL,
	FOREIGN KEY (`in_career_id`) REFERENCES `careers`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`out_career_id`) REFERENCES `careers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `best11_changes_season_idx` ON `best11_changes` (`season`,`at`);--> statement-breakpoint
CREATE TABLE `best11_seasons` (
	`season` integer PRIMARY KEY NOT NULL,
	`final_at` text,
	`updated_at` text NOT NULL,
	`gate_json` text
);
--> statement-breakpoint
CREATE TABLE `best11_slots` (
	`season` integer NOT NULL,
	`slot` text NOT NULL,
	`career_id` text NOT NULL,
	`score` real NOT NULL,
	`since` text NOT NULL,
	PRIMARY KEY(`season`, `slot`),
	FOREIGN KEY (`career_id`) REFERENCES `careers`(`id`) ON UPDATE no action ON DELETE cascade
);
