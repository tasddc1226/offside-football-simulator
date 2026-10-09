CREATE TABLE `referrals` (
	`invitee_id` text PRIMARY KEY NOT NULL,
	`inviter_id` text NOT NULL,
	`claimed_at` text NOT NULL,
	`done_at` text,
	`career_id` text,
	`inviter_rewarded` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`invitee_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`inviter_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `referrals_inviter_idx` ON `referrals` (`inviter_id`,`done_at`);