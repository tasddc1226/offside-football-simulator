CREATE TABLE `firsts_repairs` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`work` integer DEFAULT 0 NOT NULL,
	`season` integer NOT NULL,
	`kind` text NOT NULL,
	`id` text NOT NULL,
	`cursor` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `firsts_repairs_slot_idx` ON `firsts_repairs` (`season`,`kind`,`id`);--> statement-breakpoint
CREATE INDEX `firsts_repairs_order_idx` ON `firsts_repairs` (`work`,`seq`);--> statement-breakpoint
CREATE INDEX `firsts_repairs_page_idx` ON `firsts_repairs` (`season`,`cursor`,`work`,`seq`);--> statement-breakpoint
ALTER TABLE `careers` ADD `firsts_revision` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `careers_firsts_season_idx` ON `careers` (coalesce("service_season", 0)) WHERE "careers"."hidden" = 0;
--> statement-breakpoint
DROP TRIGGER legend_first_lost;

--> statement-breakpoint
DROP TRIGGER legend_record_lost;

--> statement-breakpoint
DROP TRIGGER legend_eligibility_changed;

--> statement-breakpoint
INSERT INTO firsts_repairs(season,kind,id) SELECT CAST(substr(key,length('legend_repair:')+1) AS INTEGER),'legacy','legend'
 FROM app_meta WHERE key >= 'legend_repair:' AND key < 'legend_repair;';

--> statement-breakpoint
DELETE FROM app_meta WHERE key >= 'legend_repair:' AND key < 'legend_repair;';

--> statement-breakpoint
CREATE TRIGGER firsts_lost_first AFTER DELETE ON server_firsts BEGIN
  INSERT INTO firsts_repairs(work,season,kind,id) VALUES(CASE WHEN OLD.id GLOB 'legend*' OR OLD.id='retirecap' THEN 0 ELSE 2 END,OLD.season,'first',OLD.id)
  ON CONFLICT(season,kind,id) DO UPDATE SET seq=excluded.seq, cursor=0;
END;

--> statement-breakpoint
CREATE TRIGGER firsts_lost_record AFTER DELETE ON server_records BEGIN
  INSERT INTO firsts_repairs(work,season,kind,id) VALUES(CASE WHEN OLD.id GLOB 'legend*' OR OLD.id='retirecap' THEN 0 ELSE 2 END,OLD.season,'record',OLD.id)
  ON CONFLICT(season,kind,id) DO UPDATE SET seq=excluded.seq, cursor=0;
END;
