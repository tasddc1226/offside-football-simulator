CREATE TABLE `owner_fund_ledger` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`profile_id` text NOT NULL,
	`kind` text NOT NULL,
	`delta` integer NOT NULL,
	`balance` integer NOT NULL,
	`ref` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `owner_fund_ledger_profile_idx` ON `owner_fund_ledger` (`profile_id`,`id`);--> statement-breakpoint
-- T-11-660 기록을 시작하는 잔액(opening). 이 뒤의 변화는 거래마다 한 줄씩 쌓인다.
INSERT INTO `owner_fund_ledger` (`profile_id`, `kind`, `delta`, `balance`, `ref`, `created_at`)
SELECT `profile_id`, 'opening', `balance`, `balance`, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM `owner_funds`;
