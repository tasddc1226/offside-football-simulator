ALTER TABLE `cards` ADD `public_name` text;--> statement-breakpoint
-- T-11-548 이 수정 전에 변경권만 빠지고 이름이 붙지 않은 카드(키운 사람이 계정을 지운 카드)에 마지막으로 고른 이름을 붙인다.
UPDATE `cards` SET `public_name` = (
  SELECT r.`new_name` FROM `career_renames` r WHERE r.`career_id` = `cards`.`career_id`
  ORDER BY r.`created_at` DESC LIMIT 1
) WHERE `career_id` IN (
  SELECT r.`career_id` FROM `career_renames` r
  WHERE NOT EXISTS (SELECT 1 FROM `careers` c WHERE c.`id` = r.`career_id`)
);
