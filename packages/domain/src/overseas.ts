import type { CareerState } from './types.js';
import type { Ruleset, Team } from './ruleset.js';

/** Immutable geography of WORLD_JOURNEY_V1, also used by archive evidence without live content. */
export const WORLD_CLUBS: Readonly<Record<string, string>> = Object.freeze({
  'osaka-harbor': 'JP',
  'yokohama-blue': 'JP',
  'porto-atlantico': 'PT',
  'lisboa-estrela': 'PT',
  'london-riverside': 'GB',
  'manchester-foundry': 'GB',
  'valencia-sol': 'ES',
  'sevilla-luz': 'ES',
  'rhein-adler': 'DE',
  'berlin-unionist': 'DE',
  'torino-stella': 'IT',
  'napoli-mare': 'IT',
  'lyon-lumiere': 'FR',
  'marseille-port': 'FR',
});
export const WORLD_COUNTRIES: Readonly<Record<string, string>> = Object.freeze({
  JP: '일본',
  PT: '포르투갈',
  GB: '잉글랜드',
  ES: '스페인',
  DE: '독일',
  IT: '이탈리아',
  FR: '프랑스',
});
export function overseasRecord(state: CareerState) {
  const played = state.seasonHistory.filter((s) => s.result.playerStats.minutes > 0);
  const foreign = played.filter((s) => WORLD_CLUBS[s.teamId] !== undefined);
  const established = foreign.filter((s) => s.result.playerStats.minutes >= 450);
  const bridge = established.filter((s) => WORLD_CLUBS[s.teamId] === 'PT');
  const big = established.filter((s) => !['JP', 'PT'].includes(WORLD_CLUBS[s.teamId]!));
  const countries = [...new Set(foreign.map((s) => WORLD_CLUBS[s.teamId]!))];
  const returned =
    foreign.length > 0 &&
    played.at(-1) !== undefined &&
    WORLD_CLUBS[played.at(-1)!.teamId] === undefined &&
    played.at(-1)!.index > foreign.at(-1)!.index;
  return {
    foreignSeasons: foreign.length,
    establishedSeasons: established.length,
    bridgeSeasons: bridge.length,
    bigSeasons: big.length,
    countries,
    returned,
  };
}

/** Scouting requires completed seasons and minutes, never merely a narrative tag. */
export function canScoutOverseas(state: CareerState, team: Team, ruleset: Ruleset): boolean {
  if (team.countryCode === undefined || team.countryCode === 'KR') return true;
  if (state.seasonHistory.length < 2 || !state.tags.includes('해외_도전')) return false;
  if (!ruleset.overseasRules) return true;
  const record = overseasRecord(state);
  if (team.countryCode === 'JP') return true;
  if (team.countryCode === 'PT') return record.establishedSeasons >= 1;
  return record.bridgeSeasons >= 1 && record.establishedSeasons >= 2;
}

export function overseasJourney(state: CareerState) {
  const record = overseasRecord(state);
  const country = WORLD_CLUBS[state.contract?.teamId ?? ''];
  const stage =
    country === undefined
      ? '국내'
      : country === 'JP'
        ? '첫 해외 무대'
        : country === 'PT'
          ? '유럽 교두보'
          : '빅리그';
  const next = !state.tags.includes('해외_도전')
    ? '에이전트와 해외 도전을 선택하면 스카우트가 움직입니다.'
    : state.seasonHistory.length < 2
      ? '국내에서 2시즌을 마치면 일본 구단의 평가가 열립니다.'
      : record.establishedSeasons < 1
        ? '해외 한 시즌 450분을 뛰면 포르투갈 스카우트가 열립니다.'
        : record.bridgeSeasons < 1 || record.establishedSeasons < 2
          ? '해외 2시즌에서 각각 450분 출전하고, 그중 한 시즌을 포르투갈에서 보내면 빅리그 평가가 열립니다.'
          : '빅리그 스카우트 조건 충족. 시장 가치와 구단 수요에 따라 제안이 도착합니다.';
  return { ...record, stage, country: country ? WORLD_COUNTRIES[country] : '대한민국', next };
}
