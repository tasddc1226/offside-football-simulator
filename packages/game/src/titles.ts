// ───────── 칭호 (T-10-026) ─────────
// 흩어져 있던 "칭호 같은 것"(커리어 여정·수상·트로피·스토리 결말·레전드 등급)을 한 레지스트리로 모은다.
// 여정(miles)·수상(awards)은 그대로 "그때 일어난 일" 로그로 남고, 칭호는 그 로그와 통산 기록을 읽어
// 파생되는 "지금 나를 부르는 이름"이다. 판정은 전부 순수 함수 — 시드 RNG를 절대 호출하지 않는다(결정성).
// 획득한 순간만 s.titles에 {id, year}로 적어 두고(획득 연도·새 칭호 연출용), 획득하면 등급만큼 인기가 오른다.
import { WALL_OF_HONOR_TITLE_ID } from '@offside/contracts/hof-rules';
import { LEAGUES } from './data.js';
import { CONT, CUPS, POTY, TOP_SCORER } from './comps.js';
import { STORIES } from './engine.js';
import type { GameState } from './types.js';
import { CONFEDS, CONF_ORDER, cupTrophy } from '@offside/contracts/nations';
import { isKorean, nationOf, type Confed } from './nation.js';
import { LEGEND_BANDS, legendBand, type Rarity } from './legend-bands.js';
import { gTitlesText } from './i18n/ko/gTitles.js';
import { gRarityText } from './i18n/ko/gRarity.js';
import { tn } from './i18n/names.js';
export type { Rarity } from './legend-bands.js';

export type TitleCat =
  'record' | 'journey' | 'award' | 'trophy' | 'nation' | 'story' | 'fame' | 'legend';
/** 1 일반 · 2 희귀 · 3 영웅 · 4 전설 */
export interface TitleCtx {
  /** 은퇴 때만 넘어오는 레전드 점수. 레전드 등급 칭호는 이 값이 있을 때만 판정한다. */
  score?: number;
}
export interface TitleDef {
  id: string;
  name: string;
  cat: TitleCat;
  rarity: Rarity;
  /** 획득 조건 설명(도감). hidden 칭호는 획득 전엔 이 대신 hint만 보인다. */
  desc: string;
  hidden?: boolean;
  earned: (s: GameState, x: TitleCtx) => boolean;
  /** 진행도 [현재, 목표] — 숫자로 셀 수 있는 조건만. */
  progress?: (s: GameState) => [number, number];
  /** T-10-096 이 선수가 얻을 수 있는 칭호인지(국적·연맹). 없으면 누구나. 도감은 얻을 수 없는 칭호를 감춘다. */
  avail?: (s: Pick<GameState, 'nation'>) => boolean;
}

export const TITLE_CATS: { id: TitleCat; readonly label: string }[] = [
  {
    id: 'record',
    get label() {
      return gTitlesText.catRecord;
    },
  },
  {
    id: 'journey',
    get label() {
      return gTitlesText.catJourney;
    },
  },
  {
    id: 'award',
    get label() {
      return gTitlesText.catAward;
    },
  },
  {
    id: 'trophy',
    get label() {
      return gTitlesText.catTrophy;
    },
  },
  {
    id: 'nation',
    get label() {
      return gTitlesText.catNation;
    },
  },
  {
    id: 'story',
    get label() {
      return gTitlesText.catStory;
    },
  },
  {
    id: 'fame',
    get label() {
      return gTitlesText.catFame;
    },
  },
  {
    id: 'legend',
    get label() {
      return gTitlesText.catLegend;
    },
  },
];
export const RARITY_LABEL: Record<Rarity, string> = gRarityText;
/** 획득 시 오르는 인기. 마일스톤 보상(1~6)과 같은 크기대로 둔다. */
const RARITY_FAME: Record<Rarity, number> = { 1: 1, 2: 2, 3: 4, 4: 8 };

