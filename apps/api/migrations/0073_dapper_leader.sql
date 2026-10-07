CREATE TABLE `cup_entries` (
	`cup_id` text NOT NULL,
	`team_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`name` text NOT NULL,
	`manager` text NOT NULL,
	`ovr` integer NOT NULL,
	`grp` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`stage` text,
	`rewarded_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`cup_id`, `team_id`),
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cup_entries_cup_profile_unique` ON `cup_entries` (`cup_id`,`profile_id`);--> statement-breakpoint
CREATE INDEX `cup_entries_profile_idx` ON `cup_entries` (`profile_id`);--> statement-breakpoint
CREATE TABLE `cup_matches` (
	`id` text PRIMARY KEY NOT NULL,
	`cup_id` text NOT NULL,
	`round` text NOT NULL,
	`grp` integer DEFAULT 0 NOT NULL,
	`slot` integer NOT NULL,
	`home_team_id` text,
	`away_team_id` text,
	`at` text NOT NULL,
	`played_at` text,
	`home_goals` integer,
	`away_goals` integer,
	`pens_home` integer,
	`pens_away` integer,
	`winner_team_id` text,
	`forfeit` integer DEFAULT 0 NOT NULL,
	`detail_json` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cup_matches_cup_round_slot_unique` ON `cup_matches` (`cup_id`,`round`,`grp`,`slot`);--> statement-breakpoint
CREATE TABLE `cup_state` (
	`cup_id` text PRIMARY KEY NOT NULL,
	`seed` text NOT NULL,
	`groups` integer NOT NULL,
	`drawn_at` text NOT NULL,
	`done_at` text
);
--> statement-breakpoint
CREATE TABLE `owner_items` (
	`profile_id` text NOT NULL,
	`item` text NOT NULL,
	`qty` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`profile_id`, `item`),
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "owner_items_qty_check" CHECK("owner_items"."qty" >= 0)
);
