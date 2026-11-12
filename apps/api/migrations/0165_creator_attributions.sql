CREATE TABLE `creator_attributions` (
	`profile_id` text PRIMARY KEY NOT NULL,
	`tracking_id` text NOT NULL,
	`attributed_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
