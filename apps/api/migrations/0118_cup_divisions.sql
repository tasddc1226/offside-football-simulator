DROP INDEX `cups_edition_unique`;--> statement-breakpoint
ALTER TABLE `cups` ADD `division` text;--> statement-breakpoint
ALTER TABLE `cups` ADD `ovr_max` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `cups_edition_division_unique` ON `cups` (`edition`,coalesce("division", ''));
