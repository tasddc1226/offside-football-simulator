CREATE TABLE `api_status_buckets` (
	`bucket` text PRIMARY KEY NOT NULL,
	`requests` integer DEFAULT 0 NOT NULL,
	`total_ms` integer DEFAULT 0 NOT NULL,
	`slow` integer DEFAULT 0 NOT NULL,
	`errors` integer DEFAULT 0 NOT NULL
);
