PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_retired_numbers` (
	`season` integer DEFAULT 0 NOT NULL,
	`club_id` text NOT NULL,
	`number` integer NOT NULL,
	`career_id` text NOT NULL,
	`club` text NOT NULL,
	`score` integer NOT NULL,
	`seq` integer NOT NULL,
	`granted_at` text NOT NULL,
	PRIMARY KEY(`season`, `club_id`, `number`),
	FOREIGN KEY (`career_id`) REFERENCES `careers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
/* T-11-029 영구결번 시즌 분리. 기존 행의 season은 그 커리어의 service_season(NULL이면 0 = 프리시즌)로 채우고,
   seq는 시즌 안에서 기존 순서대로 다시 센다(운영은 개막 전이라 전부 프리시즌 — seq가 그대로다). */
INSERT INTO `__new_retired_numbers`("season", "club_id", "number", "career_id", "club", "score", "seq", "granted_at") SELECT "season", "club_id", "number", "career_id", "club", "score", row_number() OVER (PARTITION BY "season" ORDER BY "seq"), "granted_at" FROM (SELECT coalesce((SELECT "service_season" FROM `careers` WHERE `careers`.`id` = `retired_numbers`.`career_id`), 0) AS "season", "club_id", "number", "career_id", "club", "score", "seq", "granted_at" FROM `retired_numbers`);--> statement-breakpoint
DROP TABLE `retired_numbers`;--> statement-breakpoint
ALTER TABLE `__new_retired_numbers` RENAME TO `retired_numbers`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `retired_numbers_career_idx` ON `retired_numbers` (`career_id`);