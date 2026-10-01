ALTER TABLE `careers` ADD `hidden` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- 백필 규칙은 isAutomatedCareer(입력 없는 시즌 2개 이상·webdriver·headless)와 같다. 스크립트 클릭(synthetic)은 합계 비교라 새 업로드 때만 본다.
UPDATE `careers` SET `hidden` = 1 WHERE `id` IN (SELECT `career_id` FROM `career_seasons` WHERE `signals_json` IS NOT NULL GROUP BY `career_id` HAVING sum(json_extract(`signals_json`, '$.clicks') + json_extract(`signals_json`, '$.keys') + json_extract(`signals_json`, '$.touches') = 0) >= 2 OR sum(coalesce(json_extract(`signals_json`, '$.webdriver'), 0) = 1) > 0 OR sum(coalesce(json_extract(`signals_json`, '$.headless'), 0) = 1) > 0);--> statement-breakpoint
DELETE FROM `server_firsts` WHERE EXISTS (SELECT 1 FROM `careers` WHERE `careers`.`id` = `server_firsts`.`career_id` AND `careers`.`hidden` = 1);--> statement-breakpoint
DELETE FROM `server_records` WHERE EXISTS (SELECT 1 FROM `careers` WHERE `careers`.`id` = `server_records`.`career_id` AND `careers`.`hidden` = 1);--> statement-breakpoint
DELETE FROM `app_meta` WHERE `key` IN ('server_firsts_backfill', 'server_firsts_cursor');
