CREATE TABLE `web_pay_orders` (
	`order_id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`product_id` text NOT NULL,
	`amount` integer NOT NULL,
	`status` text NOT NULL,
	`payment_key` text,
	`method` text,
	`test` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`approved_at` text,
	`canceled_at` text,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `web_pay_orders_profile_idx` ON `web_pay_orders` (`profile_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `web_pay_orders_payment_key_unique` ON `web_pay_orders` (`payment_key`);