import type { LegacyEndingId } from './endings.js';
import type { LegacyBandId } from './score.js';

export type LegacyEndingPresentation = Readonly<{
  title: string;
  sentence: string;
}>;

export type LegacyBandPresentation = Readonly<{
  label: string;
}>;

const endingCatalog: Record<LegacyEndingId, LegacyEndingPresentation> = Object.assign(
  Object.create(null) as Record<LegacyEndingId, LegacyEndingPresentation>,
  {
    'END-ONE-CLUB-LEGEND': Object.freeze({
      title: '원클럽 레전드',
      sentence: '한 구단의 유니폼만 입고 라인을 지켰다',
    }),
    'END-NATIONAL-HERO': Object.freeze({
      title: '대표팀 영웅',
      sentence: '국가의 라인 위에서 가장 빛났다',
    }),
    'END-UNCROWNED-KING': Object.freeze({
      title: '무관의 제왕',
      sentence: '트로피는 없었지만 누구도 그를 빼고 팀을 말하지 않았다',
    }),
    'END-DERBY-HERO': Object.freeze({
      title: '더비의 영웅',
      sentence: '그 도시의 절반은 아직도 그 골을 이야기한다',
    }),
    'END-PROMOTION-CAPTAIN': Object.freeze({
      title: '승격 주장',
      sentence: '올라가는 팀에는 늘 그가 완장을 차고 있었다',
    }),
    'END-LOAN-LEGEND': Object.freeze({
      title: '임대 신화',
      sentence: '빌려 간 팀이 돌려주기 싫어한 선수',
    }),
    'END-COMEBACK-PLAYER': Object.freeze({
      title: '부상 복귀 선수',
      sentence: '의사가 말한 날짜보다 늦게, 그러나 확실하게 돌아왔다',
    }),
    'END-IRONMAN': Object.freeze({
      title: '철인',
      sentence: '라인업에서 그의 이름을 지운 감독은 없었다',
    }),
    'END-PLAYER-COACH': Object.freeze({
      title: '선수 겸 코치',
      sentence: '마지막 시즌은 벤치 옆에서 시작됐다',
    }),
    'END-MENTOR': Object.freeze({
      title: '유망주 멘토',
      sentence: '그가 키운 선수들이 그의 기록을 넘었다',
    }),
    'END-LATE-BLOOMER': Object.freeze({
      title: '대기만성',
      sentence: '남들보다 늦게 라인을 넘었지만 가장 멀리 갔다',
    }),
    'END-JOURNEYMAN': Object.freeze({
      title: '저니맨',
      sentence: '여섯 개의 도시가 그를 기억한다',
    }),
    'END-CONTROVERSIAL-STAR': Object.freeze({
      title: '논쟁적 스타',
      sentence: '사랑받지는 못했지만 잊히지도 않았다',
    }),
    'END-COMPLETE-SHORT': Object.freeze({
      title: '짧았지만 완결된 커리어',
      sentence: '라인을 넘지 못한 날도 그의 축구였다',
    }),
  } satisfies Record<LegacyEndingId, LegacyEndingPresentation>,
);

const bandCatalog: Record<LegacyBandId, LegacyBandPresentation> = Object.assign(
  Object.create(null) as Record<LegacyBandId, LegacyBandPresentation>,
  {
    'BAND-LEGEND': Object.freeze({ label: '전설' }),
    'BAND-ICON': Object.freeze({ label: '레전드' }),
    'BAND-REMEMBERED': Object.freeze({ label: '기억되는 커리어' }),
    'BAND-SOLID': Object.freeze({ label: '견실한 커리어' }),
    'BAND-COMPLETE': Object.freeze({ label: '짧았지만 완결된 커리어' }),
  } satisfies Record<LegacyBandId, LegacyBandPresentation>,
);

export const LEGACY_ENDING_PRESENTATIONS = Object.freeze(endingCatalog);
export const LEGACY_BAND_PRESENTATIONS = Object.freeze(bandCatalog);

export function legacyEndingPresentation(id: string): LegacyEndingPresentation {
  if (!Object.prototype.hasOwnProperty.call(LEGACY_ENDING_PRESENTATIONS, id)) {
    throw new RangeError('Unknown Legacy ending ID.');
  }
  return LEGACY_ENDING_PRESENTATIONS[id as LegacyEndingId];
}

export function legacyBandPresentation(id: string): LegacyBandPresentation {
  if (!Object.prototype.hasOwnProperty.call(LEGACY_BAND_PRESENTATIONS, id)) {
    throw new RangeError('Unknown Legacy band ID.');
  }
  return LEGACY_BAND_PRESENTATIONS[id as LegacyBandId];
}
