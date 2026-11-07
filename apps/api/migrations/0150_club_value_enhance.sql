-- T-11-650 구단 가치 랭킹(선발 가치)에 카드 강화 가치를 더한다. 0138 트리거를 같은 모양으로 다시 만들고, 카드의 enhance가 바뀔 때도 다시 센다.
-- 강화 가치 숫자는 @offside/contracts/card-enhance enhanceValueSql과 같다(routes/teams.test.ts가 맞춰 본다).
DROP TRIGGER IF EXISTS lineup_team_insert;
--> statement-breakpoint
DROP TRIGGER IF EXISTS lineup_team_update;
--> statement-breakpoint
DROP TRIGGER IF EXISTS lineup_cards_insert;
--> statement-breakpoint
DROP TRIGGER IF EXISTS lineup_cards_update;
--> statement-breakpoint
DROP TRIGGER IF EXISTS lineup_cards_delete;
--> statement-breakpoint
DROP TRIGGER IF EXISTS lineup_careers_insert;
--> statement-breakpoint
DROP TRIGGER IF EXISTS lineup_careers_update;
--> statement-breakpoint
DROP TRIGGER IF EXISTS lineup_careers_delete;
--> statement-breakpoint
CREATE TRIGGER lineup_team_insert AFTER INSERT ON owner_teams BEGIN
 DELETE FROM team_lineup_cards WHERE team_id = NEW.id;
 INSERT INTO team_lineup_cards (team_id, slot, career_id) SELECT NEW.id, CAST(j.key AS INTEGER), j.value FROM json_each(NEW.slots_json) j WHERE j.type = 'text';
 UPDATE owner_teams SET lineup_value_open = (SELECT coalesce(sum(coalesce(c.card_value, 10000) + CASE c.enhance WHEN 1 THEN 55600 WHEN 2 THEN 192600 WHEN 3 THEN 548800 WHEN 4 THEN 1445300 WHEN 5 THEN 3709600 WHEN 6 THEN 8521100 WHEN 7 THEN 18332500 WHEN 8 THEN 41414500 WHEN 9 THEN 112578400 WHEN 10 THEN 304906200 ELSE 0 END), 0)
    FROM team_lineup_cards s JOIN cards c ON c.career_id = s.career_id
    LEFT JOIN careers r ON r.id = c.career_id
    WHERE s.team_id = owner_teams.id AND c.service_season <= owner_teams.season
      AND coalesce(r.hidden, 0) = 0 AND c.owner_id = owner_teams.profile_id AND c.manager = 0), lineup_value_closed = (SELECT coalesce(sum(coalesce(c.card_value, 10000) + CASE c.enhance WHEN 1 THEN 55600 WHEN 2 THEN 192600 WHEN 3 THEN 548800 WHEN 4 THEN 1445300 WHEN 5 THEN 3709600 WHEN 6 THEN 8521100 WHEN 7 THEN 18332500 WHEN 8 THEN 41414500 WHEN 9 THEN 112578400 WHEN 10 THEN 304906200 ELSE 0 END), 0)
    FROM team_lineup_cards s JOIN cards c ON c.career_id = s.career_id
    LEFT JOIN careers r ON r.id = c.career_id
    WHERE s.team_id = owner_teams.id AND c.service_season <= owner_teams.season
      AND coalesce(r.hidden, 0) = 0) WHERE id = NEW.id;
END;
--> statement-breakpoint
CREATE TRIGGER lineup_team_update AFTER UPDATE OF slots_json, season, profile_id ON owner_teams BEGIN
 DELETE FROM team_lineup_cards WHERE team_id = NEW.id;
 INSERT INTO team_lineup_cards (team_id, slot, career_id) SELECT NEW.id, CAST(j.key AS INTEGER), j.value FROM json_each(NEW.slots_json) j WHERE j.type = 'text';
 UPDATE owner_teams SET lineup_value_open = (SELECT coalesce(sum(coalesce(c.card_value, 10000) + CASE c.enhance WHEN 1 THEN 55600 WHEN 2 THEN 192600 WHEN 3 THEN 548800 WHEN 4 THEN 1445300 WHEN 5 THEN 3709600 WHEN 6 THEN 8521100 WHEN 7 THEN 18332500 WHEN 8 THEN 41414500 WHEN 9 THEN 112578400 WHEN 10 THEN 304906200 ELSE 0 END), 0)
    FROM team_lineup_cards s JOIN cards c ON c.career_id = s.career_id
    LEFT JOIN careers r ON r.id = c.career_id
    WHERE s.team_id = owner_teams.id AND c.service_season <= owner_teams.season
      AND coalesce(r.hidden, 0) = 0 AND c.owner_id = owner_teams.profile_id AND c.manager = 0), lineup_value_closed = (SELECT coalesce(sum(coalesce(c.card_value, 10000) + CASE c.enhance WHEN 1 THEN 55600 WHEN 2 THEN 192600 WHEN 3 THEN 548800 WHEN 4 THEN 1445300 WHEN 5 THEN 3709600 WHEN 6 THEN 8521100 WHEN 7 THEN 18332500 WHEN 8 THEN 41414500 WHEN 9 THEN 112578400 WHEN 10 THEN 304906200 ELSE 0 END), 0)
    FROM team_lineup_cards s JOIN cards c ON c.career_id = s.career_id
    LEFT JOIN careers r ON r.id = c.career_id
    WHERE s.team_id = owner_teams.id AND c.service_season <= owner_teams.season
      AND coalesce(r.hidden, 0) = 0) WHERE id = NEW.id;
