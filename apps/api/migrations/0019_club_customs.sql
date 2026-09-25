CREATE TABLE `club_customs` (
	`profile_id` text PRIMARY KEY NOT NULL,
	`clubs_json` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
