CREATE TABLE `team_lineup_cards` (
	`team_id` text NOT NULL,
	`slot` integer NOT NULL,
	`career_id` text NOT NULL,
	PRIMARY KEY(`team_id`, `slot`),
	FOREIGN KEY (`team_id`) REFERENCES `owner_teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `team_lineup_cards_career_idx` ON `team_lineup_cards` (`career_id`,`team_id`);
--> statement-breakpoint
INSERT INTO team_lineup_cards (team_id, slot, career_id) SELECT t.id, CAST(j.key AS INTEGER), j.value FROM owner_teams t, json_each(t.slots_json) j WHERE j.type = 'text';
--> statement-breakpoint
UPDATE owner_teams SET lineup_value_open = (SELECT coalesce(sum(coalesce(c.card_value, 10000)), 0)
    FROM team_lineup_cards s JOIN cards c ON c.career_id = s.career_id
    LEFT JOIN careers r ON r.id = c.career_id
    WHERE s.team_id = owner_teams.id AND c.service_season <= owner_teams.season
      AND coalesce(r.hidden, 0) = 0 AND c.owner_id = owner_teams.profile_id AND c.manager = 0), lineup_value_closed = (SELECT coalesce(sum(coalesce(c.card_value, 10000)), 0)
    FROM team_lineup_cards s JOIN cards c ON c.career_id = s.career_id
    LEFT JOIN careers r ON r.id = c.career_id
    WHERE s.team_id = owner_teams.id AND c.service_season <= owner_teams.season
      AND coalesce(r.hidden, 0) = 0) WHERE 1;
--> statement-breakpoint
CREATE TRIGGER lineup_team_insert AFTER INSERT ON owner_teams BEGIN
 DELETE FROM team_lineup_cards WHERE team_id = NEW.id;
 INSERT INTO team_lineup_cards (team_id, slot, career_id) SELECT NEW.id, CAST(j.key AS INTEGER), j.value FROM json_each(NEW.slots_json) j WHERE j.type = 'text';
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
CREATE TRIGGER lineup_team_update AFTER UPDATE OF slots_json, season, profile_id ON owner_teams BEGIN
 DELETE FROM team_lineup_cards WHERE team_id = NEW.id;
 INSERT INTO team_lineup_cards (team_id, slot, career_id) SELECT NEW.id, CAST(j.key AS INTEGER), j.value FROM json_each(NEW.slots_json) j WHERE j.type = 'text';
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
CREATE TRIGGER lineup_cards_insert AFTER INSERT ON cards BEGIN
 UPDATE owner_teams SET lineup_value_open = (SELECT coalesce(sum(coalesce(c.card_value, 10000)), 0)
    FROM team_lineup_cards s JOIN cards c ON c.career_id = s.career_id
    LEFT JOIN careers r ON r.id = c.career_id
    WHERE s.team_id = owner_teams.id AND c.service_season <= owner_teams.season
      AND coalesce(r.hidden, 0) = 0 AND c.owner_id = owner_teams.profile_id AND c.manager = 0), lineup_value_closed = (SELECT coalesce(sum(coalesce(c.card_value, 10000)), 0)
    FROM team_lineup_cards s JOIN cards c ON c.career_id = s.career_id
    LEFT JOIN careers r ON r.id = c.career_id
    WHERE s.team_id = owner_teams.id AND c.service_season <= owner_teams.season
      AND coalesce(r.hidden, 0) = 0) WHERE id IN (SELECT team_id FROM team_lineup_cards WHERE career_id = NEW.career_id);
END;
--> statement-breakpoint
CREATE TRIGGER lineup_cards_update AFTER UPDATE OF owner_id, manager, card_value, service_season ON cards BEGIN
 UPDATE owner_teams SET lineup_value_open = (SELECT coalesce(sum(coalesce(c.card_value, 10000)), 0)
    FROM team_lineup_cards s JOIN cards c ON c.career_id = s.career_id
    LEFT JOIN careers r ON r.id = c.career_id
    WHERE s.team_id = owner_teams.id AND c.service_season <= owner_teams.season
      AND coalesce(r.hidden, 0) = 0 AND c.owner_id = owner_teams.profile_id AND c.manager = 0), lineup_value_closed = (SELECT coalesce(sum(coalesce(c.card_value, 10000)), 0)
    FROM team_lineup_cards s JOIN cards c ON c.career_id = s.career_id
    LEFT JOIN careers r ON r.id = c.career_id
    WHERE s.team_id = owner_teams.id AND c.service_season <= owner_teams.season
      AND coalesce(r.hidden, 0) = 0) WHERE id IN (SELECT team_id FROM team_lineup_cards WHERE career_id = NEW.career_id);
END;
--> statement-breakpoint
CREATE TRIGGER lineup_cards_delete AFTER DELETE ON cards BEGIN
 UPDATE owner_teams SET lineup_value_open = (SELECT coalesce(sum(coalesce(c.card_value, 10000)), 0)
    FROM team_lineup_cards s JOIN cards c ON c.career_id = s.career_id
    LEFT JOIN careers r ON r.id = c.career_id
    WHERE s.team_id = owner_teams.id AND c.service_season <= owner_teams.season
      AND coalesce(r.hidden, 0) = 0 AND c.owner_id = owner_teams.profile_id AND c.manager = 0), lineup_value_closed = (SELECT coalesce(sum(coalesce(c.card_value, 10000)), 0)
    FROM team_lineup_cards s JOIN cards c ON c.career_id = s.career_id
    LEFT JOIN careers r ON r.id = c.career_id
    WHERE s.team_id = owner_teams.id AND c.service_season <= owner_teams.season
      AND coalesce(r.hidden, 0) = 0) WHERE id IN (SELECT team_id FROM team_lineup_cards WHERE career_id = OLD.career_id);
END;
--> statement-breakpoint
CREATE TRIGGER lineup_careers_insert AFTER INSERT ON careers BEGIN
 UPDATE owner_teams SET lineup_value_open = (SELECT coalesce(sum(coalesce(c.card_value, 10000)), 0)
    FROM team_lineup_cards s JOIN cards c ON c.career_id = s.career_id
    LEFT JOIN careers r ON r.id = c.career_id
    WHERE s.team_id = owner_teams.id AND c.service_season <= owner_teams.season
      AND coalesce(r.hidden, 0) = 0 AND c.owner_id = owner_teams.profile_id AND c.manager = 0), lineup_value_closed = (SELECT coalesce(sum(coalesce(c.card_value, 10000)), 0)
    FROM team_lineup_cards s JOIN cards c ON c.career_id = s.career_id
    LEFT JOIN careers r ON r.id = c.career_id
    WHERE s.team_id = owner_teams.id AND c.service_season <= owner_teams.season
      AND coalesce(r.hidden, 0) = 0) WHERE id IN (SELECT team_id FROM team_lineup_cards WHERE career_id = NEW.id);
END;
--> statement-breakpoint
CREATE TRIGGER lineup_careers_update AFTER UPDATE OF hidden ON careers BEGIN
 UPDATE owner_teams SET lineup_value_open = (SELECT coalesce(sum(coalesce(c.card_value, 10000)), 0)
    FROM team_lineup_cards s JOIN cards c ON c.career_id = s.career_id
    LEFT JOIN careers r ON r.id = c.career_id
    WHERE s.team_id = owner_teams.id AND c.service_season <= owner_teams.season
      AND coalesce(r.hidden, 0) = 0 AND c.owner_id = owner_teams.profile_id AND c.manager = 0), lineup_value_closed = (SELECT coalesce(sum(coalesce(c.card_value, 10000)), 0)
    FROM team_lineup_cards s JOIN cards c ON c.career_id = s.career_id
    LEFT JOIN careers r ON r.id = c.career_id
    WHERE s.team_id = owner_teams.id AND c.service_season <= owner_teams.season
      AND coalesce(r.hidden, 0) = 0) WHERE id IN (SELECT team_id FROM team_lineup_cards WHERE career_id = NEW.id);
END;
--> statement-breakpoint
CREATE TRIGGER lineup_careers_delete AFTER DELETE ON careers BEGIN
 UPDATE owner_teams SET lineup_value_open = (SELECT coalesce(sum(coalesce(c.card_value, 10000)), 0)
    FROM team_lineup_cards s JOIN cards c ON c.career_id = s.career_id
    LEFT JOIN careers r ON r.id = c.career_id
    WHERE s.team_id = owner_teams.id AND c.service_season <= owner_teams.season
      AND coalesce(r.hidden, 0) = 0 AND c.owner_id = owner_teams.profile_id AND c.manager = 0), lineup_value_closed = (SELECT coalesce(sum(coalesce(c.card_value, 10000)), 0)
    FROM team_lineup_cards s JOIN cards c ON c.career_id = s.career_id
    LEFT JOIN careers r ON r.id = c.career_id
    WHERE s.team_id = owner_teams.id AND c.service_season <= owner_teams.season
      AND coalesce(r.hidden, 0) = 0) WHERE id IN (SELECT team_id FROM team_lineup_cards WHERE career_id = OLD.id);
END;
