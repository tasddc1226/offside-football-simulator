CREATE TABLE `careers` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_profile_id` text NOT NULL,
	`status` text NOT NULL,
	`revision` integer NOT NULL,
	`created_service_season_id` text NOT NULL,
	`ruleset_version` text NOT NULL,
	`content_pack_version` text NOT NULL,
	`verification_status` text DEFAULT 'PENDING' NOT NULL,
	`last_synced_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`archived_at` text,
	FOREIGN KEY (`owner_profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_service_season_id`) REFERENCES `service_seasons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `careers_owner_profile_id_updated_at_idx` ON `careers` (`owner_profile_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `careers_created_service_season_id_status_idx` ON `careers` (`created_service_season_id`,`status`);--> statement-breakpoint
CREATE TABLE `command_log` (
	`career_id` text NOT NULL,
	`revision` integer NOT NULL,
	`command_id` text NOT NULL,
	`command_type` text NOT NULL,
	`payload_json` text NOT NULL,
	`result_hash` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`career_id`, `revision`),
	FOREIGN KEY (`career_id`) REFERENCES `careers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `command_log_career_id_command_id_idx` ON `command_log` (`career_id`,`command_id`);--> statement-breakpoint
CREATE TABLE `idempotency` (
	`owner_profile_id` text NOT NULL,
	`key` text NOT NULL,
	`request_hash` text NOT NULL,
	`response_status` integer NOT NULL,
	`response_body` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	PRIMARY KEY(`owner_profile_id`, `key`),
	FOREIGN KEY (`owner_profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idempotency_expires_at_idx` ON `idempotency` (`expires_at`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`recovery_code_hash` text,
	`recovery_code_issued_at` text,
	`google_sub` text,
	`email` text,
	`linked_at` text,
	`toss_anon_key_hash` text,
	`toss_linked_at` text,
	`settings_json` text NOT NULL,
	`created_at` text NOT NULL,
	`last_seen_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_google_sub_unique` ON `profiles` (`google_sub`);--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_toss_anon_key_hash_unique` ON `profiles` (`toss_anon_key_hash`);--> statement-breakpoint
CREATE TABLE `service_seasons` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`status` text NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`ruleset_version` text NOT NULL,
	`content_pack_version` text NOT NULL,
	`challenge_set_id` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `service_seasons_status_idx` ON `service_seasons` (`status`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`channel` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`revoked_at` text,
	`last_seen_at` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash_unique` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `sessions_profile_id_idx` ON `sessions` (`profile_id`);--> statement-breakpoint
CREATE INDEX `sessions_expires_at_idx` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`career_id` text NOT NULL,
	`revision` integer NOT NULL,
	`checkpoint` text NOT NULL,
	`state` text NOT NULL,
	`state_hash` text NOT NULL,
	`ruleset_version` text NOT NULL,
	`content_pack_version` text NOT NULL,
	`rng_state_json` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`career_id`) REFERENCES `careers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `snapshots_career_id_revision_unique` ON `snapshots` (`career_id`,`revision`);