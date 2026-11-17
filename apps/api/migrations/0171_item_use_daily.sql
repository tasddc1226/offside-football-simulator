CREATE TABLE `item_use_daily` (
	`day` text NOT NULL,
	`item` text NOT NULL,
	`uses` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`day`, `item`)
);
