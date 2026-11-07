CREATE TABLE `league_news_ai` (
	`season` integer NOT NULL,
	`round` integer NOT NULL,
	`kind` text NOT NULL,
	`ref` text NOT NULL,
	`text_json` text NOT NULL,
	`tries` integer NOT NULL,
	`model` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`season`, `round`)
);
