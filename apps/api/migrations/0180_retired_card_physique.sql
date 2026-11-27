CREATE TABLE `card_physique_edits` (
	`career_id` text NOT NULL,
	`revision` integer NOT NULL,
	`height` integer NOT NULL,
	`weight` integer NOT NULL,
	`editor` text NOT NULL,
	`edited_at` text NOT NULL,
	PRIMARY KEY(`career_id`, `revision`)
);
