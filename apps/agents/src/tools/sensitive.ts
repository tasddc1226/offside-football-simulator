// T-11-803 에이전트가 운영 D1에서 읽지 못하는 열. 모델이 쓴 SQL이 이 열을 이름으로 적거나(`p.email`, `"email"` 포함),
// 이 열이 있는 표를 `*` · `표.*`로 읽으면 보내기 전에 거절한다. 결과가 Claude API로 넘어가므로 계정 · 로그인 · 결제 식별자와
// 비밀값, 닉네임은 아예 읽지 않는다. 표 · 열 이름은 apps/api/src/db/schema.ts와 같아야 한다(sensitive.test.ts가 비교한다).

/** 표(보기 포함) → 읽지 못하는 열. */
export const SENSITIVE_COLUMNS: Readonly<Record<string, readonly string[]>> = {
  profiles: [
    'email',
    'google_sub',
    'apple_sub',
    'recovery_code_hash',
    'toss_anon_key_hash',
    'nickname',
    'friend_code',
  ],
  sessions: ['token_hash'],
  app_auth_tickets: ['id', 'challenge', 'code_verifier', 'google_sub', 'google_email'],
  idempotency: ['response_body'],
  push_devices: ['token'],
  push_deliveries: ['token'],
  push_news_deliveries: ['token'],
  iap_purchases: ['transaction_id'],
  iap_ad_free_purchases: ['transaction_id'],
  iap_refund_markers: ['transaction_id'],
  season_passes: ['transaction_id'],
  starter_packs: ['transaction_id'],
  store_purchase_ledger: ['transaction_id'],
  memberships: ['chain_id'],
  web_pay_orders: ['xsolla_order_id'],
  board_comments: ['nickname'],
  team_comments: ['nickname'],
  board_blocks: ['nickname'],
  chat_reports: ['nickname'],
  report_feed: ['label'],
  // T-11-802 의견 보내기: 방침에 '운영자만 봅니다'라고 적었으니 원문과 원문 해시는 에이전트가 읽지 않는다(건수 · 종류 집계는 된다).
  user_voices: ['body', 'body_key'],
};

/**
 * 따옴표(' " ` [ ])만 공백으로 바꾸고 안의 글자도 낱말로 센다. SQLite는 FROM 자리의 '표'를 식별자로 받고, 식별자 따옴표 안의
 * ' 때문에 문자열 경계를 잘못 잡으면 막힌 열이 지워지므로 문자열 · 식별자를 가리지 않는다. 그래서 `LIKE '%nickname%'`처럼
 * 문자열에 막힌 열 이름이 들어간 쿼리도 막힌다(과잉 차단은 받아들인다).
 */
function words(sql: string): { text: string; set: Set<string> } {
  const text = sql.replace(/['"`[\]]/g, ' ').toLowerCase();
  return { text, set: new Set(text.match(/[a-z_][a-z0-9_$]*/g) ?? []) };
}

/** 거절할 때 대신 쓸 열 안내. */
const HINT: Readonly<Record<string, string>> = {
  profiles: '. 로그인 연결 수는 linked_at · apple_linked_at으로 세요',
};

/** 열 목록을 `*`로 펼치는 자리(`SELECT *`, `, *`, `표.*`). COUNT(*) · 곱셈은 아니다. */
const WILDCARD = /(\bselect|\bdistinct|\ball|,)\s*\*|\.\s*\*/;

/** 막힌 열이나 그 표의 `*`가 있으면 짧은 이유와 함께 던진다. readOnlySql이 부른다. */
export function assertNoSensitive(sql: string): void {
  const { text, set } = words(sql);
  const tables = Object.keys(SENSITIVE_COLUMNS).filter((t) => set.has(t));
  for (const t of tables) {
    const col = SENSITIVE_COLUMNS[t]!.find((c) => set.has(c));
    if (col)
      throw new Error(
        `${t}.${col}은 개인 정보라 조회할 수 없어요. 이 열 없이 집계나 다른 열로 봐요${HINT[t] ?? ''}`,
      );
  }
  if (tables.length && WILDCARD.test(text))
    throw new Error(
      `${tables.join(' · ')}에는 조회할 수 없는 열이 있어요. * 대신 필요한 열 이름을 적어요`,
    );
}
