CREATE TABLE `board_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`nickname` text NOT NULL,
	`body` text NOT NULL,
	`admin` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`post_id`) REFERENCES `board_posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `board_comments_post_created_idx` ON `board_comments` (`post_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `board_comments_profile_idx` ON `board_comments` (`profile_id`);--> statement-breakpoint
CREATE TABLE `board_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`board` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`version` text,
	`pinned` integer DEFAULT false NOT NULL,
	`author_profile_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `board_posts_board_created_idx` ON `board_posts` (`board`,`created_at`);