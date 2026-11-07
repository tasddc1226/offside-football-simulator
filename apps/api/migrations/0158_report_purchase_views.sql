CREATE VIEW `report_feed` AS SELECT 'name' AS source, kind AS target_kind, target_id, profile_id AS reporter_id, NULL AS reason,
    name AS label, NULL AS room, created_at, resolved_at FROM name_reports
  UNION ALL SELECT 'chat', 'message', message_id, profile_id, reason, nickname, room, created_at, resolved_at
    FROM chat_reports
  UNION ALL SELECT 'board_comment', 'comment', comment_id, profile_id, reason, NULL, NULL, created_at, NULL
    FROM board_comment_reports
  UNION ALL SELECT 'team_comment', 'comment', comment_id, profile_id, reason, NULL, NULL, created_at, NULL
    FROM team_comment_reports;--> statement-breakpoint
CREATE VIEW `store_purchase_ledger` AS SELECT 'item' AS ledger, store, transaction_id, profile_id, product_id, test, created_at, purchased_at,
    price_milliunits, currency, storefront, refunded_at, first_touch_id, last_touch_id FROM iap_purchases
  UNION ALL SELECT 'ad_free', store, transaction_id, profile_id, product_id, test, created_at, purchased_at,
    price_milliunits, currency, storefront, refunded_at, first_touch_id, last_touch_id FROM iap_ad_free_purchases;