// ── 판정 헬퍼 (전부 순수) ──
const pro = (s: GameState) => s.career.filter((r) => r.pro);
const sum = (s: GameState, k: 'goals' | 'assists' | 'apps' | 'cs') =>
  pro(s).reduce((t, r) => t + (r[k] || 0), 0);
const best = (s: GameState, f: (r: GameState['career'][number]) => number) =>
  s.career.reduce((m, r) => Math.max(m, f(r)), 0);
const count = <T>(xs: readonly T[], f: (x: T) => boolean) => xs.filter(f).length;
const awardCount = (s: GameState, f: (t: string) => boolean) => count(s.awards, (a) => f(a.t));
const trophyCount = (s: GameState, f: (t: string) => boolean) => count(s.trophies, (a) => f(a.t));
const mile = (s: GameState, key: string) => !!s.flags['m_' + key];
const cap = (v: number, n: number): [number, number] => [Math.min(v, n), n];

const SCORER = new Set([...Object.values(TOP_SCORER), '득점왕']);
const LEAGUE_MVP = new Set([...Object.values(POTY), '대회 MVP']);
const LEAGUE_WIN = new Set(LEAGUES.map((l) => `${l.name} 우승`));
const CUP_WIN = new Set(
  Object.values(CUPS)
    .flat()
    .map((c) => `${c} 우승`),
);
const TOP_CONT_WIN = new Set(['UCL', 'ACLE', 'CCC'].map((k) => `${CONT[k]!.name} 우승`));
/** 같은 해에 리그·국내 컵·최상위 대륙 대회를 모두 들어 올렸는지. */
const treble = (s: GameState) =>
  [...new Set(s.trophies.map((t) => t.year))].some((y) => {
    const ts = s.trophies.filter((t) => t.year === y).map((t) => t.t);
    return (
      ts.some((t) => LEAGUE_WIN.has(t)) &&
      ts.some((t) => CUP_WIN.has(t)) &&
      ts.some((t) => TOP_CONT_WIN.has(t))
    );
  });
const clubs = (s: GameState) =>
  new Set(
    pro(s)
      .filter((r) => !r.mil)
      .map((r) => r.club),
  ).size;

/** 스토리 결말 → 칭호. [스토리 key, 결말(storyLog.ending과 같은 문자열), 칭호 id]. 기한 만료 결말('흐지부지…')은 뺀다. */
const STORY_ENDINGS: [string, string, string][] = [
  ['rival', '끝내 넘어선 벽', 'st_rival_wall'],
  ['rival', '라이벌에서 동료로', 'st_rival_mate'],
  ['rival', '어색한 휴전', 'st_rival_truce'],
  ['rival', '영원한 2인자', 'st_rival_second'],
  ['rehab', '더 강해져서 돌아왔다', 'st_rehab_strong'],
  ['rehab', '긴 터널을 지나', 'st_rehab_tunnel'],
  ['rehab', '조용한 복귀', 'st_rehab_quiet'],
  ['scandal', '실력이 곧 해명', 'st_scandal_skill'],
  ['scandal', '진심은 통한다', 'st_scandal_heart'],
  ['scandal', '없던 일로', 'st_scandal_gone'],
  ['scandal', '지워지지 않는 꼬리표', 'st_scandal_tag'],
  ['europe', '완벽한 적응', 'st_europe_fit'],
  ['europe', '느린 적응', 'st_europe_slow'],
  ['europe', '향수병', 'st_europe_home'],
  ['europe', '말보다 골', 'st_europe_goal'],
  ['europe', '말보다 실력', 'st_europe_skill'],
  ['europe', '이루지 못한 꿈', 'st_europe_dream'],
  ['mentor', '은사와 함께', 'st_mentor_with'],
  ['mentor', '홀로서기', 'st_mentor_alone'],
];

