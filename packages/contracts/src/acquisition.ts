export const CAMPAIGNS: Record<string, readonly string[]> = {
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
    // T-11-195 해외 유입 메타 광고(페이스북·인스타그램).
    'meta',
    'facebook',
    // T-11-423 아마축구(아마추어 축구팀 운영 서비스) 상호 홈 팝업 협업.
    'amachuggu',
  ],
  utm_medium: ['social', 'community', 'paid', 'partner'],
  utm_campaign: ['launch', 'retirement_share', 'season1_launch', 'global_test', 'amachuggu_collab'],
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
    // T-11-195 메타 광고 소재: 국가(jp·uk·us) + 소재 글자.
    'jp_a',
    'jp_b',
    'jp_c',
    'uk_a',
    'uk_b',
    'uk_c',
    'us_a',
    'us_b',
    'us_c',
    // T-11-423 아마축구 바텀시트 팝업 소재 A(선수 뽑기)·B(평행세계).
    'bs_a',
    'bs_b',
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

/** First-party policy, independent of Apple's campaign attribution. */
export const ACQUISITION_WINDOW_MS = 30 * 86400_000;
export const ACQUISITION_CONSENT_VERSION = 'account-acquisition-v1';
export const ACQUISITION_SESSION_MS = 30 * 60_000;
