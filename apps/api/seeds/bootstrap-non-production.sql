INSERT INTO service_seasons (id, name, status, starts_at, ends_at, ruleset_version, content_pack_version, challenge_set_id)
VALUES ('svc_kickoff', 'Kickoff', 'ACTIVE', '2026-09-01T00:00:00Z', '2026-12-31T23:59:59Z', '1.0.0', '0.1.0', 'cs_kickoff')
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  status = excluded.status,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  ruleset_version = excluded.ruleset_version,
  content_pack_version = excluded.content_pack_version,
  challenge_set_id = excluded.challenge_set_id;
