CREATE TABLE `member_tenure` (
	`profile_id` text PRIMARY KEY NOT NULL,
	`since` text NOT NULL,
	`until` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
-- T-11-818 지금 구독 줄로 연속 구독을 채운다. 11-23 기준 가장 오래된 구독도 31일이라 끊겼다 이어진 구단주가 없어, 처음 묶인
-- 시각을 연속 시작으로 써도 된다. 운영 memberships는 약 70행이다.
INSERT INTO `member_tenure` (`profile_id`, `since`, `until`, `updated_at`)
SELECT `profile_id`, min(`created_at`), max(`until`), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM `memberships` GROUP BY `profile_id`;
