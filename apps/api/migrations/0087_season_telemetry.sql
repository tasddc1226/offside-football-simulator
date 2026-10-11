CREATE TABLE `season_telemetry` (
	`id` integer PRIMARY KEY NOT NULL,
	`career_id` text NOT NULL,
	`year` integer NOT NULL,
	`age` integer NOT NULL,
	`ovr` integer NOT NULL,
	`events_json` text,
	`growth_json` text,
	`created_at` text NOT NULL
);