END;
--> statement-breakpoint
CREATE TRIGGER lineup_cards_insert AFTER INSERT ON cards BEGIN
 UPDATE owner_teams SET lineup_value_open = (SELECT coalesce(sum(coalesce(c.card_value, 10000) + CASE c.enhance WHEN 1 THEN 55600 WHEN 2 THEN 192600 WHEN 3 THEN 548800 WHEN 4 THEN 1445300 WHEN 5 THEN 3709600 WHEN 6 THEN 8521100 WHEN 7 THEN 18332500 WHEN 8 THEN 41414500 WHEN 9 THEN 112578400 WHEN 10 THEN 304906200 ELSE 0 END), 0)
    FROM team_lineup_cards s JOIN cards c ON c.career_id = s.career_id
    LEFT JOIN careers r ON r.id = c.career_id
    WHERE s.team_id = owner_teams.id AND c.service_season <= owner_teams.season
      AND coalesce(r.hidden, 0) = 0 AND c.owner_id = owner_teams.profile_id AND c.manager = 0), lineup_value_closed = (SELECT coalesce(sum(coalesce(c.card_value, 10000) + CASE c.enhance WHEN 1 THEN 55600 WHEN 2 THEN 192600 WHEN 3 THEN 548800 WHEN 4 THEN 1445300 WHEN 5 THEN 3709600 WHEN 6 THEN 8521100 WHEN 7 THEN 18332500 WHEN 8 THEN 41414500 WHEN 9 THEN 112578400 WHEN 10 THEN 304906200 ELSE 0 END), 0)
    FROM team_lineup_cards s JOIN cards c ON c.career_id = s.career_id
    LEFT JOIN careers r ON r.id = c.career_id
    WHERE s.team_id = owner_teams.id AND c.service_season <= owner_teams.season
      AND coalesce(r.hidden, 0) = 0) WHERE id IN (SELECT team_id FROM team_lineup_cards WHERE career_id = NEW.career_id);
END;
--> statement-breakpoint
CREATE TRIGGER lineup_cards_update AFTER UPDATE OF owner_id, manager, card_value, service_season, enhance ON cards BEGIN
 UPDATE owner_teams SET lineup_value_open = (SELECT coalesce(sum(coalesce(c.card_value, 10000) + CASE c.enhance WHEN 1 THEN 55600 WHEN 2 THEN 192600 WHEN 3 THEN 548800 WHEN 4 THEN 1445300 WHEN 5 THEN 3709600 WHEN 6 THEN 8521100 WHEN 7 THEN 18332500 WHEN 8 THEN 41414500 WHEN 9 THEN 112578400 WHEN 10 THEN 304906200 ELSE 0 END), 0)
    FROM team_lineup_cards s JOIN cards c ON c.career_id = s.career_id
    LEFT JOIN careers r ON r.id = c.career_id
    WHERE s.team_id = owner_teams.id AND c.service_season <= owner_teams.season
      AND coalesce(r.hidden, 0) = 0 AND c.owner_id = owner_teams.profile_id AND c.manager = 0), lineup_value_closed = (SELECT coalesce(sum(coalesce(c.card_value, 10000) + CASE c.enhance WHEN 1 THEN 55600 WHEN 2 THEN 192600 WHEN 3 THEN 548800 WHEN 4 THEN 1445300 WHEN 5 THEN 3709600 WHEN 6 THEN 8521100 WHEN 7 THEN 18332500 WHEN 8 THEN 41414500 WHEN 9 THEN 112578400 WHEN 10 THEN 304906200 ELSE 0 END), 0)
    FROM team_lineup_cards s JOIN cards c ON c.career_id = s.career_id
    LEFT JOIN careers r ON r.id = c.career_id
    WHERE s.team_id = owner_teams.id AND c.service_season <= owner_teams.season
      AND coalesce(r.hidden, 0) = 0) WHERE id IN (SELECT team_id FROM team_lineup_cards WHERE career_id = NEW.career_id);
