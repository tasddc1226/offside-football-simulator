CREATE TABLE `gift_claims` (
	`profile_id` text NOT NULL,
	`gift_id` text NOT NULL,
	`claim_id` text NOT NULL,
	`claimed_at` text NOT NULL,
	PRIMARY KEY(`profile_id`, `gift_id`),
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
