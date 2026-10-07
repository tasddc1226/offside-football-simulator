CREATE TABLE `cups` (
	`id` text PRIMARY KEY NOT NULL,
	`season` integer NOT NULL,
	`edition` integer NOT NULL,
	`opens_at` text NOT NULL,
	`closes_at` text NOT NULL,
	`draw_at` text NOT NULL,
	`rounds_json` text NOT NULL,
	`capacity` integer NOT NULL,
	`min_filled` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cups_edition_unique` ON `cups` (`edition`);--> statement-breakpoint
-- T-11-145 제1회 오프사이드 컵(예전 contracts CUPS 상수). 접수 10/9~10/12, 추첨 10/13 12:00, 경기 10/13~10/20 21:00 KST.
INSERT OR IGNORE INTO `cups` (`id`, `season`, `edition`, `opens_at`, `closes_at`, `draw_at`, `rounds_json`, `capacity`, `min_filled`, `created_at`) VALUES ('s1-1', 1, 1, '2026-10-08T15:00:00.000Z', '2026-10-12T15:00:00.000Z', '2026-10-13T03:00:00.000Z', '["2026-10-13T12:00:00.000Z","2026-10-14T12:00:00.000Z","2026-10-15T12:00:00.000Z","2026-10-16T12:00:00.000Z","2026-10-17T12:00:00.000Z","2026-10-18T12:00:00.000Z","2026-10-19T12:00:00.000Z","2026-10-20T12:00:00.000Z"]', 64, 8, '2026-10-07T12:00:00.000Z');