END;
--> statement-breakpoint
CREATE TRIGGER lineup_cards_delete AFTER DELETE ON cards BEGIN
 UPDATE owner_teams SET lineup_value_open = (SELECT coalesce(sum(coalesce(c.card_value, 10000) + CASE c.enhance WHEN 1 THEN 55600 WHEN 2 THEN 192600 WHEN 3 THEN 548800 WHEN 4 THEN 1445300 WHEN 5 THEN 3709600 WHEN 6 THEN 8521100 WHEN 7 THEN 18332500 WHEN 8 THEN 41414500 WHEN 9 THEN 112578400 WHEN 10 THEN 304906200 ELSE 0 END), 0)
    FROM team_lineup_cards s JOIN cards c ON c.career_id = s.career_id
    LEFT JOIN careers r ON r.id = c.career_id
    WHERE s.team_id = owner_teams.id AND c.service_season <= owner_teams.season
      AND coalesce(r.hidden, 0) = 0 AND c.owner_id = owner_teams.profile_id AND c.manager = 0), lineup_value_closed = (SELECT coalesce(sum(coalesce(c.card_value, 10000) + CASE c.enhance WHEN 1 THEN 55600 WHEN 2 THEN 192600 WHEN 3 THEN 548800 WHEN 4 THEN 1445300 WHEN 5 THEN 3709600 WHEN 6 THEN 8521100 WHEN 7 THEN 18332500 WHEN 8 THEN 41414500 WHEN 9 THEN 112578400 WHEN 10 THEN 304906200 ELSE 0 END), 0)
    FROM team_lineup_cards s JOIN cards c ON c.career_id = s.career_id
    LEFT JOIN careers r ON r.id = c.career_id
    WHERE s.team_id = owner_teams.id AND c.service_season <= owner_teams.season
      AND coalesce(r.hidden, 0) = 0) WHERE id IN (SELECT team_id FROM team_lineup_cards WHERE career_id = OLD.career_id);
END;
--> statement-breakpoint
CREATE TRIGGER lineup_careers_insert AFTER INSERT ON careers BEGIN
 UPDATE owner_teams SET lineup_value_open = (SELECT coalesce(sum(coalesce(c.card_value, 10000) + CASE c.enhance WHEN 1 THEN 55600 WHEN 2 THEN 192600 WHEN 3 THEN 548800 WHEN 4 THEN 1445300 WHEN 5 THEN 3709600 WHEN 6 THEN 8521100 WHEN 7 THEN 18332500 WHEN 8 THEN 41414500 WHEN 9 THEN 112578400 WHEN 10 THEN 304906200 ELSE 0 END), 0)
    FROM team_lineup_cards s JOIN cards c ON c.career_id = s.career_id
    LEFT JOIN careers r ON r.id = c.career_id
    WHERE s.team_id = owner_teams.id AND c.service_season <= owner_teams.season
      AND coalesce(r.hidden, 0) = 0 AND c.owner_id = owner_teams.profile_id AND c.manager = 0), lineup_value_closed = (SELECT coalesce(sum(coalesce(c.card_value, 10000) + CASE c.enhance WHEN 1 THEN 55600 WHEN 2 THEN 192600 WHEN 3 THEN 548800 WHEN 4 THEN 1445300 WHEN 5 THEN 3709600 WHEN 6 THEN 8521100 WHEN 7 THEN 18332500 WHEN 8 THEN 41414500 WHEN 9 THEN 112578400 WHEN 10 THEN 304906200 ELSE 0 END), 0)
    FROM team_lineup_cards s JOIN cards c ON c.career_id = s.career_id
    LEFT JOIN careers r ON r.id = c.career_id
    WHERE s.team_id = owner_teams.id AND c.service_season <= owner_teams.season
      AND coalesce(r.hidden, 0) = 0) WHERE id IN (SELECT team_id FROM team_lineup_cards WHERE career_id = NEW.id);
