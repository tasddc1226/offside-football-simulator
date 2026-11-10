CREATE TABLE `comp_customs` (
	`profile_id` text PRIMARY KEY NOT NULL,
	`names_json` text NOT NULL,
	`icons_json` text NOT NULL,
	`img_key` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
