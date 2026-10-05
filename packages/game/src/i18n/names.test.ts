import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { setLocale } from '@offside/contracts/i18n';
import { CLUB_NAMES, LEAGUE_BASE } from '@offside/contracts/club-names';
import { CONFEDS, NATIONS } from '@offside/contracts/nations';
import { CONT, CUPS, POTY, TOP_SCORER } from '../comps.js';
import { PHASES } from '../data.js';
import { SANGMU } from '../military.js';
import { RIVAL } from '../nation.js';
import { STORIES } from '../story.js';
import { tn } from './names.js';
import { en } from './en/index.js';

// T-11-106 저장된 이름의 영어 대응표(en/_names.ts). 한국어에서는 그대로, 영어에서는 한글이 남지 않아야 한다.
const HANGUL = /[가-힣]/;
afterEach(() => setLocale('ko'));

/** 영어로 바꿔 한글이 남은 이름들. */
function untranslated(list: string[]): string[] {
  setLocale('en', en);
  return [...new Set(list)].filter((n) => HANGUL.test(tn(n)));
}

const srcOf = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
/** 소스에서 작은따옴표로 적은 한글 문자열 리터럴. */
const literals = (f: string) => [
  ...new Set([...srcOf(f).matchAll(/'([^'\n]*[가-힣][^'\n]*)'/g)].map((m) => m[1]!)),
];

/** comps.ts가 대륙 대회 단계로 적는 값. */
const CONT_STAGES = [
  '1라운드',
  '1라운드 탈락',
  '16강 진출',
  '리그 페이즈',
  '16강 직행',
  '녹아웃 PO',
  '녹아웃 PO 통과',
  '녹아웃 PO 탈락',
  '리그 페이즈 탈락',
  '8강 진출',
  '8강 통과',
  '8강 탈락',
  '4강 통과',
  '4강 탈락',
  '16강 탈락',
  '32강 통과',
  '32강 탈락',
  '16강 통과',
];

