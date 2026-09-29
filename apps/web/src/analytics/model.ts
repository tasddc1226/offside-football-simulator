/** GA4 wire data is built here from allowlists; never spread a GameState into an event. */
export type Params = Record<string, string | number | boolean>;
export type Career = {
  cid: string;
  pos: string;
  trait: string;
  bal?: { v: number };
  career: unknown[];
  retired: boolean;
};
export const CONSENT_KEY = 'offside_analytics_consent_v1';
export const LEDGER_KEY = 'offside_analytics_ledger_v1';
export type Consent = 'granted' | 'denied' | 'unknown';
export const PAGES: Record<string, string> = {
  home: 'home',
  create: 'create',
  game: 'game',
  retired: 'retired',
  owner: 'owner',
  hof: 'hof',
  shared: 'shared_career',
  settings: 'settings',
  legend: 'legend',
  team: 'team',
  board: 'board',
  dex: 'dex',
  firsts: 'firsts',
};
const CAMPAIGNS: Record<string, readonly string[]> = {
  utm_source: [
    'threads',
    'instagram',
    'geeknews',
    'dcinside',
    'humoruniv',
    'fmkorea',
    'naver',
    'okky',
    'disquiet',
    'dreamboat',
  ],
  utm_medium: ['social', 'community'],
  utm_campaign: ['launch', 'retirement_share'],
  utm_content: ['career', 'retirement', 'feedback', 'update', 'day5'],
};
export function campaignQuery(href: string): string {
  const safe = new URLSearchParams();
  try {
    const raw = new URL(href).searchParams;
    for (const [key, values] of Object.entries(CAMPAIGNS)) {
      const v = raw.get(key);
      if (v && values.includes(v)) safe.set(key, v);
    }
  } catch {
    /* Invalid locations are never forwarded. */
  }
  const q = safe.toString();
  return q ? `?${q}` : '';
}
export function safeReferrer(raw: string): string {
  try {
    const url = new URL(raw);
    // Only known public sources; drop paths, account subdomains, tokens and search terms.
    const hosts = [
      'threads.com',
      'threads.net',
      'instagram.com',
      'google.com',
      'google.co.kr',
      'naver.com',
      'news.hada.io',
      'gall.dcinside.com',
      'humoruniv.com',
      'fmkorea.com',
      'okky.kr',
      'disquiet.io',
      'dreamboat.kr',
    ];
    return hosts.find(
      (h) => url.hostname === h || url.hostname === `www.${h}` || url.hostname === `m.${h}`,
    )
      ? `https://${url.hostname.replace(/^(www|m)\./, '')}/`
      : '';
  } catch {
    return '';
  }
}
export function gameParams(s: Career): Params {
  return {
    position: ['FW', 'MF', 'DF', 'GK'].includes(s.pos) ? s.pos : 'unknown',
    player_trait: ['early', 'late', 'iron', 'star'].includes(s.trait) ? s.trait : 'unknown',
    balance_version: Number.isSafeInteger(s.bal?.v) && s.bal!.v >= 0 ? s.bal!.v : 'unknown',
  };
}
export function seasonBucket(n: number): string {
  return n <= 0 ? '0' : n === 1 ? '1' : n <= 5 ? '2-5' : n <= 10 ? '6-10' : '11+';
}
export type Entry = { id: string; at: number; start?: boolean; first?: boolean; retire?: boolean };
export type Ledger = {
  entries: Entry[];
  seenStart: boolean;
  next:
    | null
    | { kind: 'replace_active' }
    | { kind: 'after_retirement'; id: string; pos: string; trait: string };
};
export const emptyLedger = (): Ledger => ({ entries: [], seenStart: false, next: null });
export function prune(ledger: Ledger, now: number, active: string | null): Ledger {
  ledger.entries = ledger.entries
    .filter((e) => e.id === active || e.at >= now - 30 * 86400000)
    .sort((a, b) => b.at - a.at);
  const current = ledger.entries.find((e) => e.id === active);
  ledger.entries = ledger.entries.filter((e) => e.id !== active).slice(0, 200);
  if (current) ledger.entries.unshift(current);
  const next = ledger.next;
  if (next?.kind === 'after_retirement' && !ledger.entries.some((e) => e.id === next.id))
    ledger.next = null;
  return ledger;
}
