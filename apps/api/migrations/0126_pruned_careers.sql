CREATE TABLE `pruned_careers` (
	`career_id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`service_season` integer,
	`pruned_at` text NOT NULL
);
