ALTER TABLE `careers` ADD `service_season` integer;--> statement-breakpoint
-- 시즌 1 개막(2026-10-06 0시 KST) 뒤 이 배포 전에 처음 올라온 커리어가 있으면 시즌 1로 채운다(개막 전 배포면 0행).
UPDATE `careers` SET `service_season` = 1 WHERE `created_at` >= '2026-10-05T15:00:00.000Z' AND `service_season` IS NULL;
--> statement-breakpoint
-- 개막 전에 올라온 커리어는 프리시즌(0)이다.
UPDATE `careers` SET `service_season` = 0 WHERE `created_at` < '2026-10-05T15:00:00.000Z' AND `service_season` IS NULL;
