-- Drizzle custom migration: queue state changes and token cleanup keep token-free results atomically.
--> statement-breakpoint
INSERT OR IGNORE INTO app_meta (key, value) VALUES ('push_tracking_started_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
--> statement-breakpoint
INSERT OR IGNORE INTO push_results (id, notification_id, state, accepted_at, confirmed_at, updated_at) SELECT id, push_deliveries.notification_id, state, CASE WHEN state IN ('accepted','checking','confirmed') THEN updated_at END, CASE WHEN state = 'confirmed' THEN updated_at END, updated_at FROM push_deliveries WHERE push_deliveries.notification_id IS NOT NULL;
--> statement-breakpoint
CREATE TRIGGER push_deliveries_result_insert AFTER INSERT ON push_deliveries
WHEN NEW.notification_id IS NOT NULL
BEGIN
  INSERT INTO push_results (id, notification_id, state, accepted_at, confirmed_at, updated_at)
  VALUES (NEW.id, NEW.notification_id, NEW.state,
    CASE WHEN NEW.state IN ('accepted','checking','confirmed') THEN NEW.updated_at END,
    CASE WHEN NEW.state = 'confirmed' THEN NEW.updated_at END, NEW.updated_at)
  ON CONFLICT(id) DO UPDATE SET state = excluded.state,
    accepted_at = COALESCE(push_results.accepted_at, excluded.accepted_at),
    confirmed_at = COALESCE(push_results.confirmed_at, excluded.confirmed_at), updated_at = excluded.updated_at;
END;
--> statement-breakpoint
CREATE TRIGGER push_deliveries_result_update AFTER UPDATE ON push_deliveries
WHEN NEW.notification_id IS NOT NULL
BEGIN
  INSERT INTO push_results (id, notification_id, state, accepted_at, confirmed_at, updated_at)
  VALUES (NEW.id, NEW.notification_id, NEW.state,
    CASE WHEN NEW.state IN ('accepted','checking','confirmed') THEN NEW.updated_at END,
    CASE WHEN NEW.state = 'confirmed' THEN NEW.updated_at END, NEW.updated_at)
  ON CONFLICT(id) DO UPDATE SET state = excluded.state,
    accepted_at = COALESCE(push_results.accepted_at, excluded.accepted_at),
    confirmed_at = COALESCE(push_results.confirmed_at, excluded.confirmed_at), updated_at = excluded.updated_at;
END;
--> statement-breakpoint
CREATE TRIGGER push_deliveries_result_delete AFTER DELETE ON push_deliveries
BEGIN
  UPDATE push_results SET state = CASE
    WHEN state IN ('sending','accepted','checking') THEN 'unknown'
    WHEN state = 'pending' THEN 'cancelled' ELSE state END
  WHERE id = OLD.id;
END;
--> statement-breakpoint
INSERT OR IGNORE INTO push_results (id, notification_id, state, accepted_at, confirmed_at, updated_at) SELECT id, (SELECT id FROM notifications WHERE profile_id = push_news_deliveries.profile_id AND source_key = 'news:' || push_news_deliveries.event_id), state, CASE WHEN state IN ('accepted','checking','confirmed') THEN updated_at END, CASE WHEN state = 'confirmed' THEN updated_at END, updated_at FROM push_news_deliveries WHERE (SELECT id FROM notifications WHERE profile_id = push_news_deliveries.profile_id AND source_key = 'news:' || push_news_deliveries.event_id) IS NOT NULL;
--> statement-breakpoint
CREATE TRIGGER push_news_deliveries_result_insert AFTER INSERT ON push_news_deliveries
WHEN (SELECT id FROM notifications WHERE profile_id = NEW.profile_id AND source_key = 'news:' || NEW.event_id) IS NOT NULL
BEGIN
  INSERT INTO push_results (id, notification_id, state, accepted_at, confirmed_at, updated_at)
  VALUES (NEW.id, (SELECT id FROM notifications WHERE profile_id = NEW.profile_id AND source_key = 'news:' || NEW.event_id), NEW.state,
    CASE WHEN NEW.state IN ('accepted','checking','confirmed') THEN NEW.updated_at END,
    CASE WHEN NEW.state = 'confirmed' THEN NEW.updated_at END, NEW.updated_at)
  ON CONFLICT(id) DO UPDATE SET state = excluded.state,
    accepted_at = COALESCE(push_results.accepted_at, excluded.accepted_at),
    confirmed_at = COALESCE(push_results.confirmed_at, excluded.confirmed_at), updated_at = excluded.updated_at;
END;
--> statement-breakpoint
CREATE TRIGGER push_news_deliveries_result_update AFTER UPDATE ON push_news_deliveries
WHEN (SELECT id FROM notifications WHERE profile_id = NEW.profile_id AND source_key = 'news:' || NEW.event_id) IS NOT NULL
BEGIN
  INSERT INTO push_results (id, notification_id, state, accepted_at, confirmed_at, updated_at)
  VALUES (NEW.id, (SELECT id FROM notifications WHERE profile_id = NEW.profile_id AND source_key = 'news:' || NEW.event_id), NEW.state,
    CASE WHEN NEW.state IN ('accepted','checking','confirmed') THEN NEW.updated_at END,
    CASE WHEN NEW.state = 'confirmed' THEN NEW.updated_at END, NEW.updated_at)
  ON CONFLICT(id) DO UPDATE SET state = excluded.state,
    accepted_at = COALESCE(push_results.accepted_at, excluded.accepted_at),
    confirmed_at = COALESCE(push_results.confirmed_at, excluded.confirmed_at), updated_at = excluded.updated_at;
END;
--> statement-breakpoint
CREATE TRIGGER push_news_deliveries_result_delete AFTER DELETE ON push_news_deliveries
BEGIN
  UPDATE push_results SET state = CASE
    WHEN state IN ('sending','accepted','checking') THEN 'unknown'
    WHEN state = 'pending' THEN 'cancelled' ELSE state END
  WHERE id = OLD.id;
END;
