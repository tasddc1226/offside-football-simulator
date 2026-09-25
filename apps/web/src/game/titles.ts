// ───────── 칭호 (T-10-026) ─────────
// 흩어져 있던 "칭호 같은 것"(커리어 여정·수상·트로피·스토리 결말·레전드 등급)을 한 레지스트리로 모은다.
// 여정(miles)·수상(awards)은 그대로 "그때 일어난 일" 로그로 남고, 칭호는 그 로그와 통산 기록을 읽어
// 파생되는 "지금 나를 부르는 이름"이다. 판정은 전부 순수 함수 — 시드 RNG를 절대 호출하지 않는다(결정성).
// 획득한 순간만 s.titles에 {id, year}로 적어 두고(획득 연도·새 칭호 연출용), 획득하면 등급만큼 인기가 오른다.
import { LEAGUES } from './data.js';
import { CONT, CUPS, POTY, TOP_SCORER } from './comps.js';
import { STORIES } from './engine.js';
import type { GameState } from './types.js';

export type TitleCat = 'record' | 'journey' | 'award' | 'trophy' | 'nation' | 'story' | 'fame' | 'legend';
/** 1 일반 · 2 희귀 · 3 영웅 · 4 전설 */
export type Rarity = 1 | 2 | 3 | 4;
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
}
export interface EarnedTitle {
  id: string;
  /** 획득 연도. 0이면 칭호 시스템 이전 저장에서 옮겨 온 기록(연도 모름). */
  year: number;
}

export const TITLE_CATS: { id: TitleCat; label: string }[] = [
  { id: 'record', label: '기록' },
  { id: 'journey', label: '여정' },
  { id: 'award', label: '개인 수상' },
  { id: 'trophy', label: '우승' },
  { id: 'nation', label: '국가대표' },
  { id: 'story', label: '이야기' },
  { id: 'fame', label: '인기' },
  { id: 'legend', label: '은퇴' },
];
export const RARITY_LABEL: Record<Rarity, string> = { 1: '일반', 2: '희귀', 3: '영웅', 4: '전설' };
/** 획득 시 오르는 인기. 마일스톤 보상(1~6)과 같은 크기대로 둔다. */
const RARITY_FAME: Record<Rarity, number> = { 1: 1, 2: 2, 3: 4, 4: 8 };

// ── 판정 헬퍼 (전부 순수) ──
const pro = (s: GameState) => s.career.filter((r) => r.pro);
const sum = (s: GameState, k: 'goals' | 'assists' | 'apps' | 'cs') => pro(s).reduce((t, r) => t + (r[k] || 0), 0);
const best = (s: GameState, f: (r: GameState['career'][number]) => number) => s.career.reduce((m, r) => Math.max(m, f(r)), 0);
const count = <T>(xs: readonly T[], f: (x: T) => boolean) => xs.filter(f).length;
const awardCount = (s: GameState, f: (t: string) => boolean) => count(s.awards, (a) => f(a.t));
const trophyCount = (s: GameState, f: (t: string) => boolean) => count(s.trophies, (a) => f(a.t));
const mile = (s: GameState, key: string) => !!s.flags['m_' + key];
const cap = (v: number, n: number): [number, number] => [Math.min(v, n), n];

const SCORER = new Set([...Object.values(TOP_SCORER), '득점왕']);
const LEAGUE_MVP = new Set([...Object.values(POTY), '대회 MVP']);
const LEAGUE_WIN = new Set(LEAGUES.map((l) => `${l.name} 우승`));
const CUP_WIN = new Set(Object.values(CUPS).flat().map((c) => `${c} 우승`));
const TOP_CONT_WIN = new Set(['UCL', 'ACLE', 'CCC'].map((k) => `${CONT[k]!.name} 우승`));
/** 같은 해에 리그·국내 컵·최상위 대륙 대회를 모두 들어 올렸는지. */
const treble = (s: GameState) =>
  [...new Set(s.trophies.map((t) => t.year))].some((y) => {
    const ts = s.trophies.filter((t) => t.year === y).map((t) => t.t);
    return ts.some((t) => LEAGUE_WIN.has(t)) && ts.some((t) => CUP_WIN.has(t)) && ts.some((t) => TOP_CONT_WIN.has(t));
  });
