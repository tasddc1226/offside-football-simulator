/** GA4 wire data is built here from allowlists; never spread a GameState into an event. */
export type Params = Record<string, string | number | boolean>;
export type Career = {
  cid: string;
  year?: number;
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
  honors: 'owner_honors',
  hof: 'hof',
  shared: 'shared_career',
  settings: 'settings',
  legend: 'legend',
  team: 'team',
  market: 'market',
  board: 'board',
  dex: 'dex',
  firsts: 'firsts',
  chat: 'chat',
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
  utm_campaign: ['launch', 'retirement_share', 'season1_launch'],
  utm_content: [
    'career',
    'retirement',
    'feedback',
    'update',
    'day5',
    's1_story_01',
    's1_story_02',
    's1_choice_01',
    's1_choice_02',
    's1_update_01',
    's1_update_02',
    's1_bio',
    's1_ig_story_01',
  ],
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
export type Entry = {
  id: string;
  at: number;
  start?: boolean;
  first?: boolean;
  action?: boolean;
  milestones?: number[];
  lastActionAt?: number;
  retire?: boolean;
};
export type Ledger = {
  entries: Entry[];
  seenStart: boolean;
  next:
    | null
    | { kind: 'replace_active' }
    | { kind: 'after_retirement'; id: string; pos: string; trait: string };
};
export const emptyLedger = (): Ledger => ({ entries: [], seenStart: false, next: null });
/** Stored consent (web localStorage / native MMKV); anything else is unknown. */
export const parseConsent = (v: unknown): Consent =>
  v === 'granted' || v === 'denied' ? v : 'unknown';
/** Stored ledger (web localStorage / native MMKV); malformed data starts over, a bad `next` is dropped. */
export function parseLedger(raw: string | null | undefined): Ledger {
  if (!raw) return emptyLedger();
  try {
    const value = JSON.parse(raw) as Ledger;
    if (
      !value ||
      !Array.isArray(value.entries) ||
      typeof value.seenStart !== 'boolean' ||
      !value.entries.every((e) => e && typeof e.id === 'string' && Number.isFinite(e.at))
    )
      return emptyLedger();
    if (
      value.next &&
      value.next.kind !== 'replace_active' &&
      !(
        value.next.kind === 'after_retirement' &&
        typeof value.next.id === 'string' &&
        typeof value.next.pos === 'string' &&
        typeof value.next.trait === 'string'
      )
    )
      value.next = null;
    return value;
  } catch {
    return emptyLedger();
  }
}
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
