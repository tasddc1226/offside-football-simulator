/* T-11-029 서버 최초 기록·서버 기록 시즌 분리. 기존 행의 season은 그 커리어의 service_season(NULL이면 0 = 프리시즌)로
   채운다(운영은 개막 전이라 전부 프리시즌). 시즌 1부터 시즌마다 따로 겨룬다 — 키는 (season, id). */
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_server_firsts` (
	`season` integer DEFAULT 0 NOT NULL,
	`id` text NOT NULL,
	`career_id` text NOT NULL,
	`achieved_at` text NOT NULL,
	`year` integer,
	PRIMARY KEY(`season`, `id`),
	FOREIGN KEY (`career_id`) REFERENCES `careers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_server_firsts`("season", "id", "career_id", "achieved_at", "year") SELECT coalesce((SELECT "service_season" FROM `careers` WHERE `careers`.`id` = `server_firsts`.`career_id`), 0), "id", "career_id", "achieved_at", "year" FROM `server_firsts`;--> statement-breakpoint
DROP TABLE `server_firsts`;--> statement-breakpoint
ALTER TABLE `__new_server_firsts` RENAME TO `server_firsts`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `server_firsts_achieved_idx` ON `server_firsts` (`achieved_at`);--> statement-breakpoint
CREATE TABLE `__new_server_records` (
	`season` integer DEFAULT 0 NOT NULL,
	`id` text NOT NULL,
	`career_id` text NOT NULL,
	`value` integer NOT NULL,
	`achieved_at` text NOT NULL,
	`year` integer,
	PRIMARY KEY(`season`, `id`),
	FOREIGN KEY (`career_id`) REFERENCES `careers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_server_records`("season", "id", "career_id", "value", "achieved_at", "year") SELECT coalesce((SELECT "service_season" FROM `careers` WHERE `careers`.`id` = `server_records`.`career_id`), 0), "id", "career_id", "value", "achieved_at", "year" FROM `server_records`;--> statement-breakpoint
DROP TABLE `server_records`;--> statement-breakpoint
ALTER TABLE `__new_server_records` RENAME TO `server_records`;--> statement-breakpoint
PRAGMA foreign_keys=ON;