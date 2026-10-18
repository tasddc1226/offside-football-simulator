CREATE TABLE `card_exchange_claims` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`exchange_id` text NOT NULL,
	`need` integer NOT NULL,
	`cards` integer,
	`reward_json` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "card_exchange_claims_cards_check" CHECK("card_exchange_claims"."cards" IS NULL OR "card_exchange_claims"."cards" = "card_exchange_claims"."need")
);
--> statement-breakpoint
CREATE INDEX `card_exchange_claims_profile_idx` ON `card_exchange_claims` (`profile_id`,`exchange_id`);--> statement-breakpoint
ALTER TABLE `cards` ADD `consumed_in` text;--> statement-breakpoint
ALTER TABLE `owner_title_progress` ADD `exchanges` integer DEFAULT 0 NOT NULL;