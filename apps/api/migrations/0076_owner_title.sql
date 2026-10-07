ALTER TABLE `profiles` ADD `title` text;--> statement-breakpoint
ALTER TABLE `profiles` ADD `title_pinned` integer DEFAULT 0 NOT NULL;