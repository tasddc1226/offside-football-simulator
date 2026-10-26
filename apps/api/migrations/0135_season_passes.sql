CREATE TABLE `season_passes` (
	`profile_id` text NOT NULL,
	`season` integer NOT NULL,
	`store` text NOT NULL,
	`transaction_id` text NOT NULL,
	`test` integer DEFAULT false NOT NULL,
	`claimed` integer DEFAULT 0 NOT NULL,
	`claim_id` text,
	`purchased_at` text,
	`created_at` text NOT NULL,
	`refunded_at` text,
	PRIMARY KEY(`profile_id`, `season`),
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `season_passes_tx_unique` ON `season_passes` (`store`,`transaction_id`);--> statement-breakpoint
CREATE INDEX `season_passes_created_idx` ON `season_passes` (`created_at`);