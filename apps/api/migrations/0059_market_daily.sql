CREATE TABLE `market_daily` (
	`season` integer NOT NULL,
	`pos_group` text NOT NULL,
	`ovr_band` integer NOT NULL,
	`day` text NOT NULL,
	`trades` integer NOT NULL,
	`volume` integer NOT NULL,
	`ratio_sum` integer NOT NULL,
	`ratio_min` integer NOT NULL,
	`ratio_max` integer NOT NULL,
	PRIMARY KEY(`season`, `pos_group`, `ovr_band`, `day`)
);
--> statement-breakpoint
-- T-11-080e 집계를 시작하기 전에 성사된 거래를 채운다(buyListing의 UPSERT와 같은 계산).
INSERT INTO `market_daily` (`season`, `pos_group`, `ovr_band`, `day`, `trades`, `volume`, `ratio_sum`, `ratio_min`, `ratio_max`)
SELECT `season`, `pos`, `band`, `day`, count(*), sum(`price`), sum(`r`), min(`r`), max(`r`)
FROM (
  SELECT l.`season`, c.`pos`, (c.`peak` / 5) * 5 AS `band`, date(l.`closed_at`, '+9 hours') AS `day`, l.`price`,
         CAST(round(l.`price` * 1000.0 / c.`card_value`) AS INTEGER) AS `r`
  FROM `market_listings` l JOIN `cards` c ON c.`career_id` = l.`career_id`
  WHERE l.`status` = 'sold' AND c.`card_value` > 0
)
GROUP BY `season`, `pos`, `band`, `day`;