/** 칭호 이름·설명은 만들 때 굳히지 않고 읽을 때 지금 언어로 가져온다(getter). */
const txt = (k: string): string => (gTitlesText as unknown as Record<string, string>)[k]!;
const t = (
  id: string,
  cat: TitleCat,
  rarity: Rarity,
  earned: TitleDef['earned'],
  progress?: TitleDef['progress'],
  hidden?: boolean,
  /** 이름·설명이 id로 찾는 문구가 아닐 때(스토리 결말·국가대항전·은퇴 등급). */
  text?: { name?: () => string; desc?: () => string },
): TitleDef => ({
  id,
  get name() {
    return text?.name ? text.name() : txt(id);
  },
  cat,
  rarity,
  get desc() {
    return text?.desc ? text.desc() : txt(`${id}_d`);
  },
  earned,
  ...(progress ? { progress } : {}),
  ...(hidden ? { hidden } : {}),
});

/** 국적 조건이 붙은 칭호 — 얻을 수 없는 선수에겐 판정도 도감도 없다. getter를 잃지 않게 d를 그대로 고친다. */
const only = (avail: NonNullable<TitleDef['avail']>, d: TitleDef): TitleDef => {
  const earned = d.earned;
  d.avail = avail;
  d.earned = (s, x) => avail(s) && earned(s, x);
  return d;
};
const confIs = (c: Confed) => (s: Pick<GameState, 'nation'>) => nationOf(s).conf === c;
/** 셀 수 있는 조건(값 ≥ 목표) — 판정과 진행도가 같은 값을 쓴다. */
const n = (
  id: string,
  cat: TitleCat,
  rarity: Rarity,
  get: (s: GameState) => number,
  target: number,
): TitleDef =>
  t(
    id,
    cat,
    rarity,
    (s) => get(s) >= target,
    (s) => cap(get(s), target),
  );

