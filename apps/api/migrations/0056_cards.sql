CREATE TABLE `cards` (
	`career_id` text PRIMARY KEY NOT NULL,
	`owner_id` text,
	`service_season` integer NOT NULL,
	`pos` text NOT NULL,
	`dpos` text,
	`nation` text,
	`number` integer,
	`peak` integer NOT NULL,
	`legend_score` integer NOT NULL,
	`peak_profile` text,
	`card_value` integer,
	`retire_value` integer NOT NULL,
	`transfers` integer DEFAULT 0 NOT NULL,
	`released_at` text,
	`released_value` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `cards_owner_season_idx` ON `cards` (`owner_id`,`service_season`,`peak`);--> statement-breakpoint
-- T-11-080 이미 은퇴한 선수의 카드를 만든다. 기준가(card_value)는 스냅샷을 JS로 계산해야 해서 비워 두고
-- db/repos/cardValues.ts가 명예의 전당 목록 조회 때 조금씩 채운다.
INSERT INTO `cards` (`career_id`, `owner_id`, `service_season`, `pos`, `dpos`, `nation`, `number`, `peak`, `legend_score`, `peak_profile`, `retire_value`, `created_at`, `updated_at`)
SELECT `id`, `profile_id`, coalesce(`service_season`, 0), `pos`, `dpos`, `nation`, `shirt_number`, `peak`, coalesce(`legend_score`, 0), `peak_profile`, coalesce(`value`, 0), coalesce(`retired_at`, `updated_at`), coalesce(`retired_at`, `updated_at`)
FROM `careers` WHERE `status` = 'retired' AND `peak` IS NOT NULL;
