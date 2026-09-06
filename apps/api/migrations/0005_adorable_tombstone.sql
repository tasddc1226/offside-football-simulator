ALTER TABLE `service_seasons` ADD `ends_at_nullable` text;--> statement-breakpoint
UPDATE `service_seasons` SET `ends_at_nullable` = `ends_at`;--> statement-breakpoint
ALTER TABLE `service_seasons` DROP COLUMN `ends_at`;--> statement-breakpoint
ALTER TABLE `service_seasons` RENAME COLUMN `ends_at_nullable` TO `ends_at`;
