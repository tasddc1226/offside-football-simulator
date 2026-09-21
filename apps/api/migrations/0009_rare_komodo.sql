CREATE TABLE `career_publications` (
	`id` text PRIMARY KEY NOT NULL,
	`career_id` text NOT NULL,
	`article_json` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`career_id`) REFERENCES `careers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `career_publications_career_id_unique` ON `career_publications` (`career_id`);