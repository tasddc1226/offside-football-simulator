CREATE TABLE `scout_pity` (
	`profile_id` text PRIMARY KEY NOT NULL,
	`used` integer DEFAULT 0 NOT NULL,
	`streak` integer DEFAULT 0 NOT NULL,
	`elites` integer DEFAULT 0 NOT NULL,
	`mode` text DEFAULT 'normal' NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
-- T-11-244 지금까지 쓴 프리미엄 스카우트권을 누적 사용 장수로 옮긴다. 스카우트권은 인앱 구매로만 들어왔으니 (받은 장수 − 환불로 회수한 장수) − 지금 가진 장수 = 쓴 장수. S가 나왔는지는 서버가 몰라 streak는 0에서 시작한다.
INSERT OR IGNORE INTO `scout_pity` (`profile_id`, `used`, `streak`, `elites`, `mode`, `updated_at`)
SELECT b.`profile_id`, b.`got` - coalesce(o.`qty`, 0), 0, 0, 'normal', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM (
  SELECT `profile_id`, sum(`qty` - coalesce(`revoked_qty`, 0)) AS `got`
  FROM `iap_purchases` WHERE `item` = 'scout' GROUP BY `profile_id`
) b
JOIN `profiles` p ON p.`id` = b.`profile_id`
LEFT JOIN `owner_items` o ON o.`profile_id` = b.`profile_id` AND o.`item` = 'scout'
WHERE b.`got` - coalesce(o.`qty`, 0) > 0;
