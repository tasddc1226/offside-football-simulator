CREATE TABLE `billing_alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`store` text NOT NULL,
	`kind` text NOT NULL,
	`product_id` text NOT NULL,
	`test` integer NOT NULL,
	`created_at` text NOT NULL,
	`sent_at` text,
	`lease_until` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `billing_alerts_pending_idx` ON `billing_alerts` (`sent_at`,`lease_until`,`created_at`);