const clubs = (s: GameState) => new Set(pro(s).filter((r) => !r.mil).map((r) => r.club)).size;

/** 스토리 결말 → 칭호. [스토리 key, 결말(storyLog.ending과 같은 문자열), 칭호 id]. 기한 만료 결말('흐지부지…')은 뺀다. */
const STORY_ENDINGS: [string, string, string][] = [
  ['rival', '끝내 넘어선 벽', 'st_rival_wall'], ['rival', '라이벌에서 동료로', 'st_rival_mate'],
  ['rival', '어색한 휴전', 'st_rival_truce'], ['rival', '영원한 2인자', 'st_rival_second'],
  ['rehab', '더 강해져서 돌아왔다', 'st_rehab_strong'], ['rehab', '긴 터널을 지나', 'st_rehab_tunnel'], ['rehab', '조용한 복귀', 'st_rehab_quiet'],
  ['scandal', '실력이 곧 해명', 'st_scandal_skill'], ['scandal', '진심은 통한다', 'st_scandal_heart'],
  ['scandal', '없던 일로', 'st_scandal_gone'], ['scandal', '지워지지 않는 꼬리표', 'st_scandal_tag'],
  ['europe', '완벽한 적응', 'st_europe_fit'], ['europe', '느린 적응', 'st_europe_slow'], ['europe', '향수병', 'st_europe_home'],
  ['europe', '말보다 골', 'st_europe_goal'], ['europe', '말보다 실력', 'st_europe_skill'], ['europe', '이루지 못한 꿈', 'st_europe_dream'],
  ['mentor', '은사와 함께', 'st_mentor_with'], ['mentor', '홀로서기', 'st_mentor_alone'],
];

const t = (id: string, name: string, cat: TitleCat, rarity: Rarity, desc: string, earned: TitleDef['earned'], progress?: TitleDef['progress'], hidden?: boolean): TitleDef =>
  ({ id, name, cat, rarity, desc, earned, ...(progress ? { progress } : {}), ...(hidden ? { hidden } : {}) });

/** 셀 수 있는 조건(값 ≥ 목표) — 판정과 진행도가 같은 값을 쓴다. */
const n = (id: string, name: string, cat: TitleCat, rarity: Rarity, desc: string, get: (s: GameState) => number, target: number): TitleDef =>
  t(id, name, cat, rarity, desc, (s) => get(s) >= target, (s) => cap(get(s), target));

const LEGEND_BANDS: [string, string, Rarity, number][] = [
  ['lg_goat', '역대 최고의 전설', 4, 840],
  ['lg_world', '월드클래스 레전드', 4, 590],
  ['lg_club', '클럽 레전드', 3, 425],
  ['lg_pro', '성실한 프로', 2, 305],
  ['lg_plain', '평범한 축구 커리어', 1, 0],
];
/** 은퇴 리포트의 레전드 등급 이름. 칭호의 은퇴 등급과 같은 표를 쓴다. */
export function legendBand(score: number): { id: string; name: string } {
  const b = LEGEND_BANDS.find(([, , , min]) => score >= min)!;
  return { id: b[0], name: b[1] };
}

