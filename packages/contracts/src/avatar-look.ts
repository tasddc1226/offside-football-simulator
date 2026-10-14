/** Cosmetic wire values only. Keep codes/options stable; no game state or RNG dependencies. */
export const APPEARANCE_OPTIONS = {
  s: 6,
  h: 13,
  d: 3,
  y: 15,
  e: 3,
  a: 9,
  w: 7,
  g: 7,
  b: 11,
  k: 8,
} as const;

export const LOOK_RECORDS = [
  { id: 'scorer-boots', item: 'boots', value: 10, titles: ['topscorer'] },
  { id: 'champ-band', item: 'band', value: 8, titles: ['champion'] },
  { id: 'nation-wrist', item: 'wrist', value: 6, titles: ['ntdebut', 'ntdebutx'] },
  { id: 'bigear-goggle', item: 'glasses', value: 6, titles: ['bigear'] },
  { id: 'ballon-hair', item: 'hair', value: 12, titles: ['ballon'] },
  { id: 'worldcup-socks', item: 'socks', value: 7, titles: ['worldchamp'] },
] as const;

const RECORD_CODES = {
  boots: 'b',
  band: 'a',
  wrist: 'w',
  glasses: 'g',
  hair: 'h',
  socks: 'k',
} as const;

/** null restores the ID-derived default. Reject unknown, repeated or out-of-range values. */
export function validAppearance(code: string | null): boolean {
  if (code === null) return true;
  if (!/^(?:[a-z](?:0|[1-9]\d?)){1,10}$/.test(code)) return false;
  const seen = new Set<string>();
  for (const [, key, digits] of code.matchAll(/([a-z])(\d+)/g)) {
    const limit = APPEARANCE_OPTIONS[key as keyof typeof APPEARANCE_OPTIONS];
    if (limit === undefined || Number(digits) >= limit || seen.has(key!)) return false;
    seen.add(key!);
  }
  return true;
}

/** A record item needs a stored title. Previously worn legacy items may stay worn. */
export function appearanceUnlocked(
  code: string | null,
  current: string | null,
  titles: readonly string[],
): boolean {
  const picks = Object.fromEntries(
    Array.from((code ?? '').matchAll(/([a-z])(\d+)/g), (m) => [m[1], Number(m[2])]),
  );
  const old = Object.fromEntries(
    Array.from((current ?? '').matchAll(/([a-z])(\d+)/g), (m) => [m[1], Number(m[2])]),
  );
  return LOOK_RECORDS.every((r) => {
    const key = RECORD_CODES[r.item];
    return (
      picks[key] !== r.value || old[key] === r.value || r.titles.some((id) => titles.includes(id))
    );
  });
}
