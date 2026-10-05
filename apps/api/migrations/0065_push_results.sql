CREATE TABLE `push_interactions` (
	`notification_id` text PRIMARY KEY NOT NULL,
	`clicked_at` text NOT NULL,
	`target_opened_at` text,
	FOREIGN KEY (`notification_id`) REFERENCES `notifications`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `push_results` (
	`id` text PRIMARY KEY NOT NULL,
	`notification_id` text NOT NULL,
	`state` text NOT NULL,
	`accepted_at` text,
	`confirmed_at` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`notification_id`) REFERENCES `notifications`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `push_results_notification_idx` ON `push_results` (`notification_id`);--> statement-breakpoint
CREATE INDEX `notifications_created_idx` ON `notifications` (`created_at`);