export const TITLES: TitleDef[] = [
  // 기록
  n('goals100', '골잡이', 'record', 2, '프로 통산 100골', (s) => sum(s, 'goals'), 100),
  n('goals300', '골 머신', 'record', 4, '프로 통산 300골', (s) => sum(s, 'goals'), 300),
  n('season30', '득점 기계', 'record', 3, '한 시즌 공식전 30골', (s) => best(s, (r) => (r.pro ? r.goals : 0)), 30),
  n('assists100', '마에스트로', 'record', 3, '프로 통산 100도움', (s) => sum(s, 'assists'), 100),
  n('season20a', '킬패스 장인', 'record', 3, '한 시즌 공식전 20도움', (s) => best(s, (r) => (r.pro ? r.assists : 0)), 20),
  n('cs100', '통곡의 벽', 'record', 3, '프로 통산 무실점 100경기', (s) => sum(s, 'cs'), 100),
  n('apps500', '철인', 'record', 3, '프로 통산 500경기 출전', (s) => sum(s, 'apps'), 500),
  t('rating8', '평점 8의 사나이', 'record', 3, '한 시즌 평균 평점 8.0 이상(15경기 이상)', (s) => s.career.some((r) => r.pro && r.apps >= 15 && r.rating >= 8)),
  n('ovr80', '에이스', 'record', 2, '최고 OVR 80 달성', (s) => s.peak, 80),
  n('ovr90', '월드클래스', 'record', 4, '최고 OVR 90 달성', (s) => s.peak, 90),
  // 여정
  t('debut', '프로 선수', 'journey', 1, '프로 무대 데뷔', (s) => mile(s, 'debut') || pro(s).some((r) => r.apps > 0)),
  t('wonderkid', '원더키드', 'journey', 3, '20세 이하 시즌 OVR 75 이상', (s) => s.career.some((r) => r.age <= 20 && r.ovr >= 75)),
  t('loyal', '한 팀의 심장', 'journey', 2, '한 클럽에서 프로 5시즌', (s) => mile(s, 'loyal5')),
  n('journeyman', '저니맨', 'journey', 2, '프로 클럽 5곳을 거치기', clubs, 5),
  t('europe', '유럽파', 'journey', 2, '유럽 무대 진출', (s) => mile(s, 'europe')),
  t('big5', '빅리거', 'journey', 3, '유럽 5대 리그 입성', (s) => mile(s, 'big5')),
  t('veteran', '불혹의 현역', 'journey', 3, '38세까지 현역으로 뛰기', (s) => s.career.some((r) => r.pro && r.age >= 38 && r.apps > 0)),
  t('oneclub', '원클럽맨', 'journey', 4, '한 클럽에서만 뛰고 은퇴(8시즌 이상)', (s) => mile(s, 'oneclub')),
  t('mil', '군필', 'journey', 1, '병역 의무를 마치기', (s) => !!s.mil?.served && !s.mil.serving, undefined, true),
  // 개인 수상
  t('topscorer', '득점왕', 'award', 2, '리그 득점왕', (s) => awardCount(s, (a) => SCORER.has(a)) >= 1),
  n('topscorer3', '골든부트 콜렉터', 'award', 3, '리그 득점왕 3회', (s) => awardCount(s, (a) => SCORER.has(a)), 3),
  t('mvp', '리그 MVP', 'award', 3, '리그 올해의 선수', (s) => awardCount(s, (a) => LEAGUE_MVP.has(a)) >= 1),
  t('goldenshoe', '골든슈', 'award', 3, '유러피언 골든슈 수상', (s) => awardCount(s, (a) => a === '유러피언 골든슈') >= 1),
  t('yashin', '거미손', 'award', 3, '야신 트로피 수상', (s) => awardCount(s, (a) => a === '야신 트로피') >= 1),
  n('awards10', '수상 제조기', 'award', 3, '개인상 10개', (s) => s.awards.length, 10),
  t('ballon', '발롱도르 위너', 'award', 4, '발롱도르 수상', (s) => awardCount(s, (a) => a === '발롱도르') >= 1),
  n('ballon3', '황금의 발', 'award', 4, '발롱도르 3회 수상', (s) => awardCount(s, (a) => a === '발롱도르'), 3),
  // 우승
  t('champion', '챔피언', 'trophy', 1, '리그 우승', (s) => trophyCount(s, (x) => LEAGUE_WIN.has(x)) >= 1),
  t('cupwinner', '컵 위너', 'trophy', 1, '국내 컵 대회 우승', (s) => trophyCount(s, (x) => CUP_WIN.has(x)) >= 1),
  t('continental', '대륙 챔피언', 'trophy', 3, '대륙 최상위 클럽 대회 우승', (s) => trophyCount(s, (x) => TOP_CONT_WIN.has(x)) >= 1),
  t('bigear', '빅이어', 'trophy', 4, 'UEFA 챔피언스리그 우승', (s) => trophyCount(s, (x) => x === 'UEFA 챔피언스리그 우승') >= 1),
  t('treble', '트레블', 'trophy', 4, '한 시즌 리그·국내 컵·대륙 대회 모두 우승', treble),
  t('cwc', '세계 최강 클럽', 'trophy', 3, 'FIFA 클럽 월드컵 우승', (s) => trophyCount(s, (x) => x === 'FIFA 클럽 월드컵 우승') >= 1),
  n('trophies10', '우승 청부사', 'trophy', 3, '트로피 10개', (s) => s.trophies.length, 10),
  // 국가대표
  t('ntdebut', '태극전사', 'nation', 1, 'A매치 데뷔', (s) => s.nat.caps > 0),
  t('captain', '캡틴', 'nation', 3, '국가대표팀 주장 선임', (s) => s.nat.captain || mile(s, 'captain')),
  n('century', '센추리 클럽', 'nation', 3, 'A매치 100경기 출전', (s) => s.nat.caps, 100),
  t('wcgoal', '월드컵의 사나이', 'nation', 3, '월드컵 본선 득점', (s) => mile(s, 'wcGoal')),
  t('gold', '금메달리스트', 'nation', 2, '아시안게임 또는 올림픽 금메달', (s) => trophyCount(s, (x) => x === '아시안게임 금메달' || x === '올림픽 금메달') >= 1),
  t('asiancup', '아시아의 왕', 'nation', 3, 'AFC 아시안컵 우승', (s) => trophyCount(s, (x) => x === 'AFC 아시안컵 우승') >= 1),
  t('worldchamp', '월드 챔피언', 'nation', 4, 'FIFA 월드컵 우승', (s) => trophyCount(s, (x) => x === 'FIFA 월드컵 우승') >= 1),
  // 이야기 — 스토리 결말은 숨김 칭호(획득 전에는 이름이 가려진다)
  ...STORY_ENDINGS.map(([key, ending, id]) =>
    t(id, ending, 'story', 2, `「${STORIES[key]?.name ?? key}」 이야기의 결말`, (s) => (s.storyLog || []).some((l) => l.key === key && l.ending === ending), undefined, true),
  ),
  // 인기
  n('fame50', '떠오르는 스타', 'fame', 1, '인기 50', (s) => Math.floor(s.fame), 50),
  n('fame100', '국민 스타', 'fame', 2, '인기 100', (s) => Math.floor(s.fame), 100),
  n('fame300', '슈퍼스타', 'fame', 3, '인기 300', (s) => Math.floor(s.fame), 300),
  n('fame1000', '월드 아이콘', 'fame', 4, '인기 1000', (s) => Math.floor(s.fame), 1000),
  // 은퇴 — 은퇴할 때 레전드 점수 구간 하나만
  ...LEGEND_BANDS.map(([id, name, rarity, min], i) =>
    t(id, name, 'legend', rarity, i === LEGEND_BANDS.length - 1 ? '은퇴(레전드 점수 305 미만)' : `은퇴 시 레전드 점수 ${min} 이상`, (_s, x) => x.score != null && legendBand(x.score).id === id),
  ),
];
const BY_ID = new Map(TITLES.map((d) => [d.id, d]));
export const titleById = (id: string | null | undefined): TitleDef | undefined => (id ? BY_ID.get(id) : undefined);

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

/** 대표 칭호 — 유저가 고른 것이 있으면 그것, 없으면 가장 높은 등급 중 가장 최근에 얻은 것. */
export function mainTitle(s: Pick<GameState, 'titles' | 'titleSel'>): TitleDef | undefined {
  const list = s.titles ?? [];
  if (s.titleSel && list.some((e) => e.id === s.titleSel)) return titleById(s.titleSel);
  let pick: { d: TitleDef; year: number } | undefined;
  for (const e of list) {
    // 목록은 얻은 순서라, 같은 등급·같은 해면 뒤의 것(>=)이 더 최근이다.
    const d = titleById(e.id);
    if (d && (!pick || d.rarity > pick.d.rarity || (d.rarity === pick.d.rarity && e.year >= pick.year))) pick = { d, year: e.year };
  }
  return pick?.d;
}