describe('저장된 이름 → 영어', () => {
  it('한국어에서는 그대로 돌려준다', () => {
    setLocale('ko');
    for (const n of ['프리미어리그', '프리미어리그 우승', '2026 프리시즌', '내가 지은 구단'])
      expect(tn(n)).toBe(n);
  });

  it('모든 리그·구단·상무·나라가 영어로 옮겨진다', () => {
    const clubs = Object.values(CLUB_NAMES).flat();
    expect(untranslated(LEAGUE_BASE.map((l) => l.name))).toEqual([]);
    expect(untranslated(clubs)).toEqual([]);
    expect(untranslated([SANGMU.name, '김천 상무'])).toEqual([]);
    expect(untranslated(NATIONS.map((n) => n.ko))).toEqual([]);
    setLocale('en', en);
    expect(tn('프리미어리그')).toBe('Premier League');
    expect(tn('K리그1')).toBe('K League 1');
    expect(tn('대한민국')).toBe('South Korea');
    // 두 구단이 같은 영어 이름이 되지 않는다(같은 이름의 구단은 표에서 서로 구별돼야 한다).
    const en2 = clubs.map((c) => tn(c));
    expect(new Set(en2).size).toBe(new Set(clubs).size);
  });

  it('국내 컵·대륙 대회·리그 개인상 이름이 모두 옮겨진다', () => {
    const cups = Object.values(CUPS).flat();
    const conts = Object.values(CONT).map((c) => c.name);
    const prizes = [...Object.values(TOP_SCORER), ...Object.values(POTY)];
    expect(untranslated([...cups, ...conts, ...prizes])).toEqual([]);
    // 시즌 결산이 만드는 트로피·수상·단계(`리그/컵/대륙 이름 + 접미사`)
    const leagues = LEAGUE_BASE.map((l) => l.name);
    const names = [
      ...[...leagues, ...cups, ...conts].map((n) => `${n} 우승`),
      ...leagues.flatMap((l) => [
        `${l} 도움왕`,
        `${l} 올해의 팀`,
        `${l} 베스트 11`,
        `${l} 올해의 영플레이어`,
        `${l} 올해의 수비수`,
        `${l} 올해의 골키퍼`,
        `${l} 올해의 미드필더`,
      ]),
      ...Object.values(CONFEDS).flatMap((c) => [
        c.cup,
        `${c.cup} 우승`,
        c.poty,
        c.potyAbroad ?? c.poty,
      ]),
      ...CONT_STAGES,
    ];
    expect(untranslated(names)).toEqual([]);
  });

  it('comps.ts가 적은 이름 리터럴이 전부 옮겨진다', () => {
    expect(untranslated(literals('comps.ts'))).toEqual([]);
  });

  it('스토리 이름·엔딩이 옮겨진다', () => {
    const endings = [...srcOf('stories.ts').matchAll(/endStory\(s, '\w+', '([^']+)'\)/g)].map(
      (m) => m[1]!,
    );
    expect(endings.length).toBeGreaterThan(15);
    const expire = [...srcOf('stories.ts').matchAll(/expireEnding: '([^']+)'/g)].map((m) => m[1]!);
    expect(
      untranslated([
        ...Object.values(STORIES).map((d) => d.name),
        ...endings,
        ...expire,
        '흐지부지 끝난 이야기',
      ]),
    ).toEqual([]);
  });

  it('대표팀 대회·단계·메달·병역·역할·시각 라벨이 옮겨진다', () => {
    const tours = [
      '2026 FIFA 월드컵 (미국·캐나다·멕시코)',
      '2030 FIFA 월드컵 (스페인·포르투갈·모로코)',
      '2034 FIFA 월드컵 (사우디아라비아)',
      '2038 FIFA 월드컵 (개최지 미정)',
      '2026 FIFA 월드컵',
      '2027 AFC 아시안컵 (사우디아라비아)',
      '2031 AFC 아시안컵',
      'UEFA 유로 2028 (영국·아일랜드)',
      'UEFA 유로 2032 (이탈리아·튀르키예)',
      'UEFA 유로 2036',
      '2028 코파 아메리카',
      '2027 아프리카 네이션스컵 (케냐·탄자니아·우간다)',
      '2027 CONCACAF 골드컵',
      '2028 OFC 네이션스컵',
      '2026 아시안게임 (일본 아이치·나고야)',
      '2030 아시안게임 (카타르 도하)',
      '2034 아시안게임 (사우디아라비아 리야드)',
      '2028 올림픽 남자축구 (미국 LA)',
      '2032 올림픽 남자축구 (호주 브리즈번)',
      '2036 올림픽 남자축구',
      ...Object.values(CONFEDS).map((c) => `2029 월드컵 ${c.region} 예선`),
      ...Object.values(CONFEDS).map((c) => `2027 올림픽 ${c.region} 예선`),
      '2027 올림픽 아시아 예선 (AFC U-23 아시안컵)',
      '친선 A매치',
      '9월 A매치',
      '10월 A매치',
      '11월 A매치',
      '3월 A매치',
      ...NATIONS.slice(0, 20).map((n) => `${n.ko} U-23`),
    ];
    const stages = [
      '우승',
      '준우승',
      '금메달',
      '은메달',
      '동메달',
      '4위',
      '조별리그 탈락',
      '32강',
      '16강',
      '8강',
      '4강',
      '결승',
      '본선 진출 확정',
      '본선 진출 실패',
      '동메달 결정전',
      '진행',
    ];
    const trophies = [
      'FIFA 월드컵 우승',
      '아시안게임 금메달',
      '올림픽 금메달',
      '올림픽 은메달',
      '올림픽 동메달',
      'FIFA 클럽 월드컵 우승',
      'FIFA 클럽 월드컵 8강',
    ];
    const misc = [
      ...PHASES,
      ...PHASES.map((p) => `2026 ${p}`),
      '현역 복무',
      '병역',
      '주전',
      '로테이션',
      '벤치',
      '오른발',
      '왼발',
      '양발',
      '대한축구협회 올해의 선수',
      ...NATIONS.slice(0, 10).map((n) => `${n.ko} 축구협회 올해의 선수`),
      ...Object.values(RIVAL).map((r) => r.label),
    ];
    expect(untranslated([...tours, ...stages, ...trophies, ...misc])).toEqual([]);
  });

  it('이정표 문장이 옮겨진다', () => {
    const club = '울산 블루타이거즈';
    const miles = [
      `프로 데뷔 (${club})`,
      '프로 데뷔골',
      ...[100, 200, 300, 400, 500, 600].map((n) => `프로 통산 ${n}경기 출전`),
      ...[50, 100, 150, 200, 300].map((n) => `프로 통산 ${n}골`),
      '유럽 무대 진출 (에레디비시)',
      '유럽 5대 리그 입성 (프리미어리그)',
      '미국 무대 진출 (MLS)',
      'UEFA 챔피언스리그 데뷔',
      'AFC 챔피언스리그 엘리트 데뷔골',
      '챔피언스리그 결승 무대',
      'A매치 데뷔',
      'A매치 데뷔골',
      'A매치 50경기 출전',
      '센추리 클럽 가입 (A매치 100경기)',
      '국가대표팀 주장 선임',
      '월드컵 본선 출전',
      '월드컵 본선 득점',
      '발롱도르 30인 후보 선정',
      `${club} 한 팀에서 5시즌`,
      `원클럽맨 · ${club} 헌정 (No.10)`,
      `${club} 레전드 헌정`,
      'A대표팀 은퇴 경기',
      `${club} 홈구장에서 은퇴 경기`,
      '발롱도르 7위 (30인 후보)',
      '발롱도르 수상!',
    ];
    expect(untranslated(miles)).toEqual([]);
  });

  it('조합된 이름은 맞는 영어가 된다', () => {
    setLocale('en', en);
    expect(tn('프리미어리그 우승')).toBe('Premier League champions');
    expect(tn('FA컵 우승')).toBe('FA Cup winners');
    expect(tn('UEFA 챔피언스리그 우승')).toBe('UEFA Champions League winners');
    expect(tn('프리미어리그 도움왕')).toBe('Premier League top assister');
    expect(tn('라리가 올해의 영플레이어')).toBe('La Liga Young Player of the Year');
    expect(tn('PFA 올해의 선수')).toBe('PFA Player of the Year');
    expect(tn('일본 축구협회 올해의 선수')).toBe('Japan FA Player of the Year');
    expect(tn('2026 전반기')).toBe('2026 First half');
    expect(tn('2026 FIFA 월드컵 (미국·캐나다·멕시코)')).toBe(
      '2026 FIFA World Cup (USA, Canada and Mexico)',
    );
    expect(tn('16강 탈락')).toBe('Out in the round of 16');
    expect(tn('8강')).toBe('Quarter-finals');
    expect(tn('프로 데뷔 (울산 블루타이거즈)')).toBe('Pro debut (Ulsan Blue Tigers)');
    expect(tn('원클럽맨 · 울산 블루타이거즈 헌정 (No.9)')).toBe(
      'One-club man · Ulsan Blue Tigers tribute (No. 9)',
    );
    // 유저가 지은 구단명처럼 표에 없는 이름은 그대로 둔다.
    expect(tn('우리동네FC')).toBe('우리동네FC');
    expect(tn('우리동네FC 우승')).toBe('우리동네FC winners');
  });
});
