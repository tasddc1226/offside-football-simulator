UPDATE `league_matches` SET `at` = strftime('%Y-%m-%dT%H:%M:%fZ', `at`, s.plus)
FROM (
  SELECT id,
    CASE WHEN round = (SELECT MAX(round) FROM league_matches x WHERE x.season = m.season) THEN '+8 hours'
      ELSE CASE (slot + round - 1) % COUNT(*) OVER (PARTITION BY season, tier, league_no, round) % 4
        WHEN 0 THEN '+0 hours' WHEN 1 THEN '+3 hours' WHEN 2 THEN '+6 hours' ELSE '+8 hours' END
    END AS plus
  FROM league_matches m
  WHERE played_at IS NULL
) AS s
WHERE `league_matches`.`id` = s.id AND `league_matches`.`played_at` IS NULL AND `league_matches`.`at` > strftime('%Y-%m-%dT%H:%M:%fZ', 'now');
