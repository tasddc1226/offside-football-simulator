ALTER TABLE `owner_teams` ADD `division` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- T-11-375 기존 팀은 레이팅 구간 그대로(강등 보호 없이) 채운다. 경계는 밸런스 기본값(teamDiv1~7)과 같다.
UPDATE `owner_teams` SET `division` = (`rating` >= 950) + (`rating` >= 1000) + (`rating` >= 1050) + (`rating` >= 1100) + (`rating` >= 1175) + (`rating` >= 1250) + (`rating` >= 1350);