export const TITLES: TitleDef[] = [
  // 기록
  n('goals100', 'record', 2, (s) => sum(s, 'goals'), 100),
  n('goals300', 'record', 4, (s) => sum(s, 'goals'), 300),
  n('season30', 'record', 3, (s) => best(s, (r) => (r.pro ? r.goals : 0)), 30),
  n('assists100', 'record', 3, (s) => sum(s, 'assists'), 100),
  n('season20a', 'record', 3, (s) => best(s, (r) => (r.pro ? r.assists : 0)), 20),
  n('cs100', 'record', 3, (s) => sum(s, 'cs'), 100),
  n('apps500', 'record', 3, (s) => sum(s, 'apps'), 500),
  t('rating8', 'record', 3, (s) => s.career.some((r) => r.pro && r.apps >= 15 && r.rating >= 8)),
  n('ovr80', 'record', 2, (s) => s.peak, 80),
  n('ovr90', 'record', 4, (s) => s.peak, 90),
  // 여정
  t('debut', 'journey', 1, (s) => mile(s, 'debut') || pro(s).some((r) => r.apps > 0)),
  t('wonderkid', 'journey', 3, (s) => s.career.some((r) => r.age <= 20 && r.ovr >= 75)),
  t('loyal', 'journey', 2, (s) => mile(s, 'loyal5')),
  n('journeyman', 'journey', 2, clubs, 5),
  t('europe', 'journey', 2, (s) => mile(s, 'europe')),
  t('big5', 'journey', 3, (s) => mile(s, 'big5')),
  t('veteran', 'journey', 3, (s) => s.career.some((r) => r.pro && r.age >= 38 && r.apps > 0)),
  t('oneclub', 'journey', 4, (s) => mile(s, 'oneclub')),
  only(
    isKorean,
    t('mil', 'journey', 1, (s) => !!s.mil?.served && !s.mil.serving, undefined, true),
  ),
  // 개인 수상
  t('topscorer', 'award', 2, (s) => awardCount(s, (a) => SCORER.has(a)) >= 1),
  n('topscorer3', 'award', 3, (s) => awardCount(s, (a) => SCORER.has(a)), 3),
  t('mvp', 'award', 3, (s) => awardCount(s, (a) => LEAGUE_MVP.has(a)) >= 1),
  t('goldenshoe', 'award', 3, (s) => awardCount(s, (a) => a === '유러피언 골든슈') >= 1),
  t('yashin', 'award', 3, (s) => awardCount(s, (a) => a === '야신 트로피') >= 1),
  n('awards10', 'award', 3, (s) => s.awards.length, 10),
  t('ballon', 'award', 4, (s) => awardCount(s, (a) => a === '발롱도르') >= 1),
  n('ballon3', 'award', 4, (s) => awardCount(s, (a) => a === '발롱도르'), 3),
  // 우승
  t('champion', 'trophy', 1, (s) => trophyCount(s, (x) => LEAGUE_WIN.has(x)) >= 1),
  t('cupwinner', 'trophy', 1, (s) => trophyCount(s, (x) => CUP_WIN.has(x)) >= 1),
  t('continental', 'trophy', 3, (s) => trophyCount(s, (x) => TOP_CONT_WIN.has(x)) >= 1),
  t('bigear', 'trophy', 4, (s) => trophyCount(s, (x) => x === 'UEFA 챔피언스리그 우승') >= 1),
  t('treble', 'trophy', 4, treble),
  t('cwc', 'trophy', 3, (s) => trophyCount(s, (x) => x === 'FIFA 클럽 월드컵 우승') >= 1),
  n('trophies10', 'trophy', 3, (s) => s.trophies.length, 10),
  // 국가대표
  only(
    isKorean,
    t('ntdebut', 'nation', 1, (s) => s.nat.caps > 0),
  ),
  only(
    (s) => !isKorean(s),
    t('ntdebutx', 'nation', 1, (s) => s.nat.caps > 0),
  ),
  t('captain', 'nation', 3, (s) => s.nat.captain || mile(s, 'captain')),
  n('century', 'nation', 3, (s) => s.nat.caps, 100),
  t('wcgoal', 'nation', 3, (s) => mile(s, 'wcGoal')),
  t(
    'gold',
    'nation',
    2,
    (s) => trophyCount(s, (x) => x === '아시안게임 금메달' || x === '올림픽 금메달') >= 1,
  ),
  ...CONF_ORDER.map((conf) => {
    const { id } = CONFEDS[conf].title;
    const trophy = cupTrophy(conf);
    return only(
      confIs(conf),
      t(id, 'nation', 3, (s) => trophyCount(s, (x) => x === trophy) >= 1, undefined, undefined, {
        desc: () => tn(trophy),
      }),
    );
  }),
  t('worldchamp', 'nation', 4, (s) => trophyCount(s, (x) => x === 'FIFA 월드컵 우승') >= 1),
  // 이야기 — 스토리 결말은 숨김 칭호(획득 전에는 이름이 가려진다). 이름은 저장된 결말 문자열이라 tn()으로 옮긴다.
  ...STORY_ENDINGS.map(([key, ending, id]) =>
    t(
      id,
      'story',
      2,
      (s) => (s.storyLog || []).some((l) => l.key === key && l.ending === ending),
      undefined,
      true,
      {
        name: () => tn(ending),
        desc: () => gTitlesText.storyDesc({ name: tn(STORIES[key]?.name ?? key) }),
      },
    ),
  ),
  // 인기
  n('fame50', 'fame', 1, (s) => Math.floor(s.fame), 50),
  n('fame100', 'fame', 2, (s) => Math.floor(s.fame), 100),
  n('fame300', 'fame', 3, (s) => Math.floor(s.fame), 300),
  n('fame1000', 'fame', 4, (s) => Math.floor(s.fame), 1000),
  // Server-only: checkTitles never grants it, so no popularity or game rewards.
  t(WALL_OF_HONOR_TITLE_ID, 'legend', 4, () => false),
  // 은퇴 — 은퇴할 때 레전드 점수 구간 하나만. T-11-018 기준은 시즌 1 선수 것이고, 프리시즌 선수는 옛 기준을 쓴다.
  ...LEGEND_BANDS.map(([id, , rarity, min, preMin], i) =>
    t(
      id,
      'legend',
      rarity,
      (s, x) => x.score != null && legendBand(x.score, s.dpos).id === id,
      undefined,
      undefined,
      {
        desc: () =>
          i === LEGEND_BANDS.length - 1
            ? gTitlesText.legendLast({ below: LEGEND_BANDS[i - 1]![3] })
            : gTitlesText.legendTop({ min, pre: preMin === min ? null : preMin }),
      },
    ),
  ),
];
const BY_ID = new Map(TITLES.map((d) => [d.id, d]));
export const titleById = (id: string | null | undefined): TitleDef | undefined =>
  id ? BY_ID.get(id) : undefined;

