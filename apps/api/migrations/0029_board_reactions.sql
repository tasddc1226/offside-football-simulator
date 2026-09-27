CREATE TABLE `board_post_likes` (
	`post_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`post_id`, `profile_id`),
	FOREIGN KEY (`post_id`) REFERENCES `board_posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `board_post_likes_profile_idx` ON `board_post_likes` (`profile_id`);--> statement-breakpoint
ALTER TABLE `board_posts` ADD `view_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `board_posts` ADD `like_count` integer DEFAULT 0 NOT NULL;