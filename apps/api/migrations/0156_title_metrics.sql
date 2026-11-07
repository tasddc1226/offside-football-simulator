CREATE TABLE `owner_title_metrics` (
	`profile_id` text PRIMARY KEY NOT NULL,
	`criteria_version` integer DEFAULT 0 NOT NULL,
	`metrics_json` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
-- T-11-661 예전 칼럼 값을 그대로 옮긴다(옮기지 않으면 모든 구단주가 다음 방문 때 진행도를 다시 센다).
INSERT INTO `owner_title_metrics` (`profile_id`, `criteria_version`, `metrics_json`, `updated_at`)
SELECT `profile_id`, `criteria_version`, json_object('preseason', `preseason`, 'midfield', `midfield`, 'defense', `defense`, 'keeper', `keeper`, 'scorers', `scorers`, 'creators', `creators`, 'internationals', `internationals`, 'retired', `retired`, 'elite', `elite`, 'ballon', `ballon`, 'numbers', `numbers`, 'firsts', `firsts`, 'exchanges', `exchanges`, 'forwards', `forwards`, 'positions', `positions`, 'nations', `nations`, 'cups', `cups`, 'podiums', `podiums`, 'seasons', `seasons`, 'division', `division`, 'enhanceTries', `enhance_tries`, 'enhanceKeeps', `enhance_keeps`, 'enhanceDowns', `enhance_downs`, 'enhanceNear', `enhance_near`, 'enhanceSpent', `enhance_spent`), `updated_at` FROM `owner_title_progress`;
