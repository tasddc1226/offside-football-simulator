CREATE TABLE `locker_player_notes` (
	`career_id` text PRIMARY KEY NOT NULL,
	`note` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`career_id`) REFERENCES `careers`(`id`) ON UPDATE no action ON DELETE cascade
);
