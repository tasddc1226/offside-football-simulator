CREATE TABLE `server_records` (
	`id` text PRIMARY KEY NOT NULL,
	`career_id` text NOT NULL,
	`value` integer NOT NULL,
	`achieved_at` text NOT NULL,
	`year` integer,
	FOREIGN KEY (`career_id`) REFERENCES `careers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
/* T-10-056: 발롱도르 1회 단계 id를 다른 끝없는 단계와 같은 key+값 꼴로 맞춘다. */
UPDATE `server_firsts` SET `id` = 'ballon1' WHERE `id` = 'ballon';
