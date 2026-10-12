CREATE TABLE `membership_events` (
	`id` text PRIMARY KEY NOT NULL,
	`store` text NOT NULL,
	`environment` text NOT NULL,
	`profile_id` text,
	`kind` text NOT NULL,
	`created_at` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` text,
	`error_code` text
);
--> statement-breakpoint
CREATE INDEX `membership_events_pending` ON `membership_events` (`status`,`next_attempt_at`);--> statement-breakpoint
CREATE TABLE `membership_periods` (
	`store` text NOT NULL,
	`environment` text NOT NULL,
	`transaction_id` text NOT NULL,
	`chain_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`started_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`paid` integer NOT NULL,
	`benefit_version` integer NOT NULL,
	`granted_at` text,
	`refunded_at` text,
	PRIMARY KEY(`store`, `environment`, `transaction_id`),
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `membership_periods_owner` ON `membership_periods` (`profile_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `owner_memberships` (
	`profile_id` text PRIMARY KEY NOT NULL,
	`store` text NOT NULL,
	`environment` text NOT NULL,
	`chain_id` text NOT NULL,
	`status` text NOT NULL,
	`paid_until` text NOT NULL,
	`grace_until` text,
	`auto_renew` integer DEFAULT true NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`theme` text DEFAULT 'classic' NOT NULL,
	`frame` text DEFAULT 'none' NOT NULL,
	`supporter_title` integer DEFAULT false NOT NULL,
	`verified_at` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `owner_memberships_chain` ON `owner_memberships` (`store`,`environment`,`chain_id`);--> statement-breakpoint
CREATE INDEX `owner_memberships_expiry` ON `owner_memberships` (`status`,`paid_until`);