CREATE TABLE `competition_challenge_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`day_key` text NOT NULL,
	`week_key` text NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`ruleset_version` text NOT NULL,
	`content_pack_version` text NOT NULL,
	`scoring_policy_version` text NOT NULL,
	`scenario_json` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `competition_challenge_versions_day_unique` ON `competition_challenge_versions` (`day_key`);
--> statement-breakpoint
CREATE TABLE `competition_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`challenge_version_id` text NOT NULL,
	`owner_profile_id` text NOT NULL,
	`action_ids_json` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`state_json` text NOT NULL,
	`result_json` text,
	`result_hash` text,
	`score` integer,
	`max_score` integer,
	`verification_status` text NOT NULL,
	`public_opt_in` integer DEFAULT 0 NOT NULL,
	`public_alias` text NOT NULL,
	`submitted_at` text,
	FOREIGN KEY (`challenge_version_id`) REFERENCES `competition_challenge_versions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `competition_entries_profile_challenge_unique` ON `competition_entries` (`owner_profile_id`,`challenge_version_id`);
--> statement-breakpoint
CREATE INDEX `competition_entries_challenge_public_idx` ON `competition_entries` (`challenge_version_id`,`verification_status`,`public_opt_in`,`score`);
--> statement-breakpoint
CREATE TABLE `competition_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_id` text NOT NULL,
	`revision` integer NOT NULL,
	`action_id` text NOT NULL,
	`expected_revision` integer NOT NULL,
	`request_key_hash` text NOT NULL,
	`request_hash` text NOT NULL,
	`response_json` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `competition_entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `competition_actions_request_key_hash_unique` ON `competition_actions` (`request_key_hash`);
--> statement-breakpoint
CREATE UNIQUE INDEX `competition_actions_entry_revision_unique` ON `competition_actions` (`entry_id`,`revision`);
--> statement-breakpoint
CREATE INDEX `competition_actions_entry_idx` ON `competition_actions` (`entry_id`,`revision`);
