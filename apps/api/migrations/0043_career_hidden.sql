ALTER TABLE `careers` ADD `hidden` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `careers` SET `hidden` = 1 WHERE `id` IN (SELECT `career_id` FROM `career_seasons` WHERE `signals_json` IS NOT NULL GROUP BY `career_id` HAVING sum(json_extract(`signals_json`, '$.clicks') + json_extract(`signals_json`, '$.keys') + json_extract(`signals_json`, '$.touches') = 0) >= 2 OR sum(coalesce(json_extract(`signals_json`, '$.webdriver'), 0) = 1) > 0 OR sum(coalesce(json_extract(`signals_json`, '$.headless'), 0) = 1) > 0);--> statement-breakpoint
DELETE FROM `server_firsts` WHERE `career_id` IN (SELECT `id` FROM `careers` WHERE `hidden` = 1);--> statement-breakpoint
DELETE FROM `server_records` WHERE `career_id` IN (SELECT `id` FROM `careers` WHERE `hidden` = 1);--> statement-breakpoint
DELETE FROM `app_meta` WHERE `key` IN ('server_firsts_backfill', 'server_firsts_cursor');
