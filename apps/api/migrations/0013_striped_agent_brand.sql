CREATE TABLE `competition_challenge_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`day_key` text NOT NULL,
	`week_key` text NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`ruleset_version` text NOT NULL,
	`content_pack_version` text NOT NULL,
	`scoring_policy_version` text NOT NULL,
	`scenario_json` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `competition_challenge_versions_day_unique` ON `competition_challenge_versions` (`day_key`);--> statement-breakpoint
CREATE TABLE `competition_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`challenge_version_id` text NOT NULL,
	`owner_profile_id` text NOT NULL,
	`request_key_hash` text NOT NULL,
	`request_hash` text NOT NULL,
	`action_ids_json` text NOT NULL,
	`result_json` text NOT NULL,
	`result_hash` text NOT NULL,
	`score` integer NOT NULL,
	`max_score` integer NOT NULL,
	`verification_status` text NOT NULL,
	`public_opt_in` integer DEFAULT 0 NOT NULL,
	`public_alias` text NOT NULL,
	`submitted_at` text NOT NULL,
	FOREIGN KEY (`challenge_version_id`) REFERENCES `competition_challenge_versions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `competition_entries_request_key_hash_unique` ON `competition_entries` (`request_key_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `competition_entries_profile_challenge_unique` ON `competition_entries` (`owner_profile_id`,`challenge_version_id`);--> statement-breakpoint
CREATE INDEX `competition_entries_challenge_public_idx` ON `competition_entries` (`challenge_version_id`,`verification_status`,`public_opt_in`,`score`);--> statement-breakpoint
INSERT INTO `competition_challenge_versions` (`id`,`day_key`,`week_key`,`starts_at`,`ends_at`,`ruleset_version`,`content_pack_version`,`scoring_policy_version`,`scenario_json`,`created_at`) VALUES ('daily-2026-09-21','2026-09-21','2026-09-21','2026-09-20T15:00:00.000Z','2026-09-21T15:00:00.000Z','3.3.0','0.12.0','SUM_ACTION_POINTS_V1','{"title":"오늘의 경기 운영","intro":"동점으로 맞선 후반, 세 번의 판단으로 팀의 흐름을 바꿔 보세요.","steps":[{"id":"opening","title":"첫 압박","prompt":"상대가 후방에서 공을 돌립니다. 첫 대응은?","choices":[{"id":"PRESS","label":"전방 압박","description":"수비 라인을 올려 선택지를 줄입니다.","points":35,"outcome":"상대의 전개를 늦췄습니다."},{"id":"HOLD","label":"대형 유지","description":"간격을 지키며 다음 장면을 기다립니다.","points":25,"outcome":"팀 간격이 안정적으로 유지됐습니다."},{"id":"COUNTER","label":"역습 대기","description":"공을 되찾는 즉시 빈 공간을 노립니다.","points":30,"outcome":"빠른 전환 기회를 준비했습니다."}]},{"id":"chance","title":"결정적 기회","prompt":"측면에서 낮은 크로스가 들어옵니다. 어떻게 마무리할까요?","choices":[{"id":"FIRST_TOUCH","label":"첫 터치 슈팅","description":"망설임 없이 바로 마무리합니다.","points":40,"outcome":"수비가 정렬하기 전에 슈팅했습니다."},{"id":"CUTBACK","label":"뒤로 내주기","description":"동료가 달려오는 위치로 공을 돌립니다.","points":30,"outcome":"더 좋은 각도의 동료를 찾았습니다."},{"id":"RECYCLE","label":"공 소유 유지","description":"무리하지 않고 공격을 다시 만듭니다.","points":20,"outcome":"공을 지키며 다음 공격을 설계했습니다."}]},{"id":"closing","title":"마지막 수비","prompt":"경기 종료 직전 상대가 마지막 공격을 시작합니다. 지시는?","choices":[{"id":"COMPACT","label":"중앙 봉쇄","description":"위험 지역을 먼저 닫습니다.","points":35,"outcome":"중앙 침투를 차단했습니다."},{"id":"STEP","label":"한 발 전진","description":"오프사이드 라인을 맞춰 전진합니다.","points":30,"outcome":"공간을 줄였지만 타이밍이 필요했습니다."},{"id":"WIDE","label":"측면 유도","description":"상대를 바깥으로 몰아냅니다.","points":25,"outcome":"위험한 패스를 측면으로 돌렸습니다."}]}],"scorePolicy":{"version":"SUM_ACTION_POINTS_V1","description":"각 장면에서 선택한 서버 고정 점수를 합산합니다. 시간 보너스와 확률은 사용하지 않습니다."}}','2026-09-21T00:00:00.000Z');
