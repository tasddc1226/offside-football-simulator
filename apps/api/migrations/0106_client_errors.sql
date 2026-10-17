CREATE TABLE `client_errors` (
	`day` text NOT NULL,
	`fingerprint` text NOT NULL,
	`platform` text NOT NULL,
	`kind` text NOT NULL,
	`message` text NOT NULL,
	`frame` text NOT NULL,
	`place` text NOT NULL,
	`stack` text NOT NULL,
	`first_version` text NOT NULL,
	`last_version` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`first_at` text NOT NULL,
	`last_at` text NOT NULL,
	PRIMARY KEY(`day`, `fingerprint`)
);
--> statement-breakpoint
CREATE INDEX `client_errors_last_at_idx` ON `client_errors` (`last_at`);