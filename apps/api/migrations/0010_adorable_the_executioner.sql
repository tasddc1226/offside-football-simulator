CREATE TABLE `career_challenge_admissions` (
	`key_hash` text PRIMARY KEY NOT NULL,
	`career_id` text NOT NULL,
	`request_hash` text NOT NULL,
	`response_json` text NOT NULL,
	FOREIGN KEY (`career_id`) REFERENCES `careers`(`id`) ON UPDATE no action ON DELETE cascade
);
