ALTER TABLE `iap_purchases` ADD `refunded_at` text;--> statement-breakpoint
ALTER TABLE `iap_purchases` ADD `revoked_qty` integer DEFAULT 0 NOT NULL;