CREATE TABLE `retired_numbers` (
	`club_id` text NOT NULL,
	`number` integer NOT NULL,
	`career_id` text NOT NULL,
	`club` text NOT NULL,
	`score` integer NOT NULL,
	`seq` integer NOT NULL,
	`granted_at` text NOT NULL,
	PRIMARY KEY(`club_id`, `number`),
	FOREIGN KEY (`career_id`) REFERENCES `careers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `retired_numbers_career_idx` ON `retired_numbers` (`career_id`);