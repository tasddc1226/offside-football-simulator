CREATE TABLE `kpi_daily` (
	`day` text NOT NULL,
	`metric` text NOT NULL,
	`dim` text DEFAULT 'all' NOT NULL,
	`value` real NOT NULL,
	`source` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`day`, `metric`, `dim`)
);
