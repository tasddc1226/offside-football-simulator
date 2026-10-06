CREATE INDEX `careers_wall_of_honor_idx` ON `careers` (coalesce("service_season", 0)) WHERE "careers"."wall_of_honor_json" is not null;
