-- A holder leaving (including a profile deletion's FK cascade) schedules one repair per season.
CREATE TRIGGER legend_first_lost AFTER DELETE ON server_firsts
WHEN OLD.id GLOB 'legend[0-9]*' BEGIN
  INSERT INTO app_meta(key,value) VALUES ('legend_repair:' || OLD.season, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    ON CONFLICT(key) DO NOTHING;
END;
--> statement-breakpoint
CREATE TRIGGER legend_record_lost AFTER DELETE ON server_records
WHEN OLD.id = 'legend' BEGIN
  INSERT INTO app_meta(key,value) VALUES ('legend_repair:' || OLD.season, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    ON CONFLICT(key) DO NOTHING;
END;
--> statement-breakpoint
-- An unhidden or rescored retiree can change the winner without deleting a ledger row.
CREATE TRIGGER legend_eligibility_changed AFTER UPDATE OF hidden, legend_score ON careers
WHEN OLD.status = 'retired' AND NEW.hidden = 0 AND
  (OLD.hidden IS NOT NEW.hidden OR OLD.legend_score IS NOT NEW.legend_score) BEGIN
  INSERT INTO app_meta(key,value) VALUES ('legend_repair:' || coalesce(NEW.service_season,0), strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    ON CONFLICT(key) DO NOTHING;
END;
--> statement-breakpoint
-- Season 2 already has a missing milestone and a stale high score before this migration.
INSERT INTO app_meta(key,value) VALUES ('legend_repair:2','0') ON CONFLICT(key) DO NOTHING;
