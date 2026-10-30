CREATE TABLE `card_enhance_log` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`career_id` text NOT NULL,
	`request_key` text NOT NULL,
	`from_level` integer NOT NULL,
	`to_level` integer NOT NULL,
	`fails` integer NOT NULL,
	`success` integer NOT NULL,
	`rate_bp` integer NOT NULL,
	`roll` integer NOT NULL,
	`cost` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `card_enhance_log_request_unique` ON `card_enhance_log` (`profile_id`,`request_key`);--> statement-breakpoint
CREATE INDEX `card_enhance_log_profile_idx` ON `card_enhance_log` (`profile_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `cards` ADD `enhance` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `cards` ADD `enhance_fails` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `cards` ADD `enhance_starts` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `cards` ADD `enhance_used` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `team_lineup_cards` ADD `since` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
-- T-11-373 카드 강화 시도권: 카드가 구단주 팀 선발로 뛴 랭크 경기 수. team_lineup_cards.since(선발에 들어온 때의 팀 경기 수)를
-- 두고, 선발에서 빠지면 그동안의 경기 수를 cards.enhance_starts에 쌓는다. 선발에 남은 카드는 자리를 옮겨도 since를 지킨다(새 줄을
-- slot + 100에 넣고 옛 줄을 지운 뒤 자리를 되돌린다). 지금 선발은 이 배포 때부터 센다.
UPDATE team_lineup_cards SET since = (SELECT t.wins + t.draws + t.losses FROM owner_teams t WHERE t.id = team_lineup_cards.team_id);
--> statement-breakpoint
DROP TRIGGER lineup_team_insert;
--> statement-breakpoint
DROP TRIGGER lineup_team_update;
--> statement-breakpoint
CREATE TRIGGER lineup_team_insert AFTER INSERT ON owner_teams BEGIN
 DELETE FROM team_lineup_cards WHERE team_id = NEW.id;
 INSERT INTO team_lineup_cards (team_id, slot, career_id, since) SELECT NEW.id, CAST(j.key AS INTEGER), j.value, (NEW.wins + NEW.draws + NEW.losses) FROM json_each(NEW.slots_json) j WHERE j.type = 'text';
 UPDATE owner_teams SET lineup_value_open = (SELECT coalesce(sum(coalesce(c.card_value, 10000)), 0)
    FROM team_lineup_cards s JOIN cards c ON c.career_id = s.career_id
    LEFT JOIN careers r ON r.id = c.career_id
    WHERE s.team_id = owner_teams.id AND c.service_season <= owner_teams.season
      AND coalesce(r.hidden, 0) = 0 AND c.owner_id = owner_teams.profile_id AND c.manager = 0), lineup_value_closed = (SELECT coalesce(sum(coalesce(c.card_value, 10000)), 0)
    FROM team_lineup_cards s JOIN cards c ON c.career_id = s.career_id
    LEFT JOIN careers r ON r.id = c.career_id
    WHERE s.team_id = owner_teams.id AND c.service_season <= owner_teams.season
      AND coalesce(r.hidden, 0) = 0) WHERE id = NEW.id;
END;
--> statement-breakpoint
CREATE TRIGGER lineup_team_update AFTER UPDATE OF slots_json, season, profile_id ON owner_teams
 WHEN OLD.slots_json IS NOT NEW.slots_json OR OLD.season IS NOT NEW.season OR OLD.profile_id IS NOT NEW.profile_id BEGIN
 UPDATE cards SET enhance_starts = enhance_starts + (OLD.wins + OLD.draws + OLD.losses)
     - (SELECT max(s.since) FROM team_lineup_cards s WHERE s.team_id = NEW.id AND s.career_id = cards.career_id)
   WHERE owner_id = OLD.profile_id
     AND career_id IN (SELECT career_id FROM team_lineup_cards WHERE team_id = NEW.id)
     AND career_id NOT IN (SELECT j.value FROM json_each(NEW.slots_json) j WHERE j.type = 'text');
 INSERT INTO team_lineup_cards (team_id, slot, career_id, since)
   SELECT NEW.id, CAST(j.key AS INTEGER) + 100, j.value,
          coalesce((SELECT max(s.since) FROM team_lineup_cards s
                     WHERE s.team_id = NEW.id AND s.career_id = j.value AND s.slot < 100), (NEW.wins + NEW.draws + NEW.losses))
     FROM json_each(NEW.slots_json) j WHERE j.type = 'text';
 DELETE FROM team_lineup_cards WHERE team_id = NEW.id AND slot < 100;
 UPDATE team_lineup_cards SET slot = slot - 100 WHERE team_id = NEW.id;
 UPDATE owner_teams SET lineup_value_open = (SELECT coalesce(sum(coalesce(c.card_value, 10000)), 0)
    FROM team_lineup_cards s JOIN cards c ON c.career_id = s.career_id
    LEFT JOIN careers r ON r.id = c.career_id
    WHERE s.team_id = owner_teams.id AND c.service_season <= owner_teams.season
      AND coalesce(r.hidden, 0) = 0 AND c.owner_id = owner_teams.profile_id AND c.manager = 0), lineup_value_closed = (SELECT coalesce(sum(coalesce(c.card_value, 10000)), 0)
    FROM team_lineup_cards s JOIN cards c ON c.career_id = s.career_id
    LEFT JOIN careers r ON r.id = c.career_id
    WHERE s.team_id = owner_teams.id AND c.service_season <= owner_teams.season
      AND coalesce(r.hidden, 0) = 0) WHERE id = NEW.id;
END;
--> statement-breakpoint
CREATE TRIGGER enhance_cards_owner AFTER UPDATE OF owner_id ON cards WHEN OLD.owner_id IS NOT NEW.owner_id
  AND EXISTS (SELECT 1 FROM team_lineup_cards WHERE career_id = NEW.career_id) BEGIN
 UPDATE cards SET enhance_starts = enhance_starts + coalesce((SELECT sum(t.wins + t.draws + t.losses - s.since)
     FROM team_lineup_cards s JOIN owner_teams t ON t.id = s.team_id
     WHERE s.career_id = NEW.career_id AND t.profile_id = OLD.owner_id), 0)
   WHERE career_id = NEW.career_id;
 UPDATE team_lineup_cards SET since = (SELECT t.wins + t.draws + t.losses FROM owner_teams t WHERE t.id = team_lineup_cards.team_id)
   WHERE career_id = NEW.career_id;
END;