END;
--> statement-breakpoint
CREATE TRIGGER lineup_careers_update AFTER UPDATE OF hidden ON careers BEGIN
 UPDATE owner_teams SET lineup_value_open = (SELECT coalesce(sum(coalesce(c.card_value, 10000) + CASE c.enhance WHEN 1 THEN 55600 WHEN 2 THEN 192600 WHEN 3 THEN 548800 WHEN 4 THEN 1445300 WHEN 5 THEN 3709600 WHEN 6 THEN 8521100 WHEN 7 THEN 18332500 WHEN 8 THEN 41414500 WHEN 9 THEN 112578400 WHEN 10 THEN 304906200 ELSE 0 END), 0)
    FROM team_lineup_cards s JOIN cards c ON c.career_id = s.career_id
    LEFT JOIN careers r ON r.id = c.career_id
    WHERE s.team_id = owner_teams.id AND c.service_season <= owner_teams.season
      AND coalesce(r.hidden, 0) = 0 AND c.owner_id = owner_teams.profile_id AND c.manager = 0), lineup_value_closed = (SELECT coalesce(sum(coalesce(c.card_value, 10000) + CASE c.enhance WHEN 1 THEN 55600 WHEN 2 THEN 192600 WHEN 3 THEN 548800 WHEN 4 THEN 1445300 WHEN 5 THEN 3709600 WHEN 6 THEN 8521100 WHEN 7 THEN 18332500 WHEN 8 THEN 41414500 WHEN 9 THEN 112578400 WHEN 10 THEN 304906200 ELSE 0 END), 0)
    FROM team_lineup_cards s JOIN cards c ON c.career_id = s.career_id
    LEFT JOIN careers r ON r.id = c.career_id
    WHERE s.team_id = owner_teams.id AND c.service_season <= owner_teams.season
      AND coalesce(r.hidden, 0) = 0) WHERE id IN (SELECT team_id FROM team_lineup_cards WHERE career_id = NEW.id);
END;
--> statement-breakpoint
CREATE TRIGGER lineup_careers_delete AFTER DELETE ON careers BEGIN
 UPDATE owner_teams SET lineup_value_open = (SELECT coalesce(sum(coalesce(c.card_value, 10000) + CASE c.enhance WHEN 1 THEN 55600 WHEN 2 THEN 192600 WHEN 3 THEN 548800 WHEN 4 THEN 1445300 WHEN 5 THEN 3709600 WHEN 6 THEN 8521100 WHEN 7 THEN 18332500 WHEN 8 THEN 41414500 WHEN 9 THEN 112578400 WHEN 10 THEN 304906200 ELSE 0 END), 0)
    FROM team_lineup_cards s JOIN cards c ON c.career_id = s.career_id
    LEFT JOIN careers r ON r.id = c.career_id
    WHERE s.team_id = owner_teams.id AND c.service_season <= owner_teams.season
      AND coalesce(r.hidden, 0) = 0 AND c.owner_id = owner_teams.profile_id AND c.manager = 0), lineup_value_closed = (SELECT coalesce(sum(coalesce(c.card_value, 10000) + CASE c.enhance WHEN 1 THEN 55600 WHEN 2 THEN 192600 WHEN 3 THEN 548800 WHEN 4 THEN 1445300 WHEN 5 THEN 3709600 WHEN 6 THEN 8521100 WHEN 7 THEN 18332500 WHEN 8 THEN 41414500 WHEN 9 THEN 112578400 WHEN 10 THEN 304906200 ELSE 0 END), 0)
    FROM team_lineup_cards s JOIN cards c ON c.career_id = s.career_id
    LEFT JOIN careers r ON r.id = c.career_id
    WHERE s.team_id = owner_teams.id AND c.service_season <= owner_teams.season
      AND coalesce(r.hidden, 0) = 0) WHERE id IN (SELECT team_id FROM team_lineup_cards WHERE career_id = OLD.id);
END;
--> statement-breakpoint
UPDATE owner_teams SET lineup_value_open = (SELECT coalesce(sum(coalesce(c.card_value, 10000) + CASE c.enhance WHEN 1 THEN 55600 WHEN 2 THEN 192600 WHEN 3 THEN 548800 WHEN 4 THEN 1445300 WHEN 5 THEN 3709600 WHEN 6 THEN 8521100 WHEN 7 THEN 18332500 WHEN 8 THEN 41414500 WHEN 9 THEN 112578400 WHEN 10 THEN 304906200 ELSE 0 END), 0)
    FROM team_lineup_cards s JOIN cards c ON c.career_id = s.career_id
    LEFT JOIN careers r ON r.id = c.career_id
    WHERE s.team_id = owner_teams.id AND c.service_season <= owner_teams.season
      AND coalesce(r.hidden, 0) = 0 AND c.owner_id = owner_teams.profile_id AND c.manager = 0), lineup_value_closed = (SELECT coalesce(sum(coalesce(c.card_value, 10000) + CASE c.enhance WHEN 1 THEN 55600 WHEN 2 THEN 192600 WHEN 3 THEN 548800 WHEN 4 THEN 1445300 WHEN 5 THEN 3709600 WHEN 6 THEN 8521100 WHEN 7 THEN 18332500 WHEN 8 THEN 41414500 WHEN 9 THEN 112578400 WHEN 10 THEN 304906200 ELSE 0 END), 0)
    FROM team_lineup_cards s JOIN cards c ON c.career_id = s.career_id
    LEFT JOIN careers r ON r.id = c.career_id
    WHERE s.team_id = owner_teams.id AND c.service_season <= owner_teams.season
      AND coalesce(r.hidden, 0) = 0) WHERE 1;