/** 아직 없는 칭호 중 지금 조건을 채운 것을 기록하고 새로 얻은 목록을 돌려준다. silent면 인기 보상 없이 조용히 채운다
 * (칭호 시스템 이전 저장을 처음 불러올 때). 인기는 addStat()을 거치지 않는다 — addStat의 지터가 RNG를 쓰기 때문. */
export function checkTitles(s: GameState, x: TitleCtx = {}, silent = false): TitleDef[] {
  const have = new Set((s.titles ?? []).map((e) => e.id));
  const got = TITLES.filter((d) => !have.has(d.id) && d.earned(s, x));
  if (!got.length) return got;
  s.titles = [...(s.titles ?? []), ...got.map((d) => ({ id: d.id, year: silent ? 0 : s.year }))];
  if (!silent) s.fame = Math.max(0, s.fame + got.reduce((n, d) => n + RARITY_FAME[d.rarity], 0));
  return got;
}
/** 칭호 도입 전 저장: 이미 채운 조건은 조용히 채워 넣는다(새 칭호 연출·인기 보상 없음). */
export function ensureTitles(s: GameState): void {
  if (s.titles) return;
  s.titles = [];
  checkTitles(s, {}, true);
}

/** 화면·저장(pending.res)에 싣는 칭호 요약. 레지스트리 함수는 담지 않는다. */
export type TitleView = { id: string; name: string; rarity: Rarity };
export const titleView = (d: TitleDef): TitleView => ({ id: d.id, name: d.name, rarity: d.rarity });

/** 대표 칭호 — 유저가 고른 것이 있으면 그것, 없으면 가장 높은 등급 중 가장 최근에 얻은 것.
 * 은퇴 등급 칭호(cat 'legend')는 리포트에 레전드 등급으로 따로 보이고 은퇴 때 마지막에 붙어 늘 '최근'이 된다 —
 * 그래서 같은 등급이면 다른 칭호(발롱도르·트레블·원클럽맨 …)를 먼저 고른다(#369 기획 A: 등급과 대표 칭호 분리). */
export function mainTitle(s: Pick<GameState, 'titles' | 'titleSel'>): TitleDef | undefined {
  const list = s.titles ?? [];
  if (s.titleSel && list.some((e) => e.id === s.titleSel)) return titleById(s.titleSel);
  // 등급 → 은퇴 등급이 아닌 것 → 최근 순. 목록은 얻은 순서라 같은 해면 뒤의 것(>= 0)이 더 최근이다.
  const notBand = (d: TitleDef) => (d.cat === 'legend' ? 0 : 1);
  let pick: { d: TitleDef; year: number } | undefined;
  for (const e of list) {
    const d = titleById(e.id);
    if (!d) continue;
    const cmp = pick
      ? d.rarity - pick.d.rarity || notBand(d) - notBand(pick.d) || e.year - pick.year
      : 0;
    if (!pick || cmp >= 0) pick = { d, year: e.year };
  }
  return pick?.d;